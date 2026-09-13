// GET /api/v2/matching/<matching_id> — one ดวงสมพงศ์ result (#357). Replaces v1 GET /user-matching/detail.
//
// 🔴 be looked the row up by matching_id ALONE (matching.service.ts:311-327, controller.ts:35) with no
// ownership predicate, so anyone holding an id could read someone else's reading — names, birth dates and
// birth times of both people. Here the row must belong to the session's user or it is a 404.
//
// Shape is v1's, because features/v2-service/compatibility-result.ts already parses it:
//   { user, friend, result, type } where `result` is the JSON STRING stored in log_matching.result.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { mergeEngineBirth } from '@/lib/bazi-bridge/engine-birth'

type Row = {
  result: string | null
  type: string | null
  user_name: string | null
  user_surname: string | null
  user_picture_url: string | null
  user_dob: Date | string | null
  user_time: string | null
  user_is_remember_time: boolean | null
  friend_name: string | null
  friend_surname: string | null
  friend_picture_url: string | null
}

/** dob (Date|string) → 'YYYY-MM-DD' | null */
function toBirthDate(v: Date | string | null): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  return null
}

const rowsOf = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] })?.rows ?? []))

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  const raw = req.query.id
  const matchingId = (Array.isArray(raw) ? raw[0] : raw ?? '').trim()
  if (!matchingId) return res.status(400).json({ ok: false, error: 'matching id is required' })

  try {
    const result = await db.execute(sql`
      SELECT lm.result          AS result,
             um.matching_type   AS type,
             u.name             AS user_name,
             u.surname          AS user_surname,
             u.picture_url      AS user_picture_url,
             u.dob              AS user_dob,
             u."time"           AS user_time,
             u.is_remember_time AS user_is_remember_time,
             f.name             AS friend_name,
             f.surname          AS friend_surname,
             f.picture_url      AS friend_picture_url
        FROM log_matching lm
        JOIN user_matching um   ON lm.matching_id = um.id
        LEFT JOIN "user" u      ON lm.user_id = u.user_id
        LEFT JOIN member_with_friend f ON um.friend_id = f.id
       WHERE lm.matching_id = ${matchingId}
         AND lm.user_id = ${who.userId}
       LIMIT 1
    `)

    const [row] = rowsOf(result)
    // Someone else's id and a nonexistent id answer identically on purpose — a distinguishable 403 would
    // confirm that an id exists, which is the thing worth not leaking.
    if (!row) return res.status(404).json({ ok: false, error: 'not found' })

    // ตัวเรา (person A) = เจ้าของผลนี้ (บังคับด้วย lm.user_id = who.userId) → ส่งค่า "ปัจจุบัน" ของโปรไฟล์ตัวเอง
    // เพื่อให้จอผลอัปเดตตามที่ผู้ใช้แก้วันเกิด/รูป: รูปดึงจาก /api/v2/avatar (viewer-scoped, มี fallback LINE).
    // #1 (2026-09-13): วันเกิด/เวลา ต้องเป็น "วันที่บันทึกในโปรไฟล์" = engine bazi_user_profile ชนะ legacy user.dob
    // (mergeEngineBirth — แหล่งเดียวกับหน้าโปรไฟล์/ดวงของฉัน/แชท) ไม่ใช่ user.dob ดิบที่อาจ sync ไม่ตรง
    const mergedSelf = await mergeEngineBirth(who.userId, {
      dob: toBirthDate(row.user_dob) ?? '',
      time: typeof row.user_time === 'string' ? row.user_time.slice(0, 5) : '',
      is_remember_time: row.user_is_remember_time,
    })
    const selfBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(mergedSelf.dob ?? '') ? mergedSelf.dob : null
    const selfTime =
      mergedSelf.is_remember_time !== false && typeof mergedSelf.time === 'string' && /^\d{2}:\d{2}/.test(mergedSelf.time)
        ? mergedSelf.time.slice(0, 5)
        : null
    return res.status(200).json({
      user: {
        name: row.user_name,
        user_surname: row.user_surname,
        picture: '/api/v2/avatar',
        birthDate: selfBirthDate,
        time: selfTime,
      },
      friend: { name: row.friend_name, user_surname: row.friend_surname, picture: row.friend_picture_url },
      result: row.result,
      type: row.type,
    })
  } catch (e) {
    console.error('[v2][matching] detail failed:', e)
    return res.status(500).json({ ok: false, error: 'internal error' })
  }
}
