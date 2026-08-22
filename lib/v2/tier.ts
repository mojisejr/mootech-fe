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

export type TierSource = {
  payment?: { is_not_expired?: boolean | null } | null
  // #383 — the v2 membership composite from /api/user. Carries the NAME only; the paid verdict above is
  // untouched by it (see the precedence note in lib/home/profile.ts for why the legacy flag wins).
  membership?: { tier?: string | null } | null
} | null

export function isPaidMember(source: TierSource): boolean {
  return source?.payment?.is_not_expired === true
}

export type V2Tier = {
  /** true = paid · false = KNOWN not-paid (free/anon) · null = NOT yet determined (loading/error) — do not gate. */
  isPaid: boolean | null
  /** #383 — WHICH level, when it is knowable. null means EITHER not-determined OR paid-with-no-name (a
   *  legacy member); `isPaid` tells those apart. A screen must never read null as FREE. */
  tier: TierCode | null
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
  // #383 — `tier` follows isPaid's determinism EXACTLY: every branch that answers "not determined" for the
  // boolean answers null for the name too, and the anon branch (KNOWN not-paid) has no NAME to report
  // either — a free visitor is not "tier FREE", they have no subscription at all. Never guess FREE.
  //
  // Truly anonymous (no session AND no valid MEMBER_ID) → KNOWN not a paid member. Safe to gate as free.
  if (args.status === 'anon') return { isPaid: false, tier: null, loading: false }
  // Identity limbo (authed session but MEMBER_ID not resolved yet) → we do NOT know who this is, and they
  // MAY be a paying member. Guessing "free" here shows a paid user the upsell and gates content they paid
  // for (#246 symptom #5). Unknown = null; the gate must not commit either branch. NOT the same as anon.
  if (args.status === 'loading') return { isPaid: null, tier: null, loading: true }
  // status === 'authed' below: a valid MEMBER_ID uuid is present.
  // Fetch still in flight → not determined. Do NOT flash free content.
  if (!args.done) return { isPaid: null, tier: null, loading: true }
  // Settled but could not determine (error / no user_id) → unknown. Do NOT guess in either direction.
  if (args.errored || !args.user) return { isPaid: null, tier: null, loading: false }
  // Determined.
  const isPaid = isPaidMember(args.user)
  return { isPaid, tier: resolveDisplayTier(isPaid, args.user?.membership?.tier ?? null), loading: false }
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

/**
 * #383 — the NAME a screen may DISPLAY, reconciled against the paid verdict, so the pair handed to the UI
 * can never contradict itself. μุน asked directly whether `isPaid: true` + `tier: 'FREE'` can reach the
 * badge; this function is the answer being enforced rather than promised.
 *
 * 🔴 THE CONTRACT (safe to write teeth against):
 *     isPaid === true   ⇒ tier ∈ { 'PLUS', 'PRO', null }     (null = paid, name unknown → "สมาชิก")
 *     isPaid === false  ⇒ tier ∈ { 'FREE', null }
 *     isPaid === null   ⇒ tier === null                       (not determined — render neither branch)
 *
 * WHY collapse instead of passing the raw name through: the paid verdict and the name come from two
 * stores, and the precedence (lib/home/profile.ts) already says the paid verdict wins. A name that
 * disagrees with the winner is not a fact the screen can act on — it is evidence of a bad row — so it
 * degrades to "no name" (which every screen must already handle for legacy members) instead of becoming a
 * FOURTH thing the UI has to decide about. Today no writer can produce the contradiction: the only insert
 * is settleV2Payment, and quotePackage (lib/payment/catalog.ts:79) refuses a FREE/unknown tier before any
 * charge — so this is the read-side net, exactly like parseTierCode is for the DB CHECK.
 */
export function resolveDisplayTier(isPaid: boolean | null, raw: string | null | undefined): TierCode | null {
  if (isPaid === null) return null // not determined ⇒ no name, ever
  const tier = parseTierCode(raw)
  if (tier === null) return null
  // A named tier is displayable ONLY while it agrees with the paid verdict.
  return tierIsPaid(tier) === isPaid ? tier : null
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
