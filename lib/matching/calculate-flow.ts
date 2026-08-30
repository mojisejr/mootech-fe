// ดวงสมพงษ์ compute + persist, moved off mootech-be (#357). The route (pages/api/v2/matching/calculate.ts)
// is a thin shell around this; the pure reshape lives in ./bazi-pair-match.mapper, the engine call in
// ./bazi-client, and the quota decision in @/lib/usage.
//
// ORDER, and why each step sits where it does — it mirrors mootech-be matching.service.ts:93-226:
//   1. quota gate BEFORE the engine call (:100-120), so a user who is out never costs us an engine call
//   2. engine call
//   3. every write AFTER a successful compute (be: `if (resultMatching && resultMatching.result)` :185)
// 🔴 Step 3 is what makes the DoD's "engine down must not charge quota" true: quota is COUNTED from
// user_matching rows, and the user_matching row is only inserted once bazi has answered. There is no
// separate counter to get out of step.
//
// 🔴 #358 Phase 6 ADDED A SECOND QUOTA CHECK, and the two are not redundant:
//   the check at step 1  is CHEAP and ADVISORY — it exists so a user who is already out never costs an
//                        engine call. It cannot bind, because ~7s of engine call happens after it.
//   the check at step 5  is the one that BINDS. It re-counts inside the write transaction, under a
//                        per-user advisory lock, so concurrent presses queue and each one sees the rows
//                        the previous one actually wrote.
// Without the second, 20 simultaneous presses all read the same count and all insert — the shape
// mootech-be#21 measured on prod, where 454 users ended up past their ceiling. Without the first, being
// out of quota would still cost an engine call every time.
// ⚠️ The cost is explicit: a burst CAN pay for engine calls whose rows are then refused. The alternative
// — holding the lock across the engine call — serialises one user's presses at ~7s each while holding a
// pooled connection, which trades a rare overspend for a routine connection famine.
//
// 🔴 be silently falls back to the legacy table compute when bazi fails (chinese-horoscope.service.ts:1085).
// FE has no legacy tables and #357's DoD asks for the opposite — an error the user can tell apart from
// "โควตาเต็ม". So `engine-down` and `quota` are DIFFERENT outcomes here, and only `quota` is the user's fault.
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logActivity, logLoveMate, logMatching, logWorkVibe, memberWithFriend, user, userMatching } from '@/lib/db/schema'
import { AI_MSG, bkkTimestamp } from '@/lib/usage'
import { resolveSubscription } from '@/lib/v2/subscription'
import { compatibilityCeilingFor, countCompatibilityInMonth, lockCompatibilityFor } from '@/lib/v2/compat-quota'
import { BaziEngineError, fetchBaziPairMatch } from './bazi-client'
import { mapPairMatchToComputeResult, toPairMatchRequest } from './bazi-pair-match.mapper'
import type { MatchingType } from './bazi-pair.types'

// The two types v2 offers plus the two legacy ones history rows may still carry
// (features/v2-service/compatibility-recent.ts:23-26 labels only LOVE + FRIEND, but the engine and the
// legacy vocabulary accept all four, so the gate here accepts what the engine accepts).
const MATCHING_TYPES: readonly MatchingType[] = ['LOVE', 'BOSS', 'EMPLOYEE', 'FRIEND']

export function isMatchingType(v: unknown): v is MatchingType {
  return typeof v === 'string' && (MATCHING_TYPES as readonly string[]).includes(v)
}

// 'LOVE' writes log_love_mate and spends the love-mate activity; the other three write log_work_vibe.
// Mirrors be's split across compatibilityLove (:1096) and compatibilityWork (:1171).
function isLoveDomain(type: MatchingType): boolean {
  return type === 'LOVE'
}

