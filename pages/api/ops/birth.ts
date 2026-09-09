// PATCH /api/ops/birth — แก้วันเกิดผู้ใช้ (ไม่หัก QI). engine /api/profile/admin + sync legacy `user`
// + ล้าง destiny cache → ดวง/ธาตุคำนวณใหม่. gate → validate → engine → legacy sync → audit
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { isOpsAuthenticated, opsAdminUserId } from '@/lib/ops/gate'
import { validateBirthEdit } from '@/lib/ops/birth'
import { opsEngineWrite } from '@/lib/ops/engine'
import { logOpsAction } from '@/lib/ops/audit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isOpsAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body ?? {}) as Record<string, unknown>
  const checked = validateBirthEdit({
    userId: body.user_id, birth: body.birth, birthTime: body.birth_time,
    timeUnknown: body.time_unknown, gender: body.gender, birthProvince: body.birth_province,
  })
  if (!checked.ok) return res.status(400).json({ error: 'invalid edit', reason: checked.reason })
  const e = checked.edit

  // 1) engine เป็นแหล่งหลัก (mergeEngineBirth อ่านตัวนี้ก่อน) — ไม่หัก QI
  const r = await opsEngineWrite('PATCH', '/api/profile/admin', {
    anonId: e.userId, birth: e.birth, birthTime: e.birthTime, timeUnknown: e.timeUnknown,
    gender: e.gender, birthProvince: e.birthProvince,
  })
  if (!r.ok) return res.status(r.status).json({ error: r.json?.error ?? 'engine profile admin failed' })

  // 2) sync legacy `user` (destiny/chat ยังอ่านตัวนี้เป็น fallback) — mirror pages/api/profile.ts
  const timeVal = e.timeUnknown ? '' : (e.birthTime ?? '')
  try {
    await db.execute(
      sql`UPDATE "user" SET dob = ${e.birth}, "time" = ${timeVal}, is_remember_time = ${!e.timeUnknown}
          ${e.gender ? sql`, gender = ${e.gender}` : sql``}
          ${e.birthProvince ? sql`, place_name = ${e.birthProvince}` : sql``}
          WHERE user_id = ${e.userId}`,
    )
  } catch { /* legacy sync best-effort — engine เป็นแหล่งหลักแล้ว */ }

  // 3) ล้าง destiny cache ของ user นี้ (วันเกิดเปลี่ยน → ดวงต้องคำนวณใหม่)
  try { await db.execute(sql`DELETE FROM "bazi_destiny_cache" WHERE user_id = ${e.userId}`) } catch { /* ตารางอาจยังไม่มี */ }

  await logOpsAction({ adminUserId: opsAdminUserId(req), action: 'birth:edit', targetUserId: e.userId, payload: e })
  return res.status(200).json({ ok: true, engineUpdated: r.json?.updated ?? null })
}
