// GET /api/ops/users?q=   → ค้นหา user (ชื่อ/อีเมล/uuid)
// GET /api/ops/users?userId= → รายละเอียด: identity + tier + ประวัติ subscription (FE) + QI/profile (engine)
import type { NextApiRequest, NextApiResponse } from 'next'
import { isOpsAuthenticated } from '@/lib/ops/gate'
import { searchUsers, getUserFeData } from '@/lib/ops/users'
import { opsEngineGet } from '@/lib/ops/engine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isOpsAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : ''
  if (userId) {
    const fe = await getUserFeData(userId)
    if (!fe) return res.status(404).json({ error: 'user not found' })
    const snap = await opsEngineGet(`/api/ops/user-snapshot?anonId=${encodeURIComponent(userId)}`)
    return res.status(200).json({ ...fe, engine: snap.ok ? snap.json : { error: snap.json?.error ?? 'engine unavailable', qi: null } })
  }

  const q = typeof req.query.q === 'string' ? req.query.q : ''
  return res.status(200).json({ users: await searchUsers(q) })
}
