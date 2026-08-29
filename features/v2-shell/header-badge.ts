// features/v2-shell/header-badge.ts — WHAT the header pill says, as one pure rule (mootech-fe#384).
//
// ฟีม 2026-08-22: จ่ายเงินแล้ว ป้าย "อัพเกรด" หายไปเฉยๆ ไม่มีอะไรมาแทน — ไม่มีที่ไหนในแอปบอกเขาว่าเขาอยู่แพ็กไหน
// So the same 84×32 slot now carries EITHER the upsell (free) OR the member's level (paid). One slot, two
// meanings, and the thing that decides between them is a rule that must be identical on all six screens —
// hence a pure module rather than a ternary repeated per page.
//
// 🔴 THE STATE THAT DECIDES THIS MODULE'S SHAPE IS "ไม่รู้", NOT "ฟรี"/"จ่ายแล้ว".
// `isPaid` is deliberately `boolean | null` upstream (lib/v2/tier.ts:22) because an unknown tier is wrong in
// BOTH directions: guess free ⇒ a paying member is told to upgrade; guess paid ⇒ a free user sees a level
// they do not hold. This module therefore has THREE inputs and the third one renders NOTHING. A rule with
// only a boolean cannot express that, which is exactly how the home bug below survived.
//
// KNOWN BUG THIS CLOSES (pre-existing on prod, NOT introduced by #384 — see the PR body):
//   home derived the badge from `showUpgrade: !isPaidMember(user)` (lib/home/profile.ts:21) — a BOOLEAN. On
//   an /api/user error the hook settles with `user: null`, so isPaidMember answers false, so showUpgrade
//   answers true, and a paying member whose fetch failed was shown "อัพเกรด". The unknown state had nowhere
//   to live in a two-valued type, so it was silently spent as "not paid" — the cheaper of the two lies to
//   tell in code and the more expensive one to receive.
//
// WHY `tier` IS OPTIONAL and not required: mootech-fe#383 (goo) is the ticket that makes the tier NAME
// travel from member_subscription to the client, and the two PRs are open at the same time. goo's real types
// (posted in #384) are `V2Tier = { isPaid; tier; loading }` and `HomeProfile = { …; isPaid; tier }` — both
// already carry the name. Declaring `tier?` here means these six pages accept BOTH shapes: today's hook
// result (no `tier` key ⇒ "สมาชิก", which is the correct badge for every member who exists right now, since
// nobody has bought through the v2 lane yet) and #383's, with no page edit and no cast on either side of
// that merge. A required field would have forced a placeholder at six call sites — and a placeholder is a
// default wearing a costume.
import type { TierCode } from '@/lib/v2/tier'

/** What the header knows about the viewer. Shaped to accept `useV2Tier()`'s result verbatim (#383 forward-
 *  compatible): `tier` absent = the NAME is not known, which is NOT the same as the user being free. */
export type MembershipLike = {
  /** true = paid · false = KNOWN not-paid · null = NOT determined (loading / error) — never guess. */
  isPaid: boolean | null
  tier?: TierCode | null
}

export type HeaderBadge =
  | { kind: 'none' }
  | { kind: 'upgrade' }
  | { kind: 'tier'; label: string }

/** ป้ายของสมาชิกที่จ่ายจริงแต่ไม่มีชื่อระดับ ❌ NEVER "FREE": they paid.
 *  ⚠️ This is no longer what a legacy member sees, and the old citation (subscription.ts:27-29) no longer
 *  points at anything. Since #358 Phase 1 a VALID legacy member resolves to 'PRO'
 *  (lib/v2/subscription.ts:26) and this pill prints PRO for them. The label now belongs to a paid viewer
 *  whose NAME did not reach us: the /api/user membership composite absent or unreadable, or the pre-#383
 *  hook shape this module still accepts (see "WHY `tier` IS OPTIONAL" above).
 *  Guard: scripts/header-tier-badge.test.tsx, 'paid with no level name → "สมาชิก"'. */
export const MEMBER_BADGE_LABEL = 'สมาชิก'

const NONE: HeaderBadge = { kind: 'none' }

/**
 * The one rule. `upgradeCta` is the SCREEN's policy (may this screen sell?), `membership` is the USER's
 * fact — deliberately two arguments, because #384 proved they are not one thing: the shop screen must not
 * show the อัพเกรด CTA (it would point at itself, ShopScreen.tsx:44) yet it is the screen where a member
 * most needs to see the level they already own, right next to the prices.
 */
export function headerBadge(
  membership: MembershipLike | null | undefined,
  { upgradeCta }: { upgradeCta: boolean },
): HeaderBadge {
  // No membership prop at all = the caller has nothing to say about this viewer. Same verdict as `null`:
  // draw nothing. This is the direction a forgotten wire must fail in — a missing prop can cost us a sale,
  // and the alternative costs us a member's trust.
  if (!membership) return NONE
  const { isPaid } = membership
  if (isPaid === null || isPaid === undefined) return NONE
  if (isPaid === false) return upgradeCta ? { kind: 'upgrade' } : NONE

  // isPaid === true below. The NAME may still be unknown, and that must not undo "this person paid".
  const tier = membership.tier ?? null
  // NOT a second copy of the paid rule. goo closed `isPaid: true` + `tier: 'FREE'` at the source in #383
  // (resolveDisplayTier drops a name that contradicts the verdict), so this line is not deciding WHO IS PAID
  // — that owner is upstream and stays upstream. What it decides is the narrower question that belongs to a
  // badge: WHICH STRINGS MAY THIS PILL PRINT. 'FREE' is not one of them, in any input, ever, because the one
  // reader who would ever see it is a member who paid. Keeping the check costs a branch and buys the
  // guarantee that no upstream regression can put the word FREE on a paying member's header.
  if (tier === null || tier === 'FREE') return { kind: 'tier', label: MEMBER_BADGE_LABEL }
  return { kind: 'tier', label: tier }
}
