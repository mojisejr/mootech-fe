// v2 REPURCHASE / UPGRADE decision (mootech-fe#456) — PURE, no DB, no Omise. The ONE place that answers
// "this person already holds something; may they buy THIS package, and what happens to the days they have
// left?" Both the door (lib/payment/charge-flow.ts, before any money moves) and the settlement
// (lib/payment/repo.ts settleAndProvision) read this same function, so the refusal the screen sees and the
// expiry the DB writes can never come from two different rules.
//
// 🔴 The bug this closes, seen on prod 2026-08-26 on ฟีม's own account: two ACTIVE member_subscription rows
// for one human, 2026-08-25→2027-08-25 and 2026-08-26→2027-08-26, both PLUS, both 790 บาท. 1,580 บาท paid,
// ONE year granted. Nothing was broken — many rows per user is the table's design (history, one row per
// payment, lib/payment/repo.ts:232). What was MISSING is exactly this: nobody decided what a second
// purchase means, so the second row just quietly started the clock over.
//
// 🔴 WHY "full price + carry the remaining days over" and NOT proration (ฟีมเคาะ 2026-08-26, ทาง C):
// proration reaches into price, VAT, the Omise receipt and the discount-code engine — four places, all of
// them money. Carrying days over touches ONE number in ONE pure function and the buyer loses nothing: every
// day they already paid for follows them onto the new tier.
import { tierRank, type TierCode } from '@/lib/v2/tier'
import { addDays } from './provision'

/** What the buyer holds RIGHT NOW, as read by lib/payment/repo.ts readEntitlement.
 *
 *  🔴 `tier: null` while `isPaid: true` is NOT a bug and NOT free — it is a LEGACY member: someone whose
 *  membership lives on member_payment, which predates the tier catalog and therefore has no level NAME.
 *  There were 24 of them when v2's read seam was written (lib/v2/subscription.ts:1-13). Treating them as
 *  free would be wrong, and so would refusing them. See decidePurchase's legacy branch. */
export type Entitlement = {
  /** the named level from a LIVE v2 member_subscription row; null = nothing live, or legacy-unnamed */
  tier: TierCode | null
  /** paid RIGHT NOW — a live v2 row, or a member_payment row that is still valid today */
  isPaid: boolean
  /** last day the current entitlement is valid, 'YYYY-MM-DD' (inclusive); null when not paid */
  expireAt: string | null
}

/** Why a purchase was refused. These strings travel to the client and into #457's screen copy, so they name
 *  the SITUATION, never the fix — the screen decides what to say about it. */
export type PurchaseRefusal =
  | 'ALREADY_ON_THIS_TIER' //  they hold this exact level and it has not expired
  | 'CANNOT_DOWNGRADE' //      they hold a HIGHER level; selling them a lower one would take something away

export type PurchaseDecision =
  | { allow: true; carryOverDays: number }
  | { allow: false; reason: PurchaseRefusal }

/**
 * Whole days from `today` up to and INCLUDING `expireAt` — the days the buyer has not yet consumed.
 *
 * 🔴 The inclusive/exclusive choice is load-bearing and is fixed by how the reader decides expiry:
 * lib/v2/subscription.ts:49 keeps a row while `expireAt >= today`, so the expiry DAY ITSELF is still a day
 * of membership. But today is ALSO being spent right now, and the new package's own span starts counting
 * from today — so the days still owed are the ones AFTER today: expireAt − today.
 *   expireAt === today  ⇒ 0  (today is their last day; the new package takes over from here)
 *   expireAt < today    ⇒ 0  (nothing owed — never negative, which would SHORTEN the new membership)
 */
export function remainingDays(today: string, expireAt: string | null | undefined): number {
  if (!expireAt) return 0
  const e = String(expireAt).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return 0
  // addDays is the repo's one piece of civil-date math (UTC, no moment) — reused rather than re-derived so
  // there is a single definition of "a day" in the money lane.
  let n = 0
  // Walking is O(days) but bounded by the longest package sold (10Y ⇒ ~3,650 steps) and keeps this function
  // dependent on ONE date primitive instead of introducing a second, subtly different, ms-based one.
  // A ms subtraction over UTC midnights would also be correct; it would just be a second definition.
  const MAX = 4000
  let cur = today
  while (cur < e && n < MAX) {
    cur = addDays(cur, 1)
    n += 1
  }
  return n
}

/**
 * THE MATRIX (ฟีมเคาะ 2026-08-26 · the DoD table of mootech-fe#456), in one place:
 *
 *   holds          buying   →  outcome
 *   ─────────────────────────────────────────────────────────────────────────────────
 *   nothing/free   PLUS/PRO →  allow, carry 0     — first purchase, behaviour UNCHANGED
 *   PLUS (live)    PLUS     →  REFUSE ALREADY_ON_THIS_TIER
 *   PLUS (live)    PRO      →  allow, carry N     — upgrade now, the N days left follow them
 *   PRO  (live)    PLUS     →  REFUSE CANNOT_DOWNGRADE
 *   PRO  (live)    PRO      →  REFUSE ALREADY_ON_THIS_TIER
 *   legacy paid    PLUS/PRO →  allow, carry N     — see below
 *
 * 🔴 THE LEGACY BRANCH IS NOT IN ฟีม'S TABLE — บอง chose it, and it needs confirming (#456 comment).
 * A legacy member is paid but has NO level name, so "do they already hold PLUS?" is UNANSWERABLE for them.
 * Of the two ways to be wrong, only one is recoverable: allowing costs them nothing (they pay for a level
 * they may already have had, but every remaining day carries over, and they end up with a NAMED tier that
 * fixes the ambiguity permanently), while refusing locks a paying customer out of upgrading with no way to
 * fix it themselves. So: never refuse someone we cannot place on the ladder.
 */
export function decidePurchase(args: {
  current: Entitlement
  targetTier: TierCode
  today: string
}): PurchaseDecision {
  const { current, targetTier, today } = args

  // Not paid right now (never bought, or lapsed) ⇒ an ordinary first purchase. Nothing to carry, nothing to
  // refuse. 🔴 This branch must stay reachable and unchanged — it is every new customer (#456 DoD: "ผู้ใช้
  // Free ซื้อครั้งแรก ผลลัพธ์ไม่เปลี่ยนแม้แต่วันเดียว").
  if (!current.isPaid) return { allow: true, carryOverDays: 0 }

  const carryOverDays = remainingDays(today, current.expireAt)

  // Legacy-paid: real membership, no name ⇒ unplaceable on the ladder ⇒ allow (see the block comment).
  const held = tierRank(current.tier)
  if (held === null) return { allow: true, carryOverDays }

  const wanted = tierRank(targetTier)
  // targetTier is a TierCode, so wanted is never null; the guard is for a future tier added to TIER_CODES
  // without a rank — fail towards refusing a purchase we cannot reason about rather than granting it.
  if (wanted === null) return { allow: false, reason: 'CANNOT_DOWNGRADE' }

  if (wanted > held) return { allow: true, carryOverDays } // upgrade — the whole point of ทาง C
  if (wanted === held) return { allow: false, reason: 'ALREADY_ON_THIS_TIER' }
  return { allow: false, reason: 'CANNOT_DOWNGRADE' }
}
