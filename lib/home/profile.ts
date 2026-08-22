// Pure (React-free) header-profile derivation so the กติกา-ค upgrade-badge rule is unit-testable and
// anchorable — same reason toComputeSource lives in a pure module. useV2Home derives this from the single
// user fetch and hands `profile` to Lamun's header. The rule MUST match v1 `header-v2.tsx` exactly (the
// two versions must never disagree about whether a member has paid).
//
// #383 — this module now also carries the NAMED tier, and (มุน's finding, DoD 🔴) a state the old shape
// could not express: **NOT DETERMINED**. Home was the one screen whose contract was a plain boolean, so
// "we don't know yet" collapsed into "not paid" — a paying member saw the อัพเกรด badge whenever
// /api/user errored. The tri-state below lets the screen say it; #384 is where the screen listens.
import { isPaidMember, resolveDisplayTier, type TierCode } from '@/lib/v2/tier'

export type HomeProfile = {
  pictureUrl: string | null
  /**
   * 2-VALUE VIEW — cannot say "not determined"; unknown collapses to `true` (badge shown), exactly as it
   * behaved before #383. Deliberately UNCHANGED here so μุน's <V2HomeScreen/> keeps compiling and its
   * pixels do not move in this PR: the screen switches to `isPaid`/`tier` in #384, and the collapse dies
   * with that switch. Read `isPaid` for anything new — never this.
   */
  showUpgrade: boolean
  /** true = KNOWN paid · false = KNOWN not paid · null = NOT DETERMINED (loading / error) — render neither
   *  branch.
   *  ⚠️ The three states are the same as V2Tier.isPaid, but the INPUTS are not identical, and the earlier
   *  wording here ("same meaning") papered over one case (ตู๋ #387 🔎): computeTier takes the resolveAuth
   *  verdict, so a true anon reads `false` (KNOWN not-paid); this function never sees `status`, so a
   *  non-authed visitor reads `null` (not determined) instead. Home is unreachable while non-authed
   *  (useV2Home returns `redirecting: status !== 'authed'`, and its fetch effect returns early), so the
   *  case does not reach a screen — but a caller that ever renders this profile OUTSIDE home must not
   *  assume `null` means "still loading". */
  isPaid: boolean | null
  /** The named v2 tier. null means EITHER not-determined OR paid-with-no-name (a legacy member whose row
   *  predates the catalog) — the two are told apart by `isPaid`: null vs true. Never guess FREE. */
  tier: TierCode | null
}

type ProfileSource = {
  picture_url?: string | null
  payment?: { is_not_expired?: boolean | null } | null
  // #383 — the v2 composite from /api/user. Absent on an older/cached response ⇒ tier stays null, and the
  // paid verdict is unaffected (it has never come from here).
  membership?: { tier?: string | null } | null
} | null

/**
 * The fetch state, REQUIRED (no default). A default would let a caller silently claim certainty it does
 * not have — the exact bug this parameter exists to kill — so the compiler asks every call site instead.
 * Mirrors useV2User's vocabulary: `done` = settled (success OR error), `errored` = settled with no row.
 */
export type ProfileFetchState = { done: boolean; errored: boolean }

// กติกา ค (ฟีมเคาะ): hide the upgrade badge ONLY for a paid member whose plan is still valid. The paid
// test is the SINGLE shared rule (lib/v2/tier isPaidMember, strict `=== true`) so the header badge and the
// v2 tier gate can never disagree — showUpgrade is exactly its negation. Everyone else (free, expired, no
// payment row, no user) shows the badge. Avatar: real `picture_url` else null (Lamun's first-letter tile).
//
// 🔴 PRECEDENCE — when `membership.isPaid` (v2 composite) and `payment.is_not_expired` (legacy) disagree,
// THE LEGACY FLAG WINS for the paid/free verdict, and here is WHY, not just that:
//   ① Every v2 subscription is written together with a shadow member_payment row in ONE transaction
//     (lib/payment/repo.ts settleV2Payment, expire_at = GREATEST) — and that is the ONLY code path that
//     inserts a subscription. So the legacy flag is never *behind* the v2 store; it is the same fact,
//     recorded by the same writer, in a store both versions have trusted for years.
//   ② The one way they CAN disagree is an unrecognised tier_code, where the v2 side answers `null` =
//     "we know nothing" (never "not paid"). Letting that revoke a member's access would punish a paying
//     user for a broken NAME. So the name goes missing (`tier: null`) and the access does not.
// The reverse direction — legacy says free while a live v2 row says paid — cannot be produced by ①, and
// if it ever is, that is a writer bug to fix at the source, not to paper over by picking the louder store.
export function deriveHomeProfile(user: ProfileSource, state: ProfileFetchState): HomeProfile {
  const determined = state.done && !state.errored && !!user
  const isPaid = determined ? isPaidMember(user) : null
  return {
    pictureUrl: (user?.picture_url && String(user.picture_url)) || null,
    showUpgrade: !isPaidMember(user),
    isPaid,
    // resolveDisplayTier holds the no-contradiction contract (isPaid true ⇒ never 'FREE'; not-determined ⇒
    // never a name). Home and the other 4 screens get the name through the SAME function.
    tier: resolveDisplayTier(isPaid, user?.membership?.tier ?? null),
  }
}
