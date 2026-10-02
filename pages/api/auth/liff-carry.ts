// POST /api/auth/liff-carry — ออก "ใบส่งต่อ" ก่อนจบ session ยุค LIFF (slice 7g, ดู lib/auth/liff-carry.ts).
//
// ตัวตนมาจาก session NextAuth ที่เซ็นแล้วเท่านั้น (body ไม่ถูกอ่าน). ตอบ 204 เสมอเมื่อเรียกถูกวิธี — ไม่บอกว่าออกใบหรือไม่
// (ไม่เปิดเผยอะไรเกี่ยวกับบัญชี). ออกใบเมื่อครบทุกข้อ: session ยุค LIFF (lineProfile ไม่มี iss), sub นั้นมีเจ้าของคนเดียว,
// บัญชีนั้นสร้างในช่วง LIFF และมีแถว LINE แถวเดียว.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { resolveSignedSessionUserId } from '@/lib/v2/resolve-user'
import {
  appendSetCookie,
  CARRY_TTL_SECONDS,
  carrySetCookie,
  isInLiffWindow,
  isLiffEraLineProfile,
  isSecureDeploy,
  signCarry,
} from '@/lib/auth/liff-carry'

const rowsOf = <T>(result: unknown): T[] =>
  (Array.isArray(result) ? result : ((result as { rows?: T[] })?.rows ?? [])) as T[]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method not allowed' })
  }
  const secret = process.env.NEXTAUTH_SECRET
  try {
    const session = (await getServerSession(req, res, authOptions)) as { provider?: string; lineProfile?: unknown } | null
    if (!secret || String(session?.provider ?? '').toLowerCase() !== 'line' || !isLiffEraLineProfile(session?.lineProfile)) {
      return res.status(204).end()
    }
    const resolved = await resolveSignedSessionUserId(req, res)
    if (!resolved.ok) return res.status(204).end()

    const rows = rowsOf<{ create_at?: unknown; line_rows?: unknown }>(
      await db.execute(sql`
        SELECT u.create_at,
               (SELECT count(*) FROM user_provider p WHERE p.user_id = u.user_id AND lower(p.provider) = 'line')::int AS line_rows
        FROM "user" u WHERE u.user_id = ${resolved.userId} LIMIT 1
      `),
    )
    const row = rows[0]
    if (!row || !isInLiffWindow(String(row.create_at ?? '')) || Number(row.line_rows) !== 1) {
      return res.status(204).end()
    }

    const exp = Math.floor(Date.now() / 1000) + CARRY_TTL_SECONDS
    appendSetCookie(res, carrySetCookie(signCarry({ u: resolved.userId, exp }, secret), isSecureDeploy()))
    console.info('[liff-carry] issued')
    return res.status(204).end()
  } catch {
    // ห้ามขวางการออกจากระบบ: ล้มก็แค่ไม่มีใบ (พฤติกรรมเดิม — ถามว่าเคยใช้มาก่อนไหม)
    console.error('[liff-carry] issue failed')
    return res.status(204).end()
  }
}
