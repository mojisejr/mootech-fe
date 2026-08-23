// Payment gateway PORT (mootech-fe#355) — the seam the routes depend on, so the Omise REST adapter can be
// swapped for a fake in tests (no live charges) and a second provider could be added later. The route code
// never imports the adapter directly; it takes a PaymentGateway.
import type { Buffer } from 'node:buffer'

export type ChargeResult = {
  chargeId: string
  // PromptPay only: the QR image the client renders. Undefined for card charges.
  qrDownloadUri?: string
}

export interface PaymentGateway {
  createCardCharge(args: {
    amountSatang: number
    token: string
    email: string
    orderId: string
  }): Promise<ChargeResult>
  createPromptPayCharge(args: {
    amountSatang: number
    email: string
    orderId: string
  }): Promise<ChargeResult>
  // wraps the pure verifyOmiseSignature with the configured secret; fails closed.
  verifyWebhook(rawBody: Buffer, signature: string | null, timestamp: string | null): boolean
  /**
   * READ one charge back from the gateway (#360). Added because the reconciler has to answer "did this
   * charge actually succeed?" for a payment whose webhook never arrived — and until now this port could
   * only WRITE. The ticket's rule ("never call Omise directly, go through the port") is why the capability
   * is added here rather than a fetch in the cron.
   *
   * Returns the same three facts the webhook carries, so the reconciler and the webhook agree by
   * construction — one predicate (isSettleable) judges both. `null` = the gateway does not know this
   * charge; that is NOT "not paid", and the caller must not treat it as a reason to give up on the row.
   */
  retrieveCharge(chargeId: string): Promise<{ chargeId: string; paid: boolean; status: string } | null>
}

// PURE extraction of the settle-relevant fields from an Omise webhook body. Kept out of the adapter so it
// is unit-testable without env. Throws on non-JSON. A charge is settle-able only when the event is
// `charge.complete` AND the charge is paid AND status 'successful' — the caller checks those.
export type ChargeEvent = {
  key: string
  chargeId: string | null
  /** our own reference, echoed back in the charge's metadata (#371) — null if this charge was not ours. */
  orderId: string | null
  paid: boolean
  status: string
}

export function parseChargeEvent(rawBody: Buffer): ChargeEvent {
  const evt = JSON.parse(rawBody.toString('utf8')) as {
    key?: unknown
    data?: { id?: unknown; paid?: unknown; status?: unknown; metadata?: { orderId?: unknown } }
  }
  const data = evt?.data ?? {}
  // 🔴 #371 — orderId was being thrown away on every single delivery. We attach it to EVERY charge we
  // create (omise-gateway: `metadata[orderId]` on both card and PromptPay) and we write it onto the
  // v2_payment row BEFORE any money moves, which makes it the only identifier that can still connect a
  // paid charge to its row when charge_id never got attached. Reading it costs one line; not reading it
  // is why a completed payment could go unrecorded with both sides believing everything was fine.
  const meta = data.metadata ?? {}
  return {
    key: typeof evt?.key === 'string' ? evt.key : '',
    chargeId: typeof data.id === 'string' ? data.id : null,
    orderId: typeof meta.orderId === 'string' && meta.orderId.trim() !== '' ? meta.orderId.trim() : null,
    paid: data.paid === true,
    status: typeof data.status === 'string' ? data.status : '',
  }
}

// Is this event one we should provision on? (paid card/promptpay charge completed.)
export function isSettleable(evt: ChargeEvent): boolean {
  return evt.key === 'charge.complete' && evt.paid === true && evt.status === 'successful' && !!evt.chargeId
}

// 🔴 LAYER 2 of the discount-hold fix (ตู๋ #372 ③). A charge that ended and did NOT succeed frees its
// discount hold immediately — no waiting for the quote to expire. The distinction that matters:
//   TERMINAL FAILURE  failed / expired / reversed  ⇒ nobody can pay this charge any more ⇒ release
//   NOT FINISHED YET  pending (and anything unknown) ⇒ do NOTHING — releasing while it can still be paid
//                     would let the same code be spent twice.
// Unknown statuses fall on the "not finished" side on purpose: never free a slot we are not sure is dead.
const TERMINAL_FAILURE_STATUSES = new Set(['failed', 'expired', 'reversed'])

export function isTerminalFailure(evt: ChargeEvent): boolean {
  if (!evt.chargeId) return false
  if (evt.paid === true) return false // paid ⇒ it is a success path, not a failure
  return TERMINAL_FAILURE_STATUSES.has(evt.status)
}
