// MIGRATED from NestJS GET /user (-> getUserById)  (Phase 4, #mootech-fullstack-supabase-fold)
// Returns the user row PLUS a `payment` composite, matching UserService.getUserById exactly:
//   { ...user, payment: { ...member_payment, total_friend, limit_friend,
//                         limit_fortune, total_fortune, is_not_expired } }
// Uses raw SELECT * so keys stay snake_case (parity with TypeORM output). 400 if not found.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

const FORTUNE_LIMIT_FREE = 1 // be: src/constants/fortune-limit.ts FORTUNE_LIMIT.FREE

// be: UserService.isNotExpired — valid date AND today <= expiredDay (day granularity)
function isNotExpired(expired: string | null | undefined): boolean {
  if (!expired) return false
  const exp = new Date(expired)
  if (isNaN(exp.getTime())) return false
  exp.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.getTime() <= exp.getTime()
}

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const userId = (req.query.user_id as string) ?? ''
  try {
    const user = rowsOf(await db.execute(sql`SELECT * FROM "user" WHERE user_id = ${userId} LIMIT 1`))[0]
    if (!user) {
      return res.status(400).json({ status: 400, error: 'User not found.' })
    }
    // bigint columns come back as strings via postgres.js -> coerce to number (TypeORM parity)
    if (user.used_point != null) user.used_point = Number(user.used_point)
    if (user.total_point != null) user.total_point = Number(user.total_point)

    const memberPayment =
      rowsOf(await db.execute(sql`SELECT * FROM member_payment WHERE user_id = ${userId} LIMIT 1`))[0] ?? null
    const totalFriend = Number(
      rowsOf(await db.execute(sql`SELECT count(*)::int AS n FROM member_with_friend WHERE user_id = ${userId}`))[0]?.n ?? 0,
    )
    const totalFortune = Number(
      rowsOf(await db.execute(sql`SELECT count(*)::int AS n FROM fortune_telling_log WHERE user_id = ${userId}`))[0]?.n ?? 0,
    )
    const isFree = !memberPayment

    return res.status(200).json({
      ...user,
      payment: {
        ...(memberPayment ?? {}),
        total_friend: totalFriend,
        limit_friend: isFree ? 1 : 20, // be: MemberWithFriendService.getLimit(is_free)
        limit_fortune: isFree ? FORTUNE_LIMIT_FREE : null, // be: FortuneTellingService.getLimit
        total_fortune: totalFortune,
        is_not_expired: isNotExpired(memberPayment ? memberPayment.expire_at : null),
      },
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
