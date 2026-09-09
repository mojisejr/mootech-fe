// POST /api/ops/qi — เพิ่ม/ลด QI ของผู้ใช้ (เขียนที่ engine /api/qi/admin-adjust). gate → validate → engine → audit
import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { isOpsAuthenticated, opsAdminUserId } from '@/lib/ops/gate'
import { validateQiEdit } from '@/lib/ops/qi'
import { opsEngineWrite } from '@/lib/ops/engine'
import { logOpsAction } from '@/lib/ops/audit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isOpsAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body ?? {}) as Record<string, unknown>
  const checked = validateQiEdit({ userId: body.user_id, qiDelta: body.qi_delta, note: body.note })
  if (!checked.ok) return res.status(400).json({ error: 'invalid edit', reason: checked.reason })

  const ref = `ops-${randomUUID()}`
  const r = await opsEngineWrite('POST', '/api/qi/admin-adjust', {
    anonId: checked.edit.userId,
    qiDelta: checked.edit.qiDelta,
    note: checked.edit.note,
    ref,
  })
  if (!r.ok) return res.status(r.status).json({ error: r.json?.error ?? 'engine adjust failed', qi: r.json?.qi ?? null })

  await logOpsAction({ adminUserId: opsAdminUserId(req), action: 'qi:adjust', targetUserId: checked.edit.userId, payload: { ...checked.edit, ref } })
  return res.status(200).json({ ok: true, qi: r.json?.qi ?? null, qiDelta: checked.edit.qiDelta })
}
