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
//   • CARDS GO THROUGH BEAM PAYMENT LINKS (owner decision D1 = ข, 2026-09-13), not through a card token:
//     Beam's token endpoint cannot capture CVV, so a `CARD_TOKEN` charge would need the CVV to pass
//     through our server (PCI SAQ D). A Payment Link is Beam's hosted page: `createCardCharge` creates a
//     single-use link (card only) and returns its `url` as `authorizeUri`, which pay-destination.ts
//     already opens as a top-level navigation (the page sets X-Frame-Options: DENY, so an iframe was
//     never an option). The `token` argument is ignored — no card data ever reaches this process.
//     The row holds `link:<id>` (repo.linkChargeId) until Beam mints the charge: `charge.succeeded`
//     arrives with `source: PAYMENT_LINK` and our orderId in `referenceId`, and settleAndProvision's
//     order_id recovery rebinds the row to the real `ch_…` (repo.isProvisionalChargeId). The reconciler
//     path does the same through `retrieveCharge('link:…')` + runReconcile's rebind hook.
import type { PaymentGateway, ChargeResult, ChargeEvent } from './gateway'
import { PROMPTPAY_QR_TTL_MS } from './qr-expiry'
import { verifyBeamSignature } from './beam-webhook-verify'
import { cardReturnUri, cardReturnOrigin, CARD_RETURN_ORIGIN_ENV } from './return-uri'
import { linkChargeId, isLinkChargeId, linkIdOf } from './charge-id'
import type { HeaderReader, WebhookCodec } from './select-gateway'

/** A hosted card page that nobody paid within this window is not coming back; same TTL as the QR. */
export const PAYMENT_LINK_TTL_MS = PROMPTPAY_QR_TTL_MS

export const BEAM_PRODUCTION_API = 'https://api.beamcheckout.com'
export const BEAM_PLAYGROUND_API = 'https://playground.api.beamcheckout.com'

export class BeamConfigError extends Error {
  constructor(name: string) {
    super(`${name} is not configured`) // fail loud before any charge, same as OMISE_SECRET_KEY
    this.name = 'BeamConfigError'
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

// ── Payment Link status → the port's words ───────────────────────────────────────────────────────────
// Beam:  ACTIVE | PAID | EXPIRED | DISABLED | VOIDED | REFUNDED
// A PAID (or REFUNDED — it was paid first) link is answered through its CHARGE (see retrieveCharge), so
// the reconciler learns the `ch_…` id. The rest map onto words the reconciler already acts on.
export function mapLinkStatus(link: unknown): { paid: boolean; status: string } {
  switch (link) {
    case 'PAID':
    case 'REFUNDED':
      return { paid: true, status: 'successful' }
    case 'EXPIRED':
      return { paid: false, status: 'expired' }
    case 'DISABLED':
    case 'VOIDED':
      return { paid: false, status: 'failed' }
    case 'ACTIVE':
      return { paid: false, status: 'pending' }
    default:
      return { paid: false, status: typeof link === 'string' ? link.toLowerCase() : '' }
  }
}

/** The SUCCEEDED charge behind a paid link, or null if Beam lists none (yet). */
async function resolveLinkCharge(paymentLinkId: string): Promise<BeamJson | null> {
  const list = await beamGet(`/api/v1/charges?source_in=PAYMENT_LINK&sourceId=${encodeURIComponent(paymentLinkId)}&limit=100`)
  const data = Array.isArray(list?.data) ? (list!.data as BeamJson[]) : []
  return data.find((c) => c.status === 'SUCCEEDED') ?? null
}

export const beamGateway: PaymentGateway = {
  cardEntry: 'hosted', // Payment Links: the card is entered on Beam's page, never ours
  async createCardCharge({ amountSatang, email, orderId, packageCode }): Promise<ChargeResult> {
    // The customer is on BEAM's page; without a redirect back they finish on Beam's success screen and
    // never reach /v2/shop/result. So the return origin is REQUIRED here (Omise's card path could omit
    // it because the bank page returned to us anyway). Reuses the validated origin the Omise card lane
    // uses — https, no localhost/IP — under its existing env name; unset ⇒ fail before any link exists.
    const origin = cardReturnOrigin()
    if (!origin) throw new BeamConfigError(`${CARD_RETURN_ORIGIN_ENV} (card return origin, required for a Payment Link)`)
    const redirectUrl = cardReturnUri({ orderId, packageCode: packageCode ?? '' }) as string
    const cancel = new URL('/v2/shop/checkout', origin)
    if (packageCode) cancel.searchParams.set('package_code', packageCode)
    const expiresAt = new Date(Date.now() + PAYMENT_LINK_TTL_MS).toISOString()

    const json = await beamPost(
      '/api/v1/payment-links',
      {
        order: {
          currency: 'THB',
          netAmount: amountSatang, // integer satang; Beam's minimum is 100 (1 THB) and every package is above it
          referenceId: orderId,
          ...(packageCode ? { description: packageCode } : {}),
        },
        redirectUrl,
        cancelUrl: cancel.toString(),
        expiresAt,
        collectPhoneNumber: false,
        collectDeliveryAddress: false,
        // card ONLY on this page — PromptPay has its own in-app path, and the other methods are out of
        // scope. Sending linkSettings replaces the account defaults for this link, per Beam's docs.
        linkSettings: {
          card: { isEnabled: true },
          cardInstallments: { isEnabled: false },
          qrPromptPay: { isEnabled: false },
          eWallets: { isEnabled: false },
          mobileBanking: { isEnabled: false },
          buyNowPayLater: { isEnabled: false },
        },
        ...(email ? { customer: { email } } : {}),
      },
      `link:${orderId}`,
    )
    const id = str(json.id)
    const url = str(json.url)
    if (!id || !url) throw new BeamApiError('POST /api/v1/payment-links', 201, 'no_link_in_response', null)
    return {
      chargeId: linkChargeId(id),
      authorizeUri: url, // pay-destination.ts:116 → top-level navigation to Beam's hosted card page
      expiresAt, // ours: Beam echoes no expiry on create; the reconciler abandons after it
      paid: false,
      status: 'pending',
      failureCode: null,
      failureMessage: null,
    }
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
    if (isLinkChargeId(chargeId)) {
      // A Payment Link row: ask about the LINK, and when it is paid, answer with the CHARGE behind it so
      // runReconcile can rebind the row to the real id before settling.
      const linkId = linkIdOf(chargeId)
      const link = await beamGet(`/api/v1/payment-links/${encodeURIComponent(linkId)}`)
      if (!link) return null
      const mapped = mapLinkStatus(link.status)
      if (!mapped.paid) return { chargeId, paid: false, status: mapped.status, failureCode: null }
      const paidCharge = await resolveLinkCharge(linkId)
      if (!paidCharge) {
        // Beam says PAID but lists no SUCCEEDED charge yet — eventual consistency; not paid, not failed.
        return { chargeId, paid: false, status: 'pending', failureCode: null }
      }
      return { chargeId: str(paidCharge.chargeId) ?? chargeId, paid: true, status: 'successful', failureCode: null }
    }
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
//   payment_link.paid → deliberately NO action: the link's own `charge.succeeded` follows (source
//                       PAYMENT_LINK, referenceId = our orderId) and THAT is what settles and rebinds the
//                       row through settleAndProvision's order_id recovery. Settling on the link event
//                       too would leave the row APPROVED under `link:…` and make the charge event look
//                       like money outside our books. So it carries no chargeId and matches nothing.
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
