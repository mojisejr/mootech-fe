// Omise adapter for the PaymentGateway port (mootech-fe#355). Talks to the Omise REST API directly with
// fetch (no `omise` npm dep added), Basic-auth with the SECRET key server-side. The client already
// tokenized the card via cdn.omise.co/omise.js (_document.tsx) — the card number never reaches us.
//
// 🔴 No PII logs: on failure we surface Omise's error code/status only, never the request body / email /
// token / charge row (#355 ④).
import { verifyOmiseSignature } from './webhook-verify'
import { webhookEndpointFields } from './webhook-endpoint'
import type { PaymentGateway, ChargeResult } from './gateway'

const OMISE_API = 'https://api.omise.co'

function secretKey(): string {
  const k = process.env.OMISE_SECRET_KEY
  if (!k) throw new Error('OMISE_SECRET_KEY is not configured') // fail loud before any charge
  return k
}
function authHeader(): string {
  return 'Basic ' + Buffer.from(`${secretKey()}:`).toString('base64')
}

// POST form-encoded to Omise; returns the parsed JSON. Throws a NON-PII error on a non-2xx or Omise error
// object (message carries only Omise's own code, no user data).
// GET one object from Omise (#360 — the reconciler's read path). Same non-PII error discipline as the
// POST helper: the message carries Omise's own code and nothing about the payer.
async function omiseGet(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${OMISE_API}${path}`, { headers: { Authorization: authHeader() } })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 404) return null // the gateway has never heard of this charge
  if (!res.ok || json?.object === 'error') {
    const code = typeof json?.code === 'string' ? json.code : `http_${res.status}`
    throw new Error(`omise GET ${path} failed: ${code}`)
  }
  return json
}

async function omisePost(path: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${OMISE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(form).toString(),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || json?.object === 'error') {
    const code = typeof json?.code === 'string' ? json.code : `http_${res.status}`
    throw new Error(`omise ${path} failed: ${code}`)
  }
  return json
}

// 🔴 #437 — one place that reads the gateway's own verdict off a /charges response, used by BOTH lanes.
// Before this, `createCardCharge` returned `{ chargeId: String(json.id) }` and dropped everything else, so
// a declined card was indistinguishable from a pending one all the way to the user's screen.
// Fields stay optional-shaped: Omise omits `failure_code` entirely on a charge that has not failed.
function readOutcome(json: Record<string, unknown>): Pick<ChargeResult, 'status' | 'paid' | 'failureCode' | 'failureMessage'> {
  return {
    status: typeof json.status === 'string' ? json.status : undefined,
    paid: json.paid === true,
    failureCode: typeof json.failure_code === 'string' ? json.failure_code : null,
    failureMessage: typeof json.failure_message === 'string' ? json.failure_message : null,
  }
}

export const omiseGateway: PaymentGateway = {
  async createCardCharge({ amountSatang, token, email, orderId }): Promise<ChargeResult> {
    // #374 — resolved BEFORE the POST so a misconfigured endpoint fails here, never after a card is charged.
    const webhook = webhookEndpointFields()
    const json = await omisePost('/charges', {
      ...webhook,
      amount: String(amountSatang),
      currency: 'thb',
      card: token,
      email,
      receipt: 'true',
      'metadata[orderId]': orderId,
      ...(process.env.OMISE_RETURN_URI ? { return_uri: process.env.OMISE_RETURN_URI } : {}),
    })
    return { chargeId: String(json.id), ...readOutcome(json) }
  },

  async createPromptPayCharge({ amountSatang, email, orderId }): Promise<ChargeResult> {
    // #374 — resolved BEFORE /sources: a bad endpoint must not leave an orphan source behind, and must
    // never reach the point where a QR is shown to someone who could then pay into a charge we cannot hear
    // about. `webhook_endpoints` goes on the CHARGE (the source carries no events of its own).
    const webhook = webhookEndpointFields()
    const source = await omisePost('/sources', {
      type: 'promptpay',
      amount: String(amountSatang),
      currency: 'thb',
    })
    const charge = await omisePost('/charges', {
      ...webhook,
      amount: String(amountSatang),
      currency: 'thb',
      source: String(source.id),
      email,
      receipt: 'true',
      'metadata[orderId]': orderId,
      ...(process.env.OMISE_RETURN_URI ? { return_uri: process.env.OMISE_RETURN_URI } : {}),
    })
    // QR lives at charge.source.scannable_code.image.download_uri
    const src = (charge.source ?? {}) as {
      scannable_code?: { image?: { download_uri?: unknown } }
    }
    const qr = src.scannable_code?.image?.download_uri
    return { chargeId: String(charge.id), qrDownloadUri: typeof qr === 'string' ? qr : undefined, ...readOutcome(charge) }
  },

  async retrieveCharge(chargeId: string) {
    // 🔴 THROWS on a transport/auth failure instead of returning null. A reconciler that reads "the gateway
    // is unreachable" as "this charge is not paid" would walk past real money every time Omise hiccups —
    // and it would do it silently, once per cron run, forever. Only a real 404 means "not ours".
    const json = await omiseGet(`/charges/${encodeURIComponent(chargeId)}`)
    if (!json) return null
    return {
      chargeId: typeof json.id === 'string' ? json.id : chargeId,
      paid: json.paid === true,
      status: typeof json.status === 'string' ? json.status : '',
    }
  },

  verifyWebhook(rawBody, signature, timestamp): boolean {
    // base64 webhook secret → HMAC key (see webhook-verify). Fails closed when unset.
    return verifyOmiseSignature(rawBody, signature, timestamp, process.env.OMISE_WEBHOOK_SECRET)
  },
}
