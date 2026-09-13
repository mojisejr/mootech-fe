// MuMate v2 · resolve the CALLER's internal user_id from the NextAuth session (goo · #287).
//
// The identity rule (same as first-run-reset, but this is the PERMANENT home — first-run-reset.ts is
// deleted whole by #248, so #287 must not import from it):
//
//   getServerSession → session.providerId  ─(user_provider.id_token, provider)→  user_provider.user_id
//
// 🔴 The client cannot forge this. Body / query / the MEMBER_ID cookie are ALL forgeable (MEMBER_ID is
// set client-side, not httpOnly — mootech-be#16 / #252 / #273). Only the signed NextAuth JWT (httpOnly)
// is trustworthy, so the server derives user_id itself and NEVER reads it from the request.
//
// 🔴 resolveUserFromRows is NOT `rows[0]` (ตู๋, #254 B2): the match is case-INsensitive on provider, the
// app's own dedupe is case-SENSITIVE, and nothing enforces uniqueness on (id_token, provider) at the DB
// level — so two rows for one human CAN exist. On anything that reads/writes a specific user we REFUSE
// on disagreement rather than pick whichever row the planner returned.

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

export type ResolvedIdentity =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 404 | 409; error: string }

const rowsOf = (r: unknown): Array<{ user_id?: unknown }> =>
  Array.isArray(r) ? r : ((r as { rows?: Array<{ user_id?: unknown }> })?.rows ?? [])

/** Collapse the rows matched for one provider account into the ONE user_id we may act on — or refuse. */
export function resolveUserFromRows(rows: Array<{ user_id?: unknown }>): ResolvedIdentity {
  const distinct = Array.from(
    new Set(
      rows
        .map((r) => (typeof r?.user_id === 'string' ? r.user_id.trim() : ''))
        .filter((id) => id !== ''),
    ),
  )
  if (distinct.length === 0) return { ok: false, status: 404, error: 'no account for this login yet' }
  if (distinct.length > 1) return { ok: false, status: 409, error: 'identity is ambiguous' }
  return { ok: true, userId: distinct[0] }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Fallback identity (#391, 2026-09-13): some browsers (Samsung Internet tracking-prevention / Secret Mode,
 * และ webview บางตัว) ทิ้ง cookie `__Secure-next-auth.session-token` (SameSite=None; Secure) ทำให้
 * getServerSession ว่าง → ปฏิทิน/แจ้งเตือนขึ้น "ยืนยันตัวตนไม่ได้" ทั้งที่หน้าอื่น (ที่อ่าน MEMBER_ID) ยังล็อกอินอยู่.
 *
 * 🔴 `cookie-mumate-id` (= CookieKey.MEMBER_ID) ตั้งฝั่ง client ไม่ใช่ httpOnly → ปลอมได้. จึงยอมรับเป็น
 * fallback เฉพาะเมื่อ (1) รูปแบบเป็น UUID และ (2) มี user แถวนั้นจริงในฐานข้อมูล — ใช้แค่ "ระบุตัวผู้ใช้ที่
 * สมัครแล้ว" เท่านั้น ไม่ยกระดับสิทธิ์ใด ๆ. นี่เป็น identity เดียวกับที่ /api/v2/avatar, /api/profile, /api/chat/bazi
 * ใช้อยู่แล้ว.
 */
async function resolveMemberIdFallback(req: NextApiRequest): Promise<ResolvedIdentity> {
  const raw = (req.cookies?.['cookie-mumate-id'] ?? '').trim()
  if (!UUID_RE.test(raw)) return { ok: false, status: 401, error: 'not signed in' }
  try {
    const rows = rowsOf(await db.execute(sql`SELECT user_id FROM "user" WHERE user_id = ${raw} LIMIT 1`))
    return resolveUserFromRows(rows)
  } catch {
    return { ok: false, status: 401, error: 'not signed in' }
  }
}

/** Read the caller's user_id from their signed session. 401 if not signed in, 404/409 per the rows.
 *  If the session cookie is missing (e.g. dropped by the browser), fall back to the MEMBER_ID cookie (#391). */
export async function resolveSessionUserId(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<ResolvedIdentity> {
  const session = (await getServerSession(req, res, authOptions)) as
    | { providerId?: string; provider?: string }
    | null

  const providerId = (session?.providerId ?? '').trim()
  const provider = (session?.provider ?? '').trim()
  if (!providerId || !provider) return resolveMemberIdFallback(req)

  const rows = rowsOf(
    await db.execute(
      sql`SELECT user_id FROM user_provider
          WHERE id_token = ${providerId} AND lower(provider) = lower(${provider})`,
    ),
  )
  // session ถูกต้อง → เชื่อผลตามแถว (404 = ไม่มีบัญชี, 409 = กำกวม) ไม่ fallback (fallback ใช้เฉพาะกรณี "ไม่มี session")
  return resolveUserFromRows(rows)
}
