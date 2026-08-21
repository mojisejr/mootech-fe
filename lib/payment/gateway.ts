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
}

// PURE extraction of the settle-relevant fields from an Omise webhook body. Kept out of the adapter so it
// is unit-testable without env. Throws on non-JSON. A charge is settle-able only when the event is
// `charge.complete` AND the charge is paid AND status 'successful' — the caller checks those.
export type ChargeEvent = { key: string; chargeId: string | null; paid: boolean; status: string }

export function parseChargeEvent(rawBody: Buffer): ChargeEvent {
  const evt = JSON.parse(rawBody.toString('utf8')) as {
    key?: unknown
    data?: { id?: unknown; paid?: unknown; status?: unknown }
  }
  const data = evt?.data ?? {}
  return {
    key: typeof evt?.key === 'string' ? evt.key : '',
    chargeId: typeof data.id === 'string' ? data.id : null,
    paid: data.paid === true,
    status: typeof data.status === 'string' ? data.status : '',
  }
}

// Is this event one we should provision on? (paid card/promptpay charge completed.)
export function isSettleable(evt: ChargeEvent): boolean {
  return evt.key === 'charge.complete' && evt.paid === true && evt.status === 'successful' && !!evt.chargeId
}
