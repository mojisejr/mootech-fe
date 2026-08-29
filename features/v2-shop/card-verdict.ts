// features/v2-shop/card-verdict.ts — what ONE package card says to THIS viewer (mootech-fe#457), PURE.
//
// #456 put the repurchase/upgrade rule on the server and made the door refuse. This file is the SCREEN
// side of that decision: it exists so a member never walks into a refusal they were invited to walk into.
//
// 🔴 IT DOES NOT RE-DERIVE THE RULE — it imports `decidePurchase` from lib/payment/purchase-gate.ts, the
// same PURE function the door (charge-flow) and the settlement (repo.settleAndProvision) call. A second
// copy of "may they buy this?" living in the UI is the exact shape #456 was opened to remove; the screen
// asking the same function is the only way the button and the till can never disagree.
//
// 🔴 WHY NOT CALL /api/v2/payment/preview PER CARD (the first plan, withdrawn in the ticket):
// preview.ts:52 → insertQuote → lib/discount/repo.ts:74 `db.insert(paymentQuote)`. Every call WRITES a row.
// Pricing three cards on page load would turn a table that records "somebody intended to pay" into a log of
// who opened the shop, and nothing would have gone red while it happened. The authoritative carryOverDays
// still comes from preview — at checkout, where useCheckout.ts:56 already asks for it.
//
// 🔴 THE READER'S CLOCK MUST NOT REACH THE RENDERED WORDS. `today` is here because decidePurchase needs it
// to count days, and the count is returned for callers who need a number — but NO branch of `kind` depends
// on it (isPaid is the server's verdict, ranks are strings). scripts/shop-card-verdict.test.ts asserts that
// directly: the same viewer on two different days must produce the identical verdict kind. That is the
// mootech-fe#452 bug-class (`.slice(0,10)` on an instant showed a buyer the previous day's date) caught at
// the door instead of after shipping.
import { decidePurchase, type Entitlement } from '@/lib/payment/purchase-gate'
import { parseTierCode, tierRank, type TierCode } from '@/lib/v2/tier'
import type { PlanId } from './packages'

/** The membership composite as `useV2User().user.membership` hands it over (useV2User.ts:37). Every field
 *  is optional because the row may be absent, half-known, or from the legacy store. */
export type ViewerMembership = {
  isPaid?: boolean | null
  tier?: string | null
  /** 🔴 WHERE the verdict came from — lib/v2/subscription.ts:21 MembershipSource ('v2' | 'legacy' | 'none').
   *  It rides on the composite already (useV2User.ts:37) and is what tells a NAME THAT WAS READ apart from
   *  a NAME THAT WAS DECIDED. Since #358 Phase 1 (subscription.ts:26 LEGACY_TIER) a valid legacy member
   *  resolves to tier 'PRO' — member_payment has no tier column, so that name is a product decision, not a
   *  row. Without this field the two are indistinguishable and the gate below refuses a legacy member on
   *  BOTH cards (PRO → 'current', PLUS → 'blocked'), which is the opposite of the rule stated at
   *  purchase-gate.ts:116-121: never refuse someone we cannot place on the ladder.
   *  Optional/loose-typed for the same reason every field here is: the row may be absent or half-known. */
  source?: string | null
  expireAt?: string | null
} | null

/**
 * What a card may say. Five kinds, because the viewer has five states — the ticket's matrix has three rows
 * and the two it does not draw are the ones that go wrong silently:
 *
 *   undetermined  loading / error — 🔴 renders NEITHER branch. Guessing free tells a paying member to buy
 *                 what they own; guessing paid hides the button from someone who wants to pay.
 *   free-card     the Free plan's own card. Its behaviour is frozen by the ticket ("❌ ไม่แตะการ์ด Free").
 *   buy           may buy. `carriesDays` = they hold something whose remaining time follows them, but we
 *                 CANNOT call it an upgrade — this is the legacy member (paid, no level name). Saying
 *                 "อัปเกรด" to someone who might already hold PRO is a claim the data does not support.
 *   upgrade       may buy AND we know it ranks above what they hold. Only here may the word อัปเกรด appear.
 *   current       they hold exactly this level.  blocked  they hold a higher one.
 */
