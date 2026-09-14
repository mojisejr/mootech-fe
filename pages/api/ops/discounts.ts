// GET/POST/PATCH /api/ops/discounts (#2 คูปอง Phase 1) — สร้าง/ดู/หยุด โค้ดส่วนลด (discount_code).
// Gated by ops_access (isOpsAuthenticated, fail-closed) เหมือน /api/ops/packages — เช็คก่อน parse.
import type { NextApiRequest, NextApiResponse } from 'next'
import { isOpsAuthenticated, opsAdminUserId } from '@/lib/ops/gate'
import { listDiscounts, validateCreate, createDiscount, setStatus } from '@/lib/ops/discounts'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isOpsAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'GET') {
    return res.status(200).json({ discounts: await listDiscounts() })
  }

  if (req.method === 'POST') {
    const checked = validateCreate((req.body ?? {}) as Record<string, unknown>)
    if (!checked.ok) return res.status(400).json({ error: 'invalid', reason: checked.reason })
    const created = await createDiscount(checked.value, opsAdminUserId(req))
    if (!created.ok) return res.status(409).json({ error: 'create failed', reason: created.reason })
    return res.status(200).json({ ok: true, id: created.id, discounts: await listDiscounts() })
  }

  if (req.method === 'PATCH') {
    const body = (req.body ?? {}) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : ''
    const status = body.status === 'PAUSED' ? 'PAUSED' : body.status === 'ACTIVE' ? 'ACTIVE' : body.status === 'EXPIRED' ? 'EXPIRED' : null
    if (!id || !status) return res.status(400).json({ error: 'id + status required' })
    const ok = await setStatus(id, status)
    if (!ok) return res.status(404).json({ error: 'unknown id' })
    return res.status(200).json({ ok: true, discounts: await listDiscounts() })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
