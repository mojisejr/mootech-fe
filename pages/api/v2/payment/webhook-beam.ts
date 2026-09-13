// POST /api/v2/payment/webhook-beam — Beam Checkout → us. The SECOND unauthenticated v2 route, next to
// the Omise one (webhook.ts): its gate is Beam's HMAC signature, not the v2 cookie. Both routes exist at
// once ON PURPOSE — during the gateway switch (and any rollback) each provider keeps delivering to its own
// path, so an event that arrives after PAYMENT_GATEWAY flipped still settles or revokes its own row.
// Beam Checkout lane, CIEL workstream mootech-fe-beam-gateway-001; route shell in slice 1, codec in slice 2.
//
// 🔴 middleware.ts exempts THIS EXACT PATH in two places, mirroring the Omise route: inside guardV2 (before
// V2_PREVIEW_KEY is read) and in the maintenance allow-list. Lose either and Beam's machine is answered with
// a 200 maintenance/gate page, reads it as "delivered", and stops retrying — money moved, nobody provisioned.
// scripts/maintenance-allowlist.test.ts and scripts/v2-gate-webhook-exemption.test.ts redden if that happens.
//
// 🔴 bodyParser MUST be off — Beam signs the RAW bytes (base64 HMAC-SHA256 over the request body).
import type { NextApiRequest, NextApiResponse } from 'next'
import { GatewayNotInstalledError, webhookCodecFor } from '@/lib/payment/select-gateway'
import { dispatchChargeEvent } from '@/lib/payment/webhook-dispatch'

export const config = { api: { bodyParser: false } }

const TAG = '[v2/payment/webhook-beam]'

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
function header(req: NextApiRequest, name: string): string | null {
  const v = req.headers[name.toLowerCase()]
  return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? null) : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const raw = await readRawBody(req)

  let codec
  try {
    codec = webhookCodecFor('beam')
  } catch (e) {
    // Slice 1 ships the path and its exemptions before the adapter exists. A delivery reaching this build
    // is answered 503 — NOT 200 — so Beam keeps retrying (up to ten times) instead of believing it was
    // delivered; whoever registered a webhook against a build without the codec sees it in the log at once.
    if (e instanceof GatewayNotInstalledError) {
      console.error(`${TAG} 🔴 503 — Beam webhook delivered to a build without the Beam adapter (${raw.length} bytes). ` +
        `Nothing was verified or acted on. Deploy the build that carries lib/payment/beam-gateway.ts.`)
      return res.status(503).json({ error: 'beam gateway not installed' })
    }
    throw e
  }

  const h = (name: string) => header(req, name)
  // Fail closed: a bad/missing signature is rejected before we parse or act. No PII logged — shape only.
  if (!codec.verify(raw, h)) {
    console.error(
      `${TAG} 🔴 401 invalid signature — signature ${h('x-beam-signature') ? 'present' : 'absent'}, ` +
        `event ${h('x-beam-event') ?? '(none)'}, body ${raw.length} bytes. The HMAC key we hold is not the one ` +
        `this Lighthouse webhook signs with (keys differ per environment), or the body was re-serialised in transit.`,
    )
    return res.status(401).json({ error: 'invalid signature' })
  }

  let evt
  try {
    evt = codec.parse(raw, h)
  } catch {
    return res.status(400).json({ error: 'invalid body' })
  }

  // The same decision table the Omise route runs — one money path, two doors.
  await dispatchChargeEvent(evt, TAG)

  return res.status(200).json({ received: true })
}
