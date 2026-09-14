// Beam Checkout adapter — the second implementation of the PaymentGateway PORT (gateway.ts), selected by
// PAYMENT_GATEWAY=beam (select-gateway.ts). Beam lane slice 2, CIEL mootech-fe-beam-gateway-001.
// Spec read from docs.beamcheckout.com (API v1.24.0, 2026-09-13); every field name below is copied from
// there, not remembered. Playground and Production differ ONLY by BEAM_API_BASE and the four secrets.
//
// WHAT IS THE SAME AS OMISE, ON PURPOSE: the port's promises. `createPromptPayCharge` returns the same
// ChargeResult shape (charge id, QR the client renders, expiry, the gateway's own verdict);
// `retrieveCharge` answers the same three facts the webhook carries; `verifyWebhook` fails closed. So
// charge-flow, the status route, the reconciler and webhook-dispatch neither know nor care which
// provider answered.
//
// WHAT IS DIFFERENT, AND WHERE IT IS ABSORBED:
//   • Beam answers `201` for a charge it ACCEPTED, even one that then fails — the create response carries
//     only chargeId + actionRequired, never `status`. So `paid:false, status:'pending'` is reported here,
//     which isRefusedCharge (gateway.ts) reads as "not finished" ⇒ the row stays PENDING for the webhook
//     or the reconciler. Exactly right: nobody can be refused by a response that has no verdict in it.
//   • The PromptPay QR arrives INLINE (`encodedImage.imageBase64Encoded`, PNG) rather than as a hosted
//     image URL. It is handed to the client as a `data:image/png;base64,…` URI through the SAME
//     `qrDownloadUri` field, so `<Image unoptimized>` on QrScreen renders it without a new prop.
//   • QR expiry: Beam accepts `qrPromptPay.expiresAt` (the spec's name — the prose examples still say
//     `expiryTime`; the spec, Postman collection and changelog 1.17.0 agree on `expiresAt`) and calls it
//     best-effort; `encodedImage.expiry` is what it actually set. We send our 15-minute TTL and store
//     what Beam echoes back, never what we asked for. Our own row is the only place expiry lives — Beam
//     emits NO event when a QR lapses and a charge "can stay PENDING indefinitely" (their words), which
//     is the same shape Omise had (#455) and the same reconciler path handles it.
//   • There is no `metadata`; `referenceId` (≤100 chars, not unique on Beam's side) carries our orderId
//     and comes back on every webhook and GET, so #371's order_id recovery keeps working.
//   • `x-beam-idempotency-key` (12 h) is set to the orderId: a retried POST after a timeout cannot create
//     a second charge for the same order.
//   • Cards do NOT go through this adapter's `createCardCharge` with a token: owner decision D1 (ข) puts
//     cards on Beam Payment Links (hosted page), which slice 3 adds here. Until then `createCardCharge`
//     throws a named error BEFORE any network call — charge-flow's catch releases the hold and the route
//     answers 500, loud, only on a build where somebody selected Beam and tried a card too early.
import type { PaymentGateway, ChargeResult, ChargeEvent } from './gateway'
import { PROMPTPAY_QR_TTL_MS } from './qr-expiry'
import { verifyBeamSignature } from './beam-webhook-verify'
import type { HeaderReader, WebhookCodec } from './select-gateway'

export const BEAM_PRODUCTION_API = 'https://api.beamcheckout.com'
export const BEAM_PLAYGROUND_API = 'https://playground.api.beamcheckout.com'

export class BeamConfigError extends Error {
  constructor(name: string) {
    super(`${name} is not configured`) // fail loud before any charge, same as OMISE_SECRET_KEY
    this.name = 'BeamConfigError'
  }
}
export class BeamCardNotAvailableError extends Error {
  constructor() {
    super('Beam card charges arrive in slice 3 (Payment Links); this build cannot take a card through Beam')
    this.name = 'BeamCardNotAvailableError'
  }
}
export class BeamApiError extends Error {
  constructor(
    public readonly op: string,
    public readonly httpStatus: number,
    public readonly errorCode: string,
    public readonly requestId: string | null,
  ) {
    super(`beam ${op} failed: ${errorCode} (http ${httpStatus}${requestId ? `, request ${requestId}` : ''})`)
    this.name = 'BeamApiError'
  }
}

