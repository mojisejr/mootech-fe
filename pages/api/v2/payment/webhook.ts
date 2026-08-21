// POST /api/v2/payment/webhook (mootech-fe#355) — Omise → us. The ONLY unauthenticated v2 route; its gate
// is the HMAC signature, not the v2 cookie (middleware exempts this exact path before reading
// V2_PREVIEW_KEY). Provisioning is at-most-once via the DB-arbitered settlement in repo.settleAndProvision.
//
// 🔴 bodyParser MUST be off — Next's Pages Router parses the JSON body by default, which re-serializes it,
// and the signature is over the RAW bytes → it would never verify (and would look like "Omise sent a bad
// signature"). We read the raw stream ourselves.
import type { NextApiRequest, NextApiResponse } from 'next'
import { omiseGateway } from '@/lib/payment/omise-gateway'
import { parseChargeEvent, isSettleable } from '@/lib/payment/gateway'
import { settleAndProvision } from '@/lib/payment/repo'

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
  // Fail closed: a bad/missing signature is rejected before we parse or act. No PII logged.
  if (!omiseGateway.verifyWebhook(raw, header(req, 'omise-signature'), header(req, 'omise-signature-timestamp'))) {
    return res.status(401).json({ error: 'invalid signature' })
  }

  let evt
  try {
    evt = parseChargeEvent(raw)
  } catch {
    return res.status(400).json({ error: 'invalid body' })
  }

  // Only a completed, paid charge provisions — and settleAndProvision is idempotent + concurrency-safe, so
  // a retry or a simultaneous duplicate delivery grants at most once.
  if (isSettleable(evt) && evt.chargeId) {
    await settleAndProvision(evt.chargeId)
  }

  return res.status(200).json({ received: true })
}
