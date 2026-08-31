// v2 ดวงสมพงษ์ quota (mojisejr/mootech-fe#358 Phase 6) — the LEVEL's monthly ceiling, and the count that
// answers it. The numbers themselves live in exactly one place, lib/v2/entitlement.ts; nothing here
// restates one.
//
// 🔴 WHY THIS IS NOT AN EDIT TO lib/usage.ts. Those functions mirror mootech-be's own ceilings for the v1
// lane and `lib/usage-core.ts:30-35` says in as many words that changing one makes the v1 indicator lie
// ("เหลือ X" while BE still allows 100). v1 keeps its year window and its 100. This is the v2 lane's own
// gate, and the two never share a number.
//
// 🔴 TWO THINGS CHANGE AT ONCE, and they are independent:
//   the CEILING   100-per-year-for-free-only  →  2 / 20 / unlimited by level   (features/v2-shop/packages.ts)
//   the WINDOW    calendar YEAR               →  calendar MONTH, no carry-over (ฟีมเคาะ 2026-08-30, #358)
// Either one alone would be wrong: the levels without the window would give PLUS 20 for a whole year, and
// the window without the levels would give a free user 100 EVERY month.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userMatching } from '@/lib/db/schema'
import { monthWindow, monthResetAt, quotaRemaining, type QuotaRemaining } from '@/lib/usage-core'
import { entitlementTierOf, monthlyQuotaFor, type MembershipVerdictLike, type Tier } from '@/lib/v2/entitlement'

/** Anything with `.select()` — the pooled client, or a transaction handle so a count can run under a lock. */
type Reader = Pick<typeof db, 'select'>

/**
 * The monthly ceiling this membership verdict spends. `null` = unlimited.
 *
 * One line, and it is a composition of two functions that already exist: the verdict → level mapping is
 * `entitlementTierOf` (the same one both calendar routes go through) and the level → number mapping is the
 * table. A second copy of either is the seam #358 exists to remove.
 */
export function compatibilityCeilingFor(verdict: MembershipVerdictLike): number | null {
  return monthlyQuotaFor(entitlementTierOf(verdict), 'compatibility')
}

/**
 * The caller's `user_matching` rows inside the current Asia/Bangkok calendar month.
 *
 * 🔴 EVERY matching type counts against ONE ceiling. The shop card sells "ดวงสมพงษ์ การงาน + ความรัก
 * 2 match" as a single allowance (features/v2-shop/packages.ts), not two — so `love` and `colleague` draw
 * on the same pool and this query deliberately does not filter on `matching_type`. A per-kind count would
 * hand a FREE user 2 of each.
 *
 * `conn` exists so the SAME query can run inside the write transaction under the advisory lock. If the
 * pre-check and the post-check ever counted different things, the lock would be guarding the wrong number.
 */
export async function countCompatibilityInMonth(userId: string, now: Date = new Date(), conn: Reader = db): Promise<number> {
  const { start, end } = monthWindow(now)
  const [row] = await conn
    .select({ n: sql<number>`count(*)::int` })
    .from(userMatching)
    .where(and(eq(userMatching.userId, userId), gte(userMatching.createAt, start), lte(userMatching.createAt, end)))
  return row?.n ?? 0
}

/**
 * The pre-click indicator's view of the same rule — the REMAINDER, from the same ceiling and the same
 * window the gate uses, so the screen cannot say "เหลือ 2" while the server refuses.
 *
 * ⚠️ `isFree: false` is a SELECTOR, not a claim about this user. `quotaRemaining` was written for v1's
 * two-state world (free vs member); v2 has three levels and the level has ALREADY been resolved into
 * `ceiling` by the line above. Passing `false` picks `limitMember`, which is where that resolved ceiling
 * is. `limitFree` is unreachable and is 0 rather than a number a reader could mistake for a rule.
 */
export type CompatQuotaView = QuotaRemaining & {
  /**
   * '2026-09-01' — the first day this allowance is back, from `monthResetAt`, which derives it from the
   * SAME `monthWindow` the count above uses.
   *
   * 🔴 #557 — this field exists so the screen can stop typing the period by hand. The refusal used to read
   * "ครบแล้วสำหรับปีนี้" with a comment above it citing a verified BE fact; the fact expired when #358
   * Phase 6 moved this lane to a calendar month, and nothing made the sentence red. A DATE that travels
   * from the window cannot drift from it: change the window and the sentence changes with it.
   */
  resetAt: string
  /** Which ceiling this is — the screen may say WHY the number is what it is; it could not before. */
  tier: Tier
}

export async function compatibilityQuotaView(
  verdict: MembershipVerdictLike,
  userId: string,
  now: Date = new Date(),
): Promise<CompatQuotaView> {
  const ceiling = compatibilityCeilingFor(verdict)
  const used = await countCompatibilityInMonth(userId, now)
  return {
    ...quotaRemaining({ isFree: false, used, limitFree: 0, limitMember: ceiling }),
    resetAt: monthResetAt(now),
    tier: entitlementTierOf(verdict),
  }
}

/**
 * Serialise one user's compatibility writes for the rest of the transaction.
 *
 * 🔴 WHY A LOCK AND NOT A CONSTRAINT. The rule is "at most N rows in a month window", which no unique
 * index can express — there is no column whose duplication we are forbidding. `mootech-be#21` measured
 * 454 users past their ceiling on prod through exactly this shape: count, decide, and insert with nothing
 * holding the gap.
 *
 * 🔴 xact, NEVER `pg_advisory_lock`. lib/db/index.ts connects through Supabase's TRANSACTION pooler, where
 * a connection is handed to someone else the moment a transaction ends — a session-level lock would be
 * released on a connection this request no longer owns, or held on one that a stranger inherits.
 * `pg_advisory_xact_lock` is released by the commit itself, which is the only unit of ownership the pooler
 * respects.
 *
 * The key is derived from the user id alone, so two different users never wait for each other.
 */
export async function lockCompatibilityFor(tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }, userId: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`)
}
