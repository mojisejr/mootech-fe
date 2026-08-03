// v2 paid-tier seam (PURE, React-free, unit-testable) — the ONE place the paid-membership rule lives so
// ANY v2 page (home / service / calendar) can gate on it without re-deriving. μุน imports; never recomputes.
//
// WHY a seam (μุน, Zone-4 free/paid gate): today /v2/calendar/[date] has NO tier logic → free users see
// all paid content (5-facet compat · per-facet readings · advanced mode · 8 gates · 8 deities). The gate
// needs a REAL flag: an unknown tier is wrong BOTH ways — guess free ⇒ a paying user loses what they paid
// for; guess paid ⇒ a free user sees everything. There is NO safe default, so the tier must be KNOWN
// before gating. Hence `isPaid: boolean | null` where **null = not determined yet — do NOT gate on it**.

// The single paid rule (matches lib/home/profile.ts deriveHomeProfile / v1 header-v2.tsx EXACTLY): a member
// is paid ONLY when the plan is still valid. Strict `=== true` (not truthy) so a stray non-boolean
// (`"true"`, `1`, `{}`) can never silently unlock paid content. #v2-tier-paid-rule
export type TierSource = { payment?: { is_not_expired?: boolean | null } | null } | null

export function isPaidMember(source: TierSource): boolean {
  return source?.payment?.is_not_expired === true
}

export type V2Tier = {
  /** true = paid · false = KNOWN not-paid (free/anon) · null = NOT yet determined (loading/error) — do not gate. */
  isPaid: boolean | null
  loading: boolean
}

/**
 * Pure state reducer for the tier hook — the whole state-table in one testable place. The two failure
 * directions the gate must never take: a transient fetch error must NOT read as free (would hide a paid
 * user's content), and an in-flight fetch must NOT read as free (would flash free content pre-resolve).
 * Both resolve to `null` (unknown) so the caller shows a loading/retry state instead of guessing.
 */
export function computeTier(args: {
  userId: string // '' when there is no logged-in account
  done: boolean // the user fetch has settled (success OR error)
  errored: boolean // the fetch threw / returned an error shape / carried no user_id
  user: TierSource // the resolved user row (null if none / errored)
}): V2Tier {
  // No account at all → KNOWN not a paid member (an anon cannot have paid). Safe to gate as free.
  if (!args.userId) return { isPaid: false, loading: false }
  // Fetch still in flight → not determined. Do NOT flash free content.
  if (!args.done) return { isPaid: null, loading: true }
  // Settled but could not determine (error / no user_id) → unknown. Do NOT guess in either direction.
  if (args.errored || !args.user) return { isPaid: null, loading: false }
  // Determined.
  return { isPaid: isPaidMember(args.user), loading: false }
}
