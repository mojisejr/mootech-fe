// /api/taisui/lantern — the wish-lantern count. GET: the count. POST: release the member's one lantern.
// The wish text never reaches the server.
import type { NextApiRequest, NextApiResponse } from 'next'

import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { isTaisuiOpen } from '@/lib/taisui/live'
import { baziJson, sameOrigin } from '@/lib/taisui/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isTaisuiOpen()) return res.status(404).json({ error: 'not_found' })
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      const r = await baziJson('/api/taisui/lantern')
      return res.status(r.status).json(r.body)
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' })
    const who = await resolveRouteMember(req, res)
    if (!who.ok) return res.status(who.status).json(who.body)
    const r = await baziJson('/api/taisui/lantern', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ anonId: who.userId }) })
    return res.status(r.status).json(r.body)
  } catch (e) {
    console.error('[taisui/lantern] failed', e instanceof Error ? e.name : 'unknown')
    return res.status(502).json({ error: 'upstream' })
  }
}
