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
import type { AuthStatus } from '@/lib/auth/resolve-auth'

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
  // resolveAuth verdict — the ONLY signal that distinguishes a true anon from identity-limbo. An empty
  // userId alone conflates them (both '') and was what showed a paying user the upsell in limbo (#246).
  status: AuthStatus
  userId: string // '' when there is no logged-in account
  done: boolean // the user fetch has settled (success OR error)
  errored: boolean // the fetch threw / returned an error shape / carried no user_id
  user: TierSource // the resolved user row (null if none / errored)
}): V2Tier {
  // Truly anonymous (no session AND no valid MEMBER_ID) → KNOWN not a paid member. Safe to gate as free.
  if (args.status === 'anon') return { isPaid: false, loading: false }
  // Identity limbo (authed session but MEMBER_ID not resolved yet) → we do NOT know who this is, and they
  // MAY be a paying member. Guessing "free" here shows a paid user the upsell and gates content they paid
  // for (#246 symptom #5). Unknown = null; the gate must not commit either branch. NOT the same as anon.
  if (args.status === 'loading') return { isPaid: null, loading: true }
  // status === 'authed' below: a valid MEMBER_ID uuid is present.
  // Fetch still in flight → not determined. Do NOT flash free content.
  if (!args.done) return { isPaid: null, loading: true }
  // Settled but could not determine (error / no user_id) → unknown. Do NOT guess in either direction.
  if (args.errored || !args.user) return { isPaid: null, loading: false }
  // Determined.
  return { isPaid: isPaidMember(args.user), loading: false }
}

// ── v2 tier LEVELS (mootech-fe#354) ──────────────────────────────────────────────────────────────
// #354 extends the paid/free boolean into a NAMED tier so a v2 subscription row can say WHICH level a
// member holds. The catalog names are pending marketing; FREE + two paid names are the shape today.
export const TIER_CODES = ['FREE', 'PLUS', 'PRO'] as const
export type TierCode = (typeof TIER_CODES)[number]

// Allow-list, NOT a cast (ตู๋ #369 B1): an unknown string is null, never coerced into a paid tier. On the
// v2 path tier_code is the ONLY signal of membership, so a value outside this list means "we know nothing"
// and the caller must fail closed (isPaid null), NOT read as paid. The DB CHECK in 0006 keeps garbage out
// at write time; this is the read-side net for anything that ever slips past it.
export function parseTierCode(raw: string | null | undefined): TierCode | null {
  return (TIER_CODES as readonly string[]).includes(raw as string) ? (raw as TierCode) : null
}

// Derive the paid flag from a tier NAME, preserving the seam's rule that unknown must not be guessed:
//   • null  → null  (name not determined — do NOT gate; same contract as computeTier's null)
//   • FREE  → false (KNOWN not paid)
//   • anything else → true (any named non-free tier is paid; a future PLUS/PRO stays paid without an edit)
// A legacy member_payment member is paid but has NO tier name (their row predates this catalog): callers
// keep using the boolean isPaid for that, and tier stays null — never downgrade a known-paid user to free
// just because the NAME is unknown. #v2-tier-paid-rule (matches isPaidMember: strict, no truthy unlock).
export function tierIsPaid(tier: TierCode | null): boolean | null {
  if (tier === null) return null
  return tier !== 'FREE'
}
