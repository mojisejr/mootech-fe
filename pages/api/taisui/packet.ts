// POST /api/taisui/packet — open a red packet: a random 5 to 10 QI for the logged-in receiver, once per
// sender, under the daily caps bazi enforces (plan revision 0.8).
import type { NextApiRequest, NextApiResponse } from 'next'

import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { REFERRAL_CODE_RE } from '@/lib/v2/referral-code'
import { isTaisuiOpen } from '@/lib/taisui/live'
import { baziJson, sameOrigin } from '@/lib/taisui/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isTaisuiOpen()) return res.status(404).json({ error: 'not_found' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' })
  res.setHeader('Cache-Control', 'no-store')
  const code = String((req.body ?? {}).code ?? '').trim().toUpperCase()
  if (!REFERRAL_CODE_RE.test(code)) return res.status(400).json({ error: 'invalid_code' })
  const who = await resolveRouteMember(req, res)
  if (!who.ok) return res.status(who.status).json(who.body)
  try {
    const r = await baziJson('/api/taisui/packet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ anonId: who.userId, code }) })
    return res.status(r.status).json(r.body)
  } catch (e) {
    console.error('[taisui/packet] failed', e instanceof Error ? e.name : 'unknown')
    return res.status(502).json({ error: 'upstream' })
  }
}
