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
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberSubscription } from '@/lib/db/schema'
import { bkkDateStr, type MembershipReason } from '@/lib/usage-core'
import { resolveMembership } from '@/lib/usage'
import { parseTierCode, tierIsPaid, type TierCode } from './tier'

export type MembershipSource = 'v2' | 'legacy' | 'none'

/** The TIER verdict alone — what `resolveTierFromSources` can answer from a tier_code and a legacy row.
 *  Deliberately WITHOUT expire_at: that function is handed `{ tierCode }` and nothing else, and #365 is not
 *  a reason to widen the one pure rule that decides who is paid. The date is attached one level up, by the
 *  function that actually holds the winning ROW. */
export type MembershipVerdict = {
  /** true = paid · false = KNOWN not-paid · null = a v2 row carried an UNKNOWN tier_code so membership
   *  could not be determined — fail closed, do NOT unlock (tier-lock.ts remindersLocked = isPaid !== true).
   *  The legacy/none paths are always boolean; null only appears on the v2 path (ตู๋ #369 B1). */
  isPaid: boolean | null
  /** the named v2 tier when it comes from a member_subscription row; null for a legacy-paid member (their
   *  row predates the catalog — paid, name unknown) and for free. Never downgrade a known-paid user to
   *  free just because the NAME is null. */
  tier: TierCode | null
  /** where the verdict came from — 'v2' row · 'legacy' member_payment row (paid or expired) · 'none'. */
  source: MembershipSource
}

/** The verdict PLUS the winning row's expiry — what a screen needs to say "ใช้ได้ถึง …".
 *
 *  #365 (จอ "สิทธิ์ของฉัน") needs the date, and its DoD says the date must COME FROM member_subscription and
 *  must NOT be computed by the screen. Before this, `expire_at` lived only inside SubRow and was dropped at
 *  resolveTierFromSources, so the only date any caller could reach was member_payment.expire_at via
 *  /api/user (a DIFFERENT table). A screen that wanted the v2 date had two options, both wrong: re-read the
 *  table itself (a second copy of the selection rule — the bug ตู๋ closed in #369 B2) or compute it from the
 *  package (the exact thing #365's DoD forbids). So it is exposed here, from the row the ONE rule picked.
 *
 *  `null` means "no v2 row decided this" — legacy-paid, free, or not-determined. It is NOT "no expiry":
 *  a legacy member does have one, it just lives in member_payment and is not this seam's to report.
 *  ⚠️ A caller must never read `expireAt: null` as "expired" — `isPaid` is the only field that answers that. */
export type ResolvedMembership = MembershipVerdict & {
  /** 'YYYY-MM-DD' from the winning member_subscription row · null when no v2 row decided the verdict. */
  expireAt: string | null
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
}): MembershipVerdict {
  if (args.subRow) {
    const tier = parseTierCode(args.subRow.tierCode)
    if (tier === null) {
      // v2 row with an UNKNOWN tier_code: tier_code is the only signal here, so garbage = we know NOTHING
      // (NOT "paid, name unknown" — that rule is only for a member already known-paid via another source).
      // Fail closed and be loud so a bad writer is visible; the 0006 CHECK should make this unreachable.
      console.error(
        `[subscription] unknown tier_code on a v2 row — refusing to infer paid: ${JSON.stringify(args.subRow.tierCode)}`,
      )
      return { isPaid: null, tier: null, source: 'v2' }
    }
    // tierIsPaid: FREE→false, PLUS/PRO→true. `=== true` so only a real paid tier unlocks.
    return { isPaid: tierIsPaid(tier) === true, tier, source: 'v2' }
  }
  if (!args.legacy.isFree) return { isPaid: true, tier: null, source: 'legacy' }
  // free: distinguish "had a member_payment row but it's expired" (legacy) from "no row at all" (none).
  return { isPaid: false, tier: null, source: args.legacy.reason === 'EXPIRED' ? 'legacy' : 'none' }
}

