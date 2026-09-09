// GET /api/ops/analytics?days=30 — รวมรายได้/tier (FE) + QI economy/chat (engine) + feature usage (engine /stats)
import type { NextApiRequest, NextApiResponse } from 'next'
import { isOpsAuthenticated } from '@/lib/ops/gate'
import { getFeAnalytics } from '@/lib/ops/analytics'
import { opsEngineGet } from '@/lib/ops/engine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isOpsAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30))
  const fe = await getFeAnalytics(days)
  const engine = await opsEngineGet(`/api/ops/analytics?days=${days}`)
  return res.status(200).json({ ...fe, engine: engine.ok ? engine.json : { error: engine.json?.error ?? 'engine unavailable' } })
}