// Each variable is read by its literal name (not through a computed key) so scripts/env-example-drift.test.ts
// can see every env this file depends on and hold .env.example to it.
function merchantId(): string {
  const v = process.env.BEAM_MERCHANT_ID
  if (!v) throw new BeamConfigError('BEAM_MERCHANT_ID')
  return v
}
function apiKey(): string {
  const v = process.env.BEAM_API_KEY
  if (!v) throw new BeamConfigError('BEAM_API_KEY')
  return v
}
export function beamApiBase(): string {
  return (process.env.BEAM_API_BASE || BEAM_PRODUCTION_API).replace(/\/+$/, '')
}
function authHeader(): string {
  return 'Basic ' + Buffer.from(`${merchantId()}:${apiKey()}`).toString('base64')
}

type BeamJson = Record<string, unknown>

function requestId(res: Response): string | null {
  return res.headers.get('x-beam-request-id')
}
function errorCode(json: BeamJson, status: number): string {
  const err = json?.error as { errorCode?: unknown } | undefined
  if (err && typeof err.errorCode === 'string') return err.errorCode
  return `http_${status}`
}

async function beamGet(path: string): Promise<BeamJson | null> {
  const res = await fetch(`${beamApiBase()}${path}`, { headers: { Authorization: authHeader(), Accept: 'application/json' } })
  const json = (await res.json().catch(() => ({}))) as BeamJson
  if (res.status === 404) return null // the gateway has never heard of this charge — NOT "not paid"
  if (!res.ok) throw new BeamApiError(`GET ${path}`, res.status, errorCode(json, res.status), requestId(res))
  return json
}