// The raw member_subscription row as it comes back from drizzle — structural, so the mapping below stays
// callable from anywhere holding those rows (the /api/user composite fetches them itself, #383).
type SubscriptionRowLike = {
  id: string
  tierCode: string
  status: string
  expireAt: unknown
  createdAt: unknown
}

// PURE row mapping. The date slicing IS part of the rule (expire_at is compared as 'YYYY-MM-DD' and
// created_at as an ISO string), so it lives here in ONE copy rather than being re-typed by each caller.
export function toSubRows(rows: SubscriptionRowLike[]): SubRow[] {
  return rows.map((r) => ({
    id: r.id,
    tierCode: r.tierCode,
    status: r.status,
    expireAt: String(r.expireAt).slice(0, 10),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }))
}

// PURE: this user's v2 rows + today + the legacy verdict → the ONE membership answer. Extracted (#383) so
// the two callers cannot drift: resolveSubscription below (which reads member_payment lazily) and the
// /api/user composite (which ALREADY holds the member_payment row and must not read it a second time —
// that route's latency is load-bearing for every v1 page). Same "one copy of the rule" reason the filter
// was moved out of SQL in the first place (ตู๋ #369 B2).
export function resolveMembershipFromRows(
  rows: SubRow[],
  today: string,
  legacy: { isFree: boolean; reason: MembershipReason },
): ResolvedMembership {
  const subRow = pickActiveSubscriptionRow(rows, today)
  const verdict = resolveTierFromSources({ subRow, legacy })
  // #365 — the date rides along ONLY when a v2 row actually decided the verdict. Two cases deliberately
  // answer null even though a row was in hand:
  //   · verdict.source !== 'v2'  → the legacy/none paths. Their expiry is member_payment's, not ours.
  //   · isPaid === null          → the row carried an unknown tier_code, so we refused to grant membership
  //                                (see resolveTierFromSources). Printing "ใช้ได้ถึง …" for a membership we
  //                                just declined would be the screen contradicting the gate.
  const expireAt = subRow !== null && verdict.source === 'v2' && verdict.isPaid !== null ? subRow.expireAt : null
  return { ...verdict, expireAt }
}

// A live v2 row wins outright, so in that branch the legacy verdict is never consulted — this placeholder
// says "no legacy evidence" and is only ever passed when a subRow exists.
const NO_LEGACY = { isFree: true, reason: 'NO_PLAN' as const }

// The DB read: v2 store first. The SQL does ONLY the user narrowing (eq(userId)); the ENTIRE selection rule
// — status, expiry-vs-today, and ordering — lives in the pure picker so it is ONE copy, exercised by the
// main `npm test` lane, not split with a half in SQL that only a DB suite could watch (ตู๋ #369 B2; this is
// the "avoid two copies of the rule" principle already applied to ORDER BY, now applied to the filter too).
// Cost: we fetch all of this user's rows rather than filtering at the DB — fine, one human has few rows
// (one per purchase) and idx_member_subscription_user_id makes the fetch selective. No live v2 row ⇒ reuse
// the v1 member_payment read + classify.
export async function resolveSubscription(
  userId: string,
  now: Date = new Date(),
): Promise<ResolvedMembership> {
  const today = bkkDateStr(now)
  const rows = await db
    .select()
    .from(memberSubscription)
    .where(eq(memberSubscription.userId, userId))
  const candidates = toSubRows(rows)
  // Skip the legacy read entirely when a live v2 row already decides it (unchanged behaviour — the second
  // query is a cost, and its answer would be discarded).
  if (pickActiveSubscriptionRow(candidates, today)) {
    return resolveMembershipFromRows(candidates, today, NO_LEGACY)
  }
  const m = await resolveMembership(userId, now)
  return resolveMembershipFromRows(candidates, today, { isFree: m.isFree, reason: m.reason })
}
