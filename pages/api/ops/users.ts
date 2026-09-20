// GET /api/ops/users?q=   → ค้นหา user (ชื่อ/อีเมล/uuid)
// GET /api/ops/users?userId= → รายละเอียด: identity + tier + ประวัติ subscription (FE) + QI/profile (engine)
// DELETE /api/ops/users  { user_id } → ลบ identity (user_provider + subscription + user) ให้กลับเป็น "คนใหม่"
//   ใช้เทสต์สมัคร LINE ซ้ำ. ไม่แตะ engine (ข้อมูล engine ผูก anonId เดิม → กำพร้าเอง ไม่ชนกับ user_id ใหม่).
import type { NextApiRequest, NextApiResponse } from 'next'
import { isOpsAuthenticated } from '@/lib/ops/gate'
import { searchUsers, getUserFeData } from '@/lib/ops/users'
import { deleteUserIdentity } from '@/lib/ops/delete-user'
import { opsEngineGet } from '@/lib/ops/engine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isOpsAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'DELETE') {
    const bodyId = typeof req.body?.user_id === 'string' ? req.body.user_id.trim() : ''
    const queryId = typeof req.query.userId === 'string' ? req.query.userId.trim() : ''
    const userId = bodyId || queryId
    if (!userId) return res.status(400).json({ error: 'user_id required' })

    // ต้องมีจริงก่อนลบ (กันพิมพ์ id มั่ว) — และคืนชื่อ/provider ไว้ยืนยันใน log/UI
    const fe = await getUserFeData(userId)
    if (!fe) return res.status(404).json({ error: 'user not found' })

    const deleted = await deleteUserIdentity(userId)
    return res.status(200).json({ ok: true, userId, deleted })
  }

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