async function beamPost(path: string, body: BeamJson, idempotencyKey: string): Promise<BeamJson> {
  const res = await fetch(`${beamApiBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // ≤255 chars, kept 12 h: the same order retried after a timeout cannot become two charges.
      'x-beam-idempotency-key': idempotencyKey.slice(0, 255),
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as BeamJson
  if (!res.ok) throw new BeamApiError(`POST ${path}`, res.status, errorCode(json, res.status), requestId(res))
  return json
}

// ── status vocabulary ────────────────────────────────────────────────────────────────────────────────
// Beam:  PENDING → SUCCEEDED | FAILED  (final; no expired, no reversed — a refund is its own object)
// Port:  the words gateway.ts's predicates already judge: 'successful' | 'failed' | 'pending'
//        ('expired' and 'reversed' exist there for Omise; Beam never produces them, and our own expiry
//        is written by the reconciler from charge_expires_at, not read from the gateway.)
export function mapBeamStatus(beam: unknown): { paid: boolean; status: string } {
  switch (beam) {
    case 'SUCCEEDED':
      return { paid: true, status: 'successful' }
    case 'FAILED':
      return { paid: false, status: 'failed' }
    case 'PENDING':
      return { paid: false, status: 'pending' }
    default:
      return { paid: false, status: typeof beam === 'string' ? beam.toLowerCase() : '' }
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

export const beamGateway: PaymentGateway = {
  async createCardCharge() {
    throw new BeamCardNotAvailableError()
  },

  async createPromptPayCharge({ amountSatang, email, orderId }): Promise<ChargeResult> {
    const expiresAt = new Date(Date.now() + PROMPTPAY_QR_TTL_MS).toISOString()
    const json = await beamPost(
      '/api/v1/charges',
      {
        amount: amountSatang, // integer satang — the same unit the row stores (catalog.ts listSatang)
        currency: 'THB',
        paymentMethod: { paymentMethodType: 'QR_PROMPT_PAY', qrPromptPay: { expiresAt } },
        referenceId: orderId,
        ...(email ? { customer: { email } } : {}),
      },
      `promptpay:${orderId}`,
    )
    const chargeId = str(json.chargeId)
    if (!chargeId) throw new BeamApiError('POST /api/v1/charges', 201, 'no_charge_id_in_response', null)
    const img = (json.encodedImage ?? {}) as { imageBase64Encoded?: unknown; rawData?: unknown; expiry?: unknown }
    const png = str(img.imageBase64Encoded)
    return {
      chargeId,
      qrDownloadUri: png ? `data:image/png;base64,${png}` : undefined,
      // what Beam actually set, never what we asked for (best-effort on their side)
      expiresAt: str(img.expiry),
      // the create response has no verdict — see the header. 'pending' keeps the row PENDING.
      paid: false,
      status: 'pending',
      failureCode: null,
      failureMessage: null,
      authorizeUri: null,
    }
  },

  async retrieveCharge(chargeId: string) {
    const json = await beamGet(`/api/v1/charges/${encodeURIComponent(chargeId)}`)
    if (!json) return null
    const mapped = mapBeamStatus(json.status)
    return {
      chargeId: str(json.chargeId) ?? chargeId,
      paid: mapped.paid,
      status: mapped.status,
      // read by the reconciler's abandon path (reconcile-run.ts) — Beam's own reason, e.g. CH_CARD_DECLINED
      failureCode: str(json.failureCode),
    } as { chargeId: string; paid: boolean; status: string; failureCode?: string | null }
  },

  verifyWebhook(rawBody, signature): boolean {
    return verifyBeamSignature(rawBody, signature, process.env.BEAM_WEBHOOK_HMAC_KEY)
  },
}

// ── webhook → ChargeEvent ────────────────────────────────────────────────────────────────────────────
// Beam's payload is the BARE resource (the same JSON a GET returns) and the event name rides in the
// `X-Beam-Event` header — there is no envelope, no event id, no timestamp. This maps each event Beam
// documents onto the ChargeEvent vocabulary gateway.ts's predicates already judge, so webhook-dispatch
// runs unchanged:
//   charge.succeeded  → key 'charge.complete', paid, 'successful'   ⇒ isSettleable
//   charge.failed     → key 'charge.failed', 'failed'               ⇒ isTerminalFailure (hold released)
//   refund.succeeded  → key 'refund.succeeded', refundOfChargeId + refundSatang ⇒ isRefund (revoke)
//   refund.failed     → key 'refund.failed' with refundSatang NULL  ⇒ matches nothing (logged) — a refund
//                       that FAILED must never revoke; isRefund requires refundSatang, so nulling it is
//                       the guard, and it is tested.
//   payment_link.paid → slice 3 (cards). Until then it carries no chargeId and matches nothing (logged).
//   anything else     → key passthrough, no chargeId ⇒ "no branch matched" log line, 200.
export function parseBeamEvent(rawBody: Buffer, header: HeaderReader): ChargeEvent {
  const body = JSON.parse(rawBody.toString('utf8')) as BeamJson
  const event = (header('x-beam-event') ?? '').trim()
  const referenceId = str(body.referenceId)
  const orderId = referenceId ? referenceId.trim() : null

  if (event === 'charge.succeeded' || event === 'charge.failed') {
    const mapped = mapBeamStatus(body.status)
    return {
      key: event === 'charge.succeeded' ? 'charge.complete' : 'charge.failed',
      chargeId: str(body.chargeId),
      orderId,
      // the STATUS in the body is the truth; the event name is only the trigger. A `charge.succeeded`
      // whose body says FAILED (or the reverse) must not settle — mapBeamStatus decides, not the header.
      paid: mapped.paid,
      status: mapped.status,
      refundOfChargeId: null,
      refundSatang: null,
    }
  }

  if (event === 'refund.succeeded' || event === 'refund.failed') {
    const succeeded = event === 'refund.succeeded' && body.status === 'SUCCEEDED'
    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) ? body.amount : null
    return {
      key: event,
      chargeId: str(body.refundId),
      orderId,
      paid: false,
      status: succeeded ? 'refunded' : 'refund_failed',
      refundOfChargeId: str(body.chargeId),
      // null unless the refund actually succeeded ⇒ isRefund is false for refund.failed by construction
      refundSatang: succeeded ? amount : null,
    }
  }

  return {
    key: event || '(no x-beam-event header)',
    chargeId: null,
    orderId,
    paid: false,
    status: typeof body.status === 'string' ? body.status.toLowerCase() : '',
    refundOfChargeId: null,
    refundSatang: null,
  }
}

export const beamWebhookCodec: WebhookCodec = {
  verify: (raw, h) => beamGateway.verifyWebhook(raw, h('x-beam-signature'), null),
  parse: (raw, h) => parseBeamEvent(raw, h),
}
