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

/** What the buyer holds RIGHT NOW, as read by lib/payment/repo.ts readEntitlement.
 *
 *  🔴 `tier: null` while `isPaid: true` is NOT a bug and NOT free — it is a LEGACY member: someone whose
 *  membership lives on member_payment, which predates the tier catalog and therefore has no level NAME.
 *  Still exactly what this gate receives after #358 Phase 1 gave those members a DISPLAY name
 *  (lib/v2/subscription.ts:26 → 'PRO'): both feeders null it here on purpose — lib/payment/repo.ts:512 for
 *  the door, features/v2-shop/card-verdict.ts:111 for the shop card.
 *  2 accounts on prod are in this state (measured 2026-08-29). ⚠️ The "24" this line used to give counted
 *  member_payment ROWS — including the shadow row every v2 settlement upserts (lib/payment/repo.ts:742-748)
 *  — not people. Treating them as free would be wrong, and so would refusing them. See decidePurchase's
 *  legacy branch. */
export type Entitlement = {
  /** the named level from a LIVE v2 member_subscription row; null = nothing live, or legacy-unnamed */
  tier: TierCode | null
  /** paid RIGHT NOW — a live v2 row, or a member_payment row that is still valid today */
  isPaid: boolean
  /** last day the current entitlement is valid, 'YYYY-MM-DD' (inclusive); null when not paid */
  expireAt: string | null
  /** 🔴 HIGHEST tier among ALL live rows — not just the one the reader picked (ตู๋, review r2 of #460).
   *
   *  These differ only when somebody holds several live rows at different tiers, because
   *  lib/v2/subscription.ts:49-56 picks by expire_at DESC, NOT by tier: a PLUS row expiring later outranks
   *  a PRO row expiring sooner *as the reader's answer*, while the PRO row is still something they hold.
   *
   *  The DOOR compares against `tier` — the reader's answer is what a buyer actually has today.
   *  The SETTLE compares against THIS — "never write a row below what they hold" has to mean every row
   *  they hold, or the sentence is not the rule the code runs. Superseding a PRO row because a
   *  later-expiring PLUS row happened to win the sort would close it permanently, and that is the one
   *  state from which the data could still have been repaired.
   *
   *  No code path in this repo can create that state any more (#456 leaves exactly one live row), so this
   *  is about rows written BEFORE it. Absent ⇒ falls back to `tier`. */
  highestLiveTier?: TierCode | null
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
  const d1 = parseYmdUtc(today)
  const d2 = parseYmdUtc(e)
  if (d1 === null || d2 === null) return 0
  const days = Math.round((d2 - d1) / 86_400_000)
  return days > 0 ? days : 0 // never negative — a past date owes nothing, it must not SHORTEN the new span
}

// UTC midnight of a 'YYYY-MM-DD', or null if it is not a real calendar date. UTC has no DST, so the
// difference between two of these is always an exact whole number of days.
//
// 🔴 This replaced a day-by-day walk that stopped at a hard cap of 4,000 and returned the cap SILENTLY
// (ตู๋, review of 2c196b8). Nothing sold today can reach it — every active package is 1Y — but
// `20ADMINMUMATE26` is a 10Y package sitting inactive, and the day somebody switches it on the cap would
// start eating days off a paying customer with no error, no log, and no way to notice. A silent truncation
// on the money lane is the exact shape we keep finding; it does not get to stay because it is unreachable
// this week.
function parseYmdUtc(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '')
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = Date.UTC(y, mo - 1, d)
  const probe = new Date(t)
  // reject dates that do not exist (2026-02-31 rolls over to March — that is not the day anyone meant)
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null
  return t
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

// ── the SETTLEMENT question (mootech-fe#456, ตู๋'s review of 2c196b8) ─────────────────────────────
//
// 🔴 THE DOOR AND THE WEBHOOK ASK DIFFERENT QUESTIONS, and giving them the same answer is what broke.
//
//   door     "may this person BUY this?"          — nothing has happened yet; refusing costs nobody anything
//   webhook  "the money has MOVED. what may we write?" — refusing is no longer free, and pretending the
//            payment did not happen is not on the table
//
// The gap between them is real time. A PromptPay QR the user closed stays PENDING forever — no writer
// expires it (ตู๋ confirmed while reviewing #452) — so a charge created while somebody was FREE can settle
// days later, after they have bought something else. The door answered correctly both times. Nobody was
// asking anything at the webhook.
//
// ตู๋'s probe on real postgres: settle PRO (1,290) then settle a stale PLUS (500) ⇒ tier PLUS, the PRO row
// marked REPLACED. 1,790 บาท paid, PLUS held. The days survived; the LEVEL was taken away.
//
// 🔑 AND THE OBVIOUS MINIMAL FIX IS NOT ENOUGH — measured, not assumed. Excluding higher-ranked rows from
// supersedeIds leaves the PRO row ACTIVE, but the new PLUS row still carries PRO's remaining days, so it
// expires LATER, and lib/v2/subscription.ts:49-56 picks by expire_at DESC — not by tier. The reader still
// answers PLUS. Probed on postgres before writing this: the demotion survives that fix untouched.
//
// So the rule this function states is about the WRITE, not about permission:
//   **never write a row that ranks below what the buyer already holds live.**

export type SettlementDecision =
  | { grant: true; carryOverDays: number }
  | { grant: false; reason: 'WOULD_DOWNGRADE' }

/**
 * What a settlement may write, given what the buyer holds at the moment the money lands.
 *
 * 🔴 SAME TIER IS A GRANT, NOT A REFUSAL — and that is deliberate, not an oversight of the door's matrix.
 * At the door, buying the tier you already hold is refused because you would be paying for nothing. At the
 * webhook the payment ALREADY HAPPENED, and the honest thing to do with it is add the time it bought. This
 * is ฟีม's own case: one card + one PromptPay, both PLUS. Refusing here would recreate the exact bug
 * mootech-fe#456 exists to fix — 1,580 บาท for one year.
 *
 * 🔴 WHAT A REFUSAL DOES *NOT* DECIDE: whether the money is refunded or kept as credit. That is ฟีม's call
 * (ตู๋ said so explicitly and he is right). This function only guarantees the thing that cannot wait for an
 * answer: nobody is demoted by a payment. The caller records the purchase either way — money that moved is
 * never un-recorded — it just does not grant a level below the one already held.
 */
export function decideSettlement(args: {
  current: Entitlement
  paidTier: TierCode
  today: string
}): SettlementDecision {
  const { current, paidTier, today } = args
  if (!current.isPaid) return { grant: true, carryOverDays: 0 }

  const carryOverDays = remainingDays(today, current.expireAt)

  // Legacy-paid: no name, so no rank, so nothing to rank BELOW. Grant and carry (same reasoning as the
  // door's legacy branch — we never punish somebody we cannot place on the ladder).
  //
  // 🔴 Compare against the HIGHEST live tier, not the reader's pick — see Entitlement.highestLiveTier.
  const held = tierRank(current.highestLiveTier !== undefined ? current.highestLiveTier : current.tier)
  if (held === null) return { grant: true, carryOverDays }

  const paid = tierRank(paidTier)
  if (paid === null) return { grant: false, reason: 'WOULD_DOWNGRADE' } // unplaceable ⇒ do not let it win

  if (paid >= held) return { grant: true, carryOverDays } // upgrade, or same tier ⇒ add the time bought
  return { grant: false, reason: 'WOULD_DOWNGRADE' }
}