// be's updateLoveMate/updateWorkVibes: +10 used_point on the user row and a log_activity row at -10.
// 🔴 The activity_id is NOT shared between them — ตู๋ caught this at review, I had read only one half:
//   chinese-horoscope.service.ts:1121  LOVE                  → updateLoveMate  → activity_id 2 (user.service.ts:900)
//   chinese-horoscope.service.ts:1199  BOSS/EMPLOYEE/FRIEND  → updateWorkVibes → activity_id 3 (user.service.ts:874)
// It reaches a screen: pages/api/log-activity.ts:24 joins activity_id to activity.description and
// pages/profile/activity/index.tsx:221 renders that name, so one constant would label three of the four
// types as the fourth. scripts/matching-activity-id.test.ts holds the split.
//
// `used_point` is on screen today — pages/profile/index.tsx:556 renders {usedPoint}/{totalPoint} — so
// dropping the +10 would make the same action move the counter on v1 and not on v2. Reproduced for
// parity; changing the points economy is #358's business (recorded there), not a side effect of moving a pipe.
const LOVE_ACTIVITY_ID = 2
const WORK_ACTIVITY_ID = 3
const MATCHING_POINT_COST = 10

/** The point-log activity id for a matching type, split exactly as be splits it. */
export function activityIdFor(type: MatchingType): number {
  return isLoveDomain(type) ? LOVE_ACTIVITY_ID : WORK_ACTIVITY_ID
}

export type CalculateOutcome =
  | { ok: true; matchingId: string; result: unknown }
  | { ok: false; kind: 'quota'; message: string }
  | { ok: false; kind: 'no-friend' }
  | { ok: false; kind: 'unusable-birth' }
  | { ok: false; kind: 'engine-down'; detail: string }

/**
 * Thrown INSIDE the write transaction when the binding quota check loses a race, purely to roll it back.
 * It never escapes this module: `runCalculateMatching` converts it into the ordinary `quota` outcome, so
 * a caller cannot tell a race from a plain refusal — and should not, because to the user they are the
 * same event. A dedicated class rather than a flag alone, so an UNEXPECTED throw is never read as a
 * refusal: the flag says which one we meant, the class proves it came from here.
 */
class QuotaRaceLost extends Error {
  constructor() {
    super('compatibility quota reached while this request was in flight')
    this.name = 'QuotaRaceLost'
  }
}

