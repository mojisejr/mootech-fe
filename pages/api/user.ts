// MIGRATED from NestJS GET /user (-> getUserById)  (Phase 4, #mootech-fullstack-supabase-fold)
// Returns the user row PLUS a `payment` composite, matching UserService.getUserById exactly:
//   { ...user, payment: { ...member_payment, total_friend, limit_friend,
//                         limit_fortune, total_fortune, is_not_expired } }
// Uses raw SELECT * so keys stay snake_case (parity with TypeORM output). 400 if not found.
// #383 additionally attaches a `membership` composite ({ isPaid, tier, source }) so a v2 screen can show
// WHICH package level a member holds, not just paid/free. It is a PURE ADDITION: every pre-existing key —
// `payment.*` included — keeps its exact value and type, and no v1 consumer reads the new one.
import type { NextApiRequest, NextApiResponse } from 'next'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberSubscription } from '@/lib/db/schema'
import { bkkDateStr, classifyMembership } from '@/lib/usage-core'
import { resolveMembershipFromRows, toSubRows, type ResolvedMembership } from '@/lib/v2/subscription'
// Bangkok-correct expiry check. The previous local copy used `new Date()` +
// `setHours()` in the SERVER's timezone — on Vercel (UTC) that flipped expiry at
// UTC midnight, ~7h off Bangkok, so members near a Bangkok day-boundary saw the
// wrong is_not_expired (paid/free) — the "แตกเป็นจุดๆ" parity drift. usage-core's
// isNotExpired mirrors the NestJS MomentService (Asia/Bangkok) and is unit-tested.
// (#mootech-fold-parity-audit)
import { isNotExpired, FREE_FRIEND_LIMIT } from '@/lib/usage-core'

const FORTUNE_LIMIT_FREE = 1 // be: src/constants/fortune-limit.ts FORTUNE_LIMIT.FREE

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

// #383 — the v2 rows for this user, issued in the SAME batch as the existing lookups.
//
// ⚠️ WHAT THAT BUYS, PRECISELY (ตู๋ T2 measured it; the first version of this comment overclaimed):
// lib/db/index.ts opens the pool with `max: 1`, so all four queries share ONE connection and postgres
// EXECUTES THEM IN ARRIVAL ORDER — they are not run in parallel. What the shared Promise.all does buy is
// that all four commands are dispatched before the first await, so this adds NO extra network round trip
// (the thing that made the old sequential awaits cost ~2s in prod — see this route's header). The added
// cost is the 4th query's own execution time, which today is an indexed lookup on a table holding 0 rows,
// and which grows with that table. Measured against origin/main on a fixture that sleeps 0.3s per table:
// 318ms → 622ms, i.e. exactly one extra query's worth — the honest number, not zero.
//
// 🔴 It owns its own catch. Everything else in this handler is wrapped by ONE try that answers 500, so a
// failure reading the v2 table would take down /api/user — the route every v1 page that takes real money
// depends on — for a key none of them read. On failure the composite is `null` = NOT DETERMINED, which is
// the same contract as computeTier's null: a caller must never read it as free.
async function readSubRows(userId: string) {
  try {
    return toSubRows(
      await db.select().from(memberSubscription).where(eq(memberSubscription.userId, userId)),
    )
  } catch (e: any) {
    console.error(`[api/user] v2 membership lookup failed — returning membership: null (not "free"):`, e?.message ?? e)
    return null
  }
}

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

    // The 3 remaining lookups are independent of each other — fire them together instead of
    // awaiting in series. postgres.js pipelines them over the pool so we pay ~1 round-trip
    // instead of 3 (the old sequential awaits stacked ~2s of latency in prod). Same queries
    // and same results as before — only the await became parallel. (#mootech-latency-user-fold)
    const [memberPaymentRows, totalFriendRows, totalFortuneRows, subRows] = await Promise.all([
      db.execute(sql`SELECT * FROM member_payment WHERE user_id = ${userId} LIMIT 1`),
      db.execute(sql`SELECT count(*)::int AS n FROM member_with_friend WHERE user_id = ${userId}`),
      db.execute(sql`SELECT count(*)::int AS n FROM fortune_telling_log WHERE user_id = ${userId}`),
      readSubRows(userId), // #383 — 4th query, dispatched in the same batch: no extra round trip (see above)
    ])
    const memberPayment = rowsOf(memberPaymentRows)[0] ?? null
    const totalFriend = Number(rowsOf(totalFriendRows)[0]?.n ?? 0)
    const totalFortune = Number(rowsOf(totalFortuneRows)[0]?.n ?? 0)
    const isFree = !memberPayment

    // #383 — the named-tier verdict, from the ONE shared rule (lib/v2/subscription). The legacy half is
    // classified from the member_payment row ALREADY fetched above, so this adds no second read of it.
    // 🔴 memberPayment comes from a raw `SELECT *` → snake_case keys; classifyMembership takes the drizzle
    // (camelCase) shape. Handing it the raw row would silently classify EVERY legacy member as NO_PLAN —
    // i.e. every paying member of today would read `isPaid: false`. Hence the explicit mapping.
    const now = new Date()
    const membership: ResolvedMembership | null =
      subRows === null
        ? null
        : resolveMembershipFromRows(
            subRows,
            bkkDateStr(now),
            classifyMembership(
              memberPayment
                ? { planCode: memberPayment.plan_code, expireAt: memberPayment.expire_at }
                : null,
              now,
            ),
          )

    return res.status(200).json({
      ...user,
      payment: {
        ...(memberPayment ?? {}),
        total_friend: totalFriend,
        // This is the friend ceiling the FE add-friend button gates on (matching/index.tsx:128 ->
        // total_friend >= limit_friend). Prod reads THIS route, not NestJS — so the free value must be
        // the shared FREE_FRIEND_LIMIT (#262), else the 20 ceiling in usage.ts is invisible to the user.
        limit_friend: isFree ? FREE_FRIEND_LIMIT : 20,
        limit_fortune: isFree ? FORTUNE_LIMIT_FREE : null, // be: FortuneTellingService.getLimit
        total_fortune: totalFortune,
        is_not_expired: isNotExpired(memberPayment ? memberPayment.expire_at : null),
      },
      // #383 — NEW key, camelCase because it is a v2 composite (the snake_case above exists for TypeORM
      // parity; nothing here needs that). `null` = NOT DETERMINED, never "free".
      membership,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