export type CardVerdict =
  /** 🔴 `because` splits ONE null into the two things it actually means. "loading" and "we could not find
   *  out" are different sentences to a user: the first asks them to wait, the second admits our outage.
   *  Collapsing them makes a failed fetch say "กำลังตรวจสอบ…" forever, which blames the wait on them. */
  | { kind: 'undetermined'; because: 'loading' | 'unavailable' }
  | { kind: 'free-card' }
  | { kind: 'buy'; carriesDays: boolean; carryOverDays: number }
  | { kind: 'upgrade'; carryOverDays: number }
  | { kind: 'current'; expireAt: string | null }
  | { kind: 'blocked' }

/** Which paid tier a card sells. `free` sells none — it never reaches checkout (PackageCard.tsx:149-155). */
const CARD_TIER: Record<PlanId, TierCode | null> = { free: null, plus: 'PLUS', pro: 'PRO' }

export function cardVerdictFor(args: {
  planId: PlanId
  /** false while the membership is loading OR errored OR isPaid is still null. 🔴 The caller must derive
   *  this from the PAID VERDICT (useV2Tier), never from `membership == null`: an anonymous visitor has no
   *  membership row and is nonetheless KNOWN not-paid (tier.ts:55), and must keep the buy button. */
  determined: boolean
  /** the fetch is still in flight (useV2Tier's `loading`). Only read when `determined` is false. */
  loading: boolean
  membership: ViewerMembership
  /** 'YYYY-MM-DD'. Affects only the RETURNED day counts, never `kind` — see the header. */
  today: string
}): CardVerdict {
  const { planId, determined, membership, today, loading } = args

  const targetTier = CARD_TIER[planId]
  if (targetTier === null) return { kind: 'free-card' }

  // 🔴 Order matters: undetermined is checked BEFORE anything reads isPaid, so a null can never fall
  // through into the not-paid branch and be rendered as a first-time buyer.
  if (!determined || membership == null || membership.isPaid == null) {
    return { kind: 'undetermined', because: loading ? 'loading' : 'unavailable' }
  }

  // 🔴 THE DISPLAY READS THE TIER, THE GATE READS THE SOURCE.
  // #358 Phase 1 gave a valid legacy member the NAME 'PRO' (subscription.ts:26) so every named-tier screen
  // stops special-casing null — a display decision, and the right one. But `Entitlement.tier` is not a name
  // to show, it is "the level we can PROVE they hold" (purchase-gate.ts:31), and for a legacy member there
  // is no such level: member_payment has no tier column. Handing the decided name to the gate makes it
  // answer the placeable-member matrix (PRO→PRO = ALREADY_ON_THIS_TIER, PRO→PLUS = CANNOT_DOWNGRADE), so
  // both cards refuse and the 2 legacy members on prod can buy nothing at all (17 rows in member_payment
  // are still valid, but 15 of them also hold a live v2 row and take the v2 branch — #358 has the working).
  //
  // So the gate is told what the STORE knows, not what the screen shows: source 'legacy' ⇒ unplaceable ⇒
  // purchase-gate's own legacy branch (`held === null` ⇒ allow, carry the days). The rule is still not
  // re-derived here — this only stops feeding it a name it was never meant to receive.
  //
  // Strictly `=== 'legacy'`, never `!== 'v2'`: an absent source must keep today's behaviour for a NAMED
  // tier, because before #383 the only way to hold a name was a real v2 row, and reading a v2 PRO member as
  // unplaceable would sell them the package they already own.
  const current: Entitlement = {
    tier: membership.source === 'legacy' ? null : parseTierCode(membership.tier),
    isPaid: membership.isPaid === true,
    expireAt: membership.expireAt ?? null,
  }

  const decision = decidePurchase({ current, targetTier, today })

  if (!decision.allow) {
    // ALREADY_ON_THIS_TIER ⇒ this IS their package; CANNOT_DOWNGRADE ⇒ they hold something above it.
    // Split here rather than passing the reason string on: the reason names the SITUATION for whoever asks
    // (purchase-gate.ts), and the two situations are different sentences on a card.
    return decision.reason === 'ALREADY_ON_THIS_TIER'
      ? { kind: 'current', expireAt: current.expireAt }
      : { kind: 'blocked' }
  }

  // Allowed. Is it an UPGRADE (we can place them on the ladder and this is higher), or just a purchase?
  const held = tierRank(current.tier)
  if (current.isPaid && held !== null) return { kind: 'upgrade', carryOverDays: decision.carryOverDays }

  return {
    kind: 'buy',
    // paid-but-unplaceable (legacy) is the only allowed case that still carries days.
    carriesDays: current.isPaid && decision.carryOverDays > 0,
    carryOverDays: decision.carryOverDays,
  }
}
