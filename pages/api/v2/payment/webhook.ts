// POST /api/v2/payment/webhook (mootech-fe#355) — Omise → us. The ONLY unauthenticated v2 route; its gate
// is the HMAC signature, not the v2 cookie (middleware exempts this exact path before reading
// V2_PREVIEW_KEY). Provisioning is at-most-once via the DB-arbitered settlement in repo.settleAndProvision.
//
// 🔴 bodyParser MUST be off — Next's Pages Router parses the JSON body by default, which re-serializes it,
// and the signature is over the RAW bytes → it would never verify (and would look like "Omise sent a bad
// signature"). We read the raw stream ourselves.
import type { NextApiRequest, NextApiResponse } from 'next'
import { omiseGateway } from '@/lib/payment/omise-gateway'
import { parseChargeEvent } from '@/lib/payment/gateway'
import { dispatchChargeEvent } from '@/lib/payment/webhook-dispatch'
import { describeSignatureHeader } from '@/lib/payment/webhook-verify'

export const config = { api: { bodyParser: false } }

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
function header(req: NextApiRequest, name: string): string | null {
  const v = req.headers[name]
  return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? null) : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const raw = await readRawBody(req)
  const sig = header(req, 'omise-signature')
  const sigTs = header(req, 'omise-signature-timestamp')
  // Fail closed: a bad/missing signature is rejected before we parse or act. No PII logged.
  if (!omiseGateway.verifyWebhook(raw, sig, sigTs)) {
    // 🔴 #355 — the line that would have made 2026-09-09 a ten-minute diagnosis instead of a two-hour one.
    // Seven deliveries answered 401 in silence while the reconciler quietly rescued each charge, and the
    // question nobody could answer was how many signatures the header carried. It carried two, because the
    // secret had been rolled. This prints the SHAPE only — length and comma count — never the signature,
    // never the secret, never anything about the payer.
    console.error(
      `[v2/payment/webhook] 🔴 401 invalid signature — signature ${describeSignatureHeader(sig)}, ` +
        `timestamp ${sigTs ? 'present' : 'absent'}, body ${raw.length} bytes. A header with parts>1 means ` +
        `the webhook secret was rolled and both halves are being sent; parts=1 means the value we hold is ` +
        `not the one this account signs with.`,
    )
    return res.status(401).json({ error: 'invalid signature' })
  }

  let evt
  try {
    evt = parseChargeEvent(raw)
  } catch {
    return res.status(400).json({ error: 'invalid body' })
  }

  // Every branch (settle / reversal / refund / terminal failure / no-match) lives in webhook-dispatch.ts,
  // shared with the Beam route. Lifted verbatim in slice 1 of the Beam lane; behaviour is unchanged.
  await dispatchChargeEvent(evt, '[v2/payment/webhook]')

  return res.status(200).json({ received: true })
}
