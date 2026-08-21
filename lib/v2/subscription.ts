// v2 membership READ seam (mootech-fe#354, Phase 2 of #352) — the ONE place that answers "what tier is
// this user?" by reading the NEW member_subscription store FIRST and falling back to the legacy
// member_payment store, so the 24 existing members keep reading exactly as before while new v2 rows take
// precedence. This module only READS (the writer is Phase 3, #355).
//
// Two rules live here, both spelled out because the new table intentionally allows MANY rows per user:
//   ① selection — of a user's rows, pick the ACTIVE one still valid today, newest first, DETERMINISTICALLY
//      (a plain LIMIT 1 without ORDER BY returns "whichever row the planner found first" — changes after
//       writes/vacuum; #254 B2 is the same bug on the old table). Expiry is decided at READ time, not by a
//       background job (Phase 2 has no writer/cron to flip status) — a row past expire_at is not selectable.
//   ② fallback — no live v2 row ⇒ the legacy member_payment verdict, computed by the SAME classifyMembership
//      the v1 path uses (reused, not re-derived — #354). So deleting a v2 row drops a member back to their
//      member_payment membership, NEVER to free (the DoD teeth).
import { and, eq, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberSubscription } from '@/lib/db/schema'
import { bkkDateStr, type MembershipReason } from '@/lib/usage-core'
import { resolveMembership } from '@/lib/usage'
import { tierIsPaid, type TierCode } from './tier'

export type MembershipSource = 'v2' | 'legacy' | 'none'
export type ResolvedMembership = {
  /** true = paid · false = KNOWN not-paid. Server read = always determined (no null here; the null
   *  "not yet determined" state is a client-loading concern that stays in tier.ts computeTier). */
  isPaid: boolean
  /** the named v2 tier when it comes from a member_subscription row; null for a legacy-paid member (their
   *  row predates the catalog — paid, name unknown) and for free. Never downgrade a known-paid user to
   *  free just because the NAME is null. */
  tier: TierCode | null
  /** where the verdict came from — 'v2' row · 'legacy' member_payment row (paid or expired) · 'none'. */
  source: MembershipSource
}

// The minimal row shape the pure selection needs — keeps pickActiveSubscriptionRow DB-free and unit-testable.
export type SubRow = {
  id: string
  tierCode: string
  status: string
  expireAt: string // 'YYYY-MM-DD'
  createdAt: string // ISO 8601 — a total, monotonic tiebreak below id
}

// PURE, TOTALLY-ORDERED selection. Of the rows for ONE user: keep only ACTIVE rows still valid today, then
// order by expire_at DESC, created_at DESC, id DESC and take the first. id is the PK (unique) so the order
// is total — two rows sharing BOTH expire_at and created_at still resolve to the same row on every read
// (DoD: 10× identical). today is 'YYYY-MM-DD'; expire_at is 'YYYY-MM-DD' so the >= is a plain date compare.
export function pickActiveSubscriptionRow<T extends SubRow>(rows: T[], today: string): T | null {
  const live = rows.filter((r) => r.status === 'ACTIVE' && r.expireAt >= today)
  if (live.length === 0) return null
  return [...live].sort((a, b) => {
    if (a.expireAt !== b.expireAt) return a.expireAt < b.expireAt ? 1 : -1
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    if (a.id !== b.id) return a.id < b.id ? 1 : -1
    return 0
  })[0]
}

// PURE combine of the two sources into one verdict. v2 row wins; else the legacy member_payment verdict;
// else free. `legacy` is the classifyMembership result for this user's member_payment row (isFree + reason).
export function resolveTierFromSources(args: {
  subRow: { tierCode: string } | null
  legacy: { isFree: boolean; reason: MembershipReason }
}): ResolvedMembership {
  if (args.subRow) {
    const tier = args.subRow.tierCode as TierCode
    // tierIsPaid: FREE→false, any other named tier→true. `=== true` so only a real paid tier unlocks.
    return { isPaid: tierIsPaid(tier) === true, tier, source: 'v2' }
  }
  if (!args.legacy.isFree) return { isPaid: true, tier: null, source: 'legacy' }
  // free: distinguish "had a member_payment row but it's expired" (legacy) from "no row at all" (none).
  return { isPaid: false, tier: null, source: args.legacy.reason === 'EXPIRED' ? 'legacy' : 'none' }
}

// The DB read: v2 store first (SQL narrows to this user's ACTIVE + not-yet-expired rows; the pure picker is
// the single source of the selection rule — the SQL ORDER BY would be belt-and-suspenders, so it is left to
// the picker to avoid two copies of the rule). No live v2 row ⇒ reuse the v1 member_payment read + classify.
export async function resolveSubscription(
  userId: string,
  now: Date = new Date(),
): Promise<ResolvedMembership> {
  const today = bkkDateStr(now)
  const rows = await db
    .select()
    .from(memberSubscription)
    .where(
      and(
        eq(memberSubscription.userId, userId),
        eq(memberSubscription.status, 'ACTIVE'),
        gte(memberSubscription.expireAt, today),
      ),
    )
  const candidates: SubRow[] = rows.map((r) => ({
    id: r.id,
    tierCode: r.tierCode,
    status: r.status,
    expireAt: String(r.expireAt).slice(0, 10),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }))
  const subRow = pickActiveSubscriptionRow(candidates, today)
  if (subRow) return resolveTierFromSources({ subRow, legacy: { isFree: true, reason: 'NO_PLAN' } })

  const m = await resolveMembership(userId, now)
  return resolveTierFromSources({ subRow: null, legacy: { isFree: m.isFree, reason: m.reason } })
}
