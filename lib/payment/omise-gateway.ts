// Omise adapter for the PaymentGateway port (mootech-fe#355). Talks to the Omise REST API directly with
// fetch (no `omise` npm dep added), Basic-auth with the SECRET key server-side. The client already
// tokenized the card via cdn.omise.co/omise.js (_document.tsx) — the card number never reaches us.
//
// 🔴 No PII logs: on failure we surface Omise's error code/status only, never the request body / email /
// token / charge row (#355 ④).
import { verifyOmiseSignature } from './webhook-verify'
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

export const omiseGateway: PaymentGateway = {
  async createCardCharge({ amountSatang, token, email, orderId }): Promise<ChargeResult> {
    const json = await omisePost('/charges', {
      amount: String(amountSatang),
      currency: 'thb',
      card: token,
      email,
      receipt: 'true',
      'metadata[orderId]': orderId,
      ...(process.env.OMISE_RETURN_URI ? { return_uri: process.env.OMISE_RETURN_URI } : {}),
    })
    return { chargeId: String(json.id) }
  },

  async createPromptPayCharge({ amountSatang, email, orderId }): Promise<ChargeResult> {
    const source = await omisePost('/sources', {
      type: 'promptpay',
      amount: String(amountSatang),
      currency: 'thb',
    })
    const charge = await omisePost('/charges', {
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
    return { chargeId: String(charge.id), qrDownloadUri: typeof qr === 'string' ? qr : undefined }
  },

  verifyWebhook(rawBody, signature, timestamp): boolean {
    // base64 webhook secret → HMAC key (see webhook-verify). Fails closed when unset.
    return verifyOmiseSignature(rawBody, signature, timestamp, process.env.OMISE_WEBHOOK_SECRET)
  },
}