export async function runCalculateMatching(params: {
  userId: string
  friendId: string
  matchingType: MatchingType
  now?: Date
}): Promise<CalculateOutcome> {
  const now = params.now ?? new Date()

  // 1. quota (advisory) — the LEVEL's monthly ceiling, from lib/v2/entitlement.ts via lib/v2/compat-quota.
  // A membership we cannot read spends FREE: the same fail-closed reading pages/api/v2/calendar-month.ts
  // and pages/api/v2/day-detail.ts:82 use, so a lookup outage never hands out a bigger allowance.
  let verdict: { isPaid: boolean | null; tier: string | null } = { isPaid: false, tier: null }
  try {
    const v = await resolveSubscription(params.userId)
    verdict = { isPaid: v.isPaid, tier: v.tier }
  } catch {
    verdict = { isPaid: false, tier: null }
  }
  const ceiling = compatibilityCeilingFor(verdict)
  if (ceiling !== null && (await countCompatibilityInMonth(params.userId, now)) >= ceiling) {
    return { ok: false, kind: 'quota', message: AI_MSG.OUT_OF_LIMIT_ALL }
  }

  // 2. the two people. 🔴 The friend is scoped to the CALLER — be read member_with_friend by id alone
  //    (matching.service.ts:139), so any id could be matched against. The session owns the user_id here,
  //    so the friend must belong to that same user or there is nothing to compute.
  const [me] = await db.select().from(user).where(eq(user.userId, params.userId)).limit(1)
  const [friend] = await db
    .select()
    .from(memberWithFriend)
    .where(and(eq(memberWithFriend.id, params.friendId), eq(memberWithFriend.userId, params.userId)))
    .limit(1)
  if (!me || !friend) {
    return { ok: false, kind: 'no-friend' }
  }

  // 3. build the engine request. null = a birth DATE we cannot use; be would have fallen through to the
  //    legacy tables here, FE has none, so say so rather than return a zero score.
  const req = toPairMatchRequest(
    { name: me.name ?? '', gender: me.gender ?? '', dob: me.dob, time: me.time ?? '' },
    { name: friend.name ?? '', gender: friend.gender ?? '', dob: friend.dob, time: friend.time ?? '' },
    params.matchingType,
  )
  if (!req) {
    return { ok: false, kind: 'unusable-birth' }
  }

  // 4. the engine. Any failure is 'engine-down' — never a quota answer, and nothing is written, so no
  //    quota is spent (see the header note).
  let mapped
  try {
    const resp = await fetchBaziPairMatch(req)
    mapped = mapPairMatchToComputeResult(resp, params.matchingType)
  } catch (e) {
    const detail = e instanceof BaziEngineError ? e.message : String((e as Error)?.message ?? e)
    return { ok: false, kind: 'engine-down', detail }
  }
  if (mapped.result?.score == null) {
    // be treats a score-less answer as "engine did not really answer" (chinese-horoscope.service.ts:1083)
    return { ok: false, kind: 'engine-down', detail: 'bazi returned no score' }
  }

  // 5. the writes — all five be performs on this path, in one transaction so a partial run cannot leave a
  //    charged quota with no readable result (be had no transaction; this is strictly safer and changes no
  //    value). user_matching.id is a varchar(36) with no DB default — be's TypeORM generated it, so we do.
  const matchingId = crypto.randomUUID()
  const createAt = bkkTimestamp(now)
  const meRemembersTime = !!(me.time && me.time !== '')
  const friendRemembersTime = !!(friend.time && friend.time !== '')
  const resultJson = JSON.stringify(mapped)

  // 5b. THE BINDING QUOTA CHECK. Everything from the lock to the commit is one serialised unit per user,
  // so the count below already includes any row a concurrent press committed. Throwing rolls the whole
  // transaction back: no user_matching row, no log rows, no points — the press simply did not happen.
  let refusedByQuota = false
  try {
    await db.transaction(async (tx) => {
      if (ceiling !== null) {
        await lockCompatibilityFor(tx, params.userId)
        if ((await countCompatibilityInMonth(params.userId, now, tx)) >= ceiling) {
          refusedByQuota = true
          throw new QuotaRaceLost()
        }
      }

      await tx.insert(userMatching).values({
        id: matchingId,
        userId: params.userId,
        friendId: params.friendId,
        matchingType: params.matchingType,
        createAt,
      })

      await tx.insert(logMatching).values({
        matchingId,
        userId: params.userId,
        createat: createAt,
        type: params.matchingType,
        name: me.name ?? '',
        dob: me.dob,
        time: me.time ?? '',
        isRememberTime: meRemembersTime,
        gender: me.gender ?? null,
        yourName: friend.name ?? '',
        yourDob: friend.dob,
        yourTime: friend.time ?? '',
        yourIsRememberTime: friendRemembersTime,
        yourGender: friend.gender ?? null,
        result: resultJson,
        friendId: params.friendId,
      })

      const mateRow = {
        createat: createAt,
        name: me.name ?? '',
        dob: me.dob,
        time: me.time ?? '',
        isRememberTime: meRemembersTime,
        gender: me.gender ?? null,
        yourName: friend.name ?? '',
        yourDob: friend.dob,
        yourTime: friend.time ?? '',
        yourIsRememberTime: friendRemembersTime,
        yourGender: friend.gender ?? null,
        // be passes only `result` (the v1 block) to these two log tables, NOT the whole compute object —
        // chinese-horoscope.service.ts:1110 / :1197 send `baziLove.result`. Kept identical.
        result: JSON.stringify(mapped.result),
        userId: params.userId,
      }
      if (isLoveDomain(params.matchingType)) {
        await tx.insert(logLoveMate).values(mateRow)
      } else {
        await tx.insert(logWorkVibe).values({ ...mateRow, type: params.matchingType })
      }

      await tx
        .update(user)
        .set({ usedPoint: sql`${user.usedPoint} + ${MATCHING_POINT_COST}` })
        .where(eq(user.userId, params.userId))

      await tx.insert(logActivity).values({
        createat: createAt,
        activityId: activityIdFor(params.matchingType),
        point: -MATCHING_POINT_COST,
        userId: params.userId,
      })
    })
  } catch (e) {
    // 🔴 Only OUR sentinel becomes a refusal. Anything else is a real database failure and must keep
    // travelling: swallowing it here would report "โควตาเต็ม" for a dead connection, which is the #263
    // bug (blaming the user's ceiling for our own outage) rebuilt one layer down.
    if (refusedByQuota && e instanceof QuotaRaceLost) {
      return { ok: false, kind: 'quota', message: AI_MSG.OUT_OF_LIMIT_ALL }
    }
    throw e
  }

  return { ok: true, matchingId, result: mapped }
}
