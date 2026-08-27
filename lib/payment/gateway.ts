// Payment gateway PORT (mootech-fe#355) — the seam the routes depend on, so the Omise REST adapter can be
// swapped for a fake in tests (no live charges) and a second provider could be added later. The route code
// never imports the adapter directly; it takes a PaymentGateway.
import type { Buffer } from 'node:buffer'

export type ChargeResult = {
  chargeId: string
  // PromptPay only: the QR image the client renders. Undefined for card charges.
  qrDownloadUri?: string
  // 🔴 #437 — WHAT THE GATEWAY ACTUALLY SAID. Until this existed the adapter returned the id and threw the
  // rest away, so a card Omise had already declined came back looking exactly like one still in flight:
  // HTTP 200, object 'charge', status 'failed' — never an error, so nothing threw and nothing noticed.
  // These four are optional because a fake gateway in a test may not supply them; ABSENT must therefore
  // read as "the gateway did not say", never as "the gateway said it is fine".
  status?: string
  paid?: boolean
  failureCode?: string | null
  failureMessage?: string | null
  // 🔴 #439 — where the bank wants the cardholder sent for 3-D Secure. Present ONLY when Omise decided the
  // charge needs authentication; absent on a charge that settled or failed outright. Dropping it (which is
  // what this adapter did until #439) turns "the bank wants to check who you are" into a charge that can
  // never complete — and, before a return_uri existed, into an outright refusal.
  authorizeUri?: string | null
  // 🔴 #455 — Omise's own deadline for this charge (ISO-8601, verbatim). PromptPay only; a card charge has
  // no expiry and never carries this. ABSENT/null means "the gateway did not say" and must NEVER be read as
  // "not expired": Omise emits no event when a charge expires (measured 2026-08-27 — of 124 expired charges,
  // the number carrying any event beyond charge.create is zero), so our own row is the only place this fact
  // can live. Until #455 the adapter threw it away on every single charge.
  expiresAt?: string | null
}

export interface PaymentGateway {
  createCardCharge(args: {
    amountSatang: number
    token: string
    email: string
    orderId: string
    // #439 — rides into the return_uri so the cardholder comes back to the right checkout if declined.
    packageCode?: string
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

// 🔴 #484 — A REVERSAL IS THE ONE FAILURE THAT ARRIVES AFTER WE ALREADY GRANTED SOMETHING, so it is the
// one that cannot be routed by isTerminalFailure above: that function answers `false` the moment
// `evt.paid === true`, and a reversed charge WAS paid. Whether Omise sends `paid` as true or false on a
// reversal is not something we have ever seen — no reversed event has reached this webhook, and the only
// test that exercises the status is one we wrote ourselves (scripts/reconcile-expiry.test.ts sets
// paid:false). So this deliberately does NOT look at `paid` at all: the answer is the same either way,
// and the unknown stops being able to decide whether the entitlement comes off.
// Narrow on purpose — `reversed` alone, never the whole TERMINAL_FAILURE_STATUSES set: `failed` and
// `expired` never granted anything, so there is nothing for them to take back.
export function isReversal(evt: ChargeEvent): boolean {
  return evt.status === 'reversed' && !!evt.chargeId
}

// 🔴 #437 — the SAME question asked of a charge we just created, instead of an event that arrived later.
// One definition of "terminal" for both doors: if these two ever disagree, a card could be refused at
// creation and settled by a webhook (or the reverse), and the row would end up in whichever state won the
// race. Shares TERMINAL_FAILURE_STATUSES on purpose — do not inline the list at either call site.
// `status` absent ⇒ NOT terminal: a gateway that did not answer is "not finished yet", never "refused".
export function isRefusedCharge(charge: { status?: string; paid?: boolean }): boolean {
  if (charge.paid === true) return false
  return TERMINAL_FAILURE_STATUSES.has(charge.status ?? '')
}
