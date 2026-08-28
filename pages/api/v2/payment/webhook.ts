// POST /api/v2/payment/webhook (mootech-fe#355) — Omise → us. The ONLY unauthenticated v2 route; its gate
// is the HMAC signature, not the v2 cookie (middleware exempts this exact path before reading
// V2_PREVIEW_KEY). Provisioning is at-most-once via the DB-arbitered settlement in repo.settleAndProvision.
//
// 🔴 bodyParser MUST be off — Next's Pages Router parses the JSON body by default, which re-serializes it,
// and the signature is over the RAW bytes → it would never verify (and would look like "Omise sent a bad
// signature"). We read the raw stream ourselves.
import type { NextApiRequest, NextApiResponse } from 'next'
import { omiseGateway } from '@/lib/payment/omise-gateway'
import { parseChargeEvent, isSettleable, isTerminalFailure, isReversal } from '@/lib/payment/gateway'
import { settleAndProvision, abandonByChargeId, revokeByChargeId } from '@/lib/payment/repo'

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
    // #371 — orderId lets a paid charge find its row even when charge_id was never attached to it.
    const { outcome } = await settleAndProvision(evt.chargeId, evt.orderId)
    // 🔴 The answer to Omise stays 200 for every outcome, ON PURPOSE. The ticket warns against replying
    // non-2xx blindly, and the reason bites hardest here: a retry only helps if the cause is temporary, and
    // NO_ROW is not temporary — it means this charge is not in our books at all (a foreign charge, a wrong
    // key, a deleted row). Answering 5xx to that would make Omise retry it forever while nothing changes.
    // What must NOT stay the same is the LOG: these outcomes had one shape before, so "granted" and "money
    // we cannot account for" were indistinguishable in the one place a human would look.
    if (outcome === 'NO_ROW' || outcome === 'AMBIGUOUS') {
      console.error(
        `[v2/payment/webhook] 🔴 PAID CHARGE WITH NO USABLE ROW (${outcome}) — charge=${evt.chargeId} ` +
          `order=${evt.orderId ?? '(none)'}. Money has moved and nobody has been granted anything. ` +
          `Check this charge in the Omise dashboard against v2_payment before assuming it is not ours.`,
      )
    } else if (outcome === 'RECOVERED') {
      console.warn(
        `[v2/payment/webhook] recovered by order_id — charge=${evt.chargeId} order=${evt.orderId}. ` +
          `The row existed but never received its charge_id (attach failed, or this delivery beat it).`,
      )
    }
  } else if (isReversal(evt)) {
    // 🔴 #484 — CHECKED BEFORE isTerminalFailure ON PURPOSE. That branch answers `false` whenever the event
    // says `paid: true`, and a reversed charge WAS paid, so a reversal arriving that way would fall through
    // this whole handler and change nothing at all — not even the discount hold. Asking the narrower
    // question first makes the routing independent of a field we have never observed on a real reversal.
    const { revoked, shadowHandled } = await revokeByChargeId(evt.chargeId!)
    if (revoked && shadowHandled === 'NEEDS_HUMAN') {
      // revokeByChargeId already logged the detail. Kept as a second line here because this is the file a
      // human opens when they are looking at webhook behaviour, and a silent partial revoke is the exact
      // shape this ticket exists to end.
      console.warn(`[v2/payment/webhook] #484 reversal handled, member_payment left for a human — charge=${evt.chargeId}`)
    }
    // The discount hold still has to come off, exactly as any other terminal end (#372 ③ layer 2).
    await abandonByChargeId(evt.chargeId!)
  } else if (isTerminalFailure(evt) && evt.chargeId) {
    // 🔴 The charge ENDED without succeeding (failed/expired/reversed) ⇒ free its discount hold now instead
    // of waiting for the quote to expire (#372 ③ layer 2). An event that is merely not-finished-yet
    // (pending, or anything we don't recognise) falls through and changes nothing — releasing a slot that
    // can still be paid would let one code be spent twice.
    await abandonByChargeId(evt.chargeId)
  }

  return res.status(200).json({ received: true })
}
