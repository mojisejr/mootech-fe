// v2 shop — the ONE place a plan's identity lives (mootech-fe#359, Phase 7).
//
// 🔴 NO PRICES HERE, by DoD: "ราคาที่โชว์บนการ์ด มาจาก /api/payment-package ❌ ไม่ hardcode ในจอ".
// What IS here is the `package_code` each card sells, because /api/payment-package answers ONE code at a
// time (`pages/api/payment-package.ts:12-14` — WHERE package_code = $code LIMIT 1); there is no list
// endpoint, so the screen must know which codes to ask for. Codes are identity, not price.
//
// 🔴 A plan with no sellable code is NOT hidden and NOT silently broken — it renders, it says why, and the
// card refuses to send the user to checkout (see PackageCard). `quotePackage` refuses a package that is
// `is_active = false` BEFORE pricing it (lib/payment/catalog.ts:74-76) and refuses one whose tier is not a
// paid tier (`:78-81`) — both throw UnsellablePackageError, i.e. a failure at the till, after the user
// believed they were buying. The screen must not lead anyone there.
//
// 📌 UPDATED after #377 merged (2026-08-22): tiers moved OUT of a hardcoded map and into
// `payment_package.tier_code`, and four real v2 rows landed (lib/db/0009_package_tier.sql:94-104):
//     V2_PLUS_YEARLY   ฿790   1Y  PLUS  is_active=true
//     V2_PRO_YEARLY   ฿1590   1Y  PRO   is_active=true
//     V2_PLUS_MONTHLY    ฿0   1M  PLUS  is_active=false
//     V2_PRO_MONTHLY     ฿0   1M  PRO   is_active=false
// ⇒ B2 is unblocked: the Pro card HAS a sellable code now, and the annual prices are the design's own
//   ฿790 / ฿1,590. The monthly pair exists but is switched off and priced at 0 — the screen must read
//   `is_active`, or it would advertise "฿0 / เดือน" for something nobody can buy.
//
// 🔴 Names: ฟีม decided 2026-08-21 — the SCREEN says `Mumate +` / `Mumate Pro` everywhere, including the
// button. The Figma buttons say `PLUS` / `PRO`; we deliberately diverge (recorded in the PR's
// intended-difference list). `package_code` is separate from the display name, so the money lane is
// unaffected.

/** A billing period the toggle can select. */
export type BillingPeriod = 'monthly' | 'annual'

export type PlanId = 'free' | 'plus' | 'pro'

export type Plan = {
  id: PlanId
  /** Display name — used in the heading AND in the button label (ฟีม 2026-08-21). */
  name: string
  /** One-line pitch under the name. */
  tagline: string
  /** Feature lines, in the order the design shows them for THIS card (the design's own order differs
   *  between cards — #359 ④ — and we reproduce each card as drawn rather than normalising). */
  features: string[]
  /**
   * `package_code` per billing period, or null when nothing sellable exists yet.
   * `free` has no code at all: its button starts the free experience, it never reaches checkout.
   */
  codes: Record<BillingPeriod, string | null>
  /** Badge above the card, if any. */
  badge?: { label: string; tone: 'pumpkin' | 'error' }
}

// The codes below must exist in payment_package with a paid tier — scripts/shop-package-mapping.test.ts
// asserts that against the migration itself, so a typo here reddens `npm test` rather than reaching a user.
// Whether a code is CURRENTLY on sale is a DB fact that changes from /ops without a deploy (#377) ⇒ the
// screen reads it at runtime from /api/payment-package, never from this file.
export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    name: 'Mumate Free',
    tagline: 'เริ่มต้นใช้งานและเรียนรู้พื้นฐาน',
    features: [
      // #573 — the ONLY line on this card that named a quantity without its cycle, so it read as one pool
      // for the life of the package. The real ceiling is per CALENDAR MONTH with no carry-over
      // (lib/v2/entitlement.ts:41 COUNT_PER_MONTH.compatibility, windowed by lib/v2/compat-quota.ts:11-14).
      // The colon and the ' / เดือน' are borrowed from the two lines below rather than invented, so the card
      // gains a consistent rate form instead of one bullet with a bespoke shape.
      'ดวงสมพงษ์ การงาน, ความรัก: 2 match / เดือน',
      // 🔴 #358 — the DEPTH is named, not only the SPAN. Every other bullet on this card is a RATE
      // (2 match / เดือน · 2 ครั้ง / วัน · 1 คำถาม / วัน — the first of those became a rate in #573), so a
      // reader is primed to read a bare '(1 เดือน)' as a quantity and expect the full reading for a month. A free day is a SUMMARY:
      // lib/v2-calendar/day-detail.ts FREE_DAY_DETAIL_FIELDS carries 12 of the 22 fields, and
      // pages/api/v2/day-detail.ts trims the rest before the response is built.
      'ปฏิทินดวงเฉพาะบุคคล เดือนปัจจุบัน (ดูสรุปรายวัน)',
      'เซียมซี / Oracle Card: 2 ครั้ง / วัน',
      'เชี่ยวมู chat (ชินแซ 24 ชม): 1 คำถาม / วัน',
    ],
    codes: { monthly: null, annual: null },
  },
  {
    id: 'plus',
    name: 'Mumate +',
    tagline: 'สำหรับคนใช้ประจำและสายมูระดับเริ่มต้น',
    features: [
      'ดวงสมพงษ์ การงาน, ความรัก: 20 match / เดือน', // #573 — same cycle, same shape as Free
      'ปฏิทินดวงเฉพาะบุคคล 1 ปีเต็ม (รายวันแบบเต็ม)',
      'เชี่ยวมู chat (ชินแซ 24 ชม): 5 คำถาม / วัน',
      'เซียมซี / Oracle Card: 10 ครั้ง / วัน',
    ],
    codes: { monthly: 'V2_PLUS_MONTHLY', annual: 'V2_PLUS_YEARLY' },
    badge: { label: 'คุ้มค่าที่สุด', tone: 'pumpkin' },
  },
  {
    id: 'pro',
    // The design draws no เซียมซี line for Pro even though Free and + both have one. Confirmed against the
    // rendered frame (636:11973), not inferred: we draw what is drawn (#359 question 3).
    name: 'Mumate Pro',
    tagline: 'สำหรับสายมูตัวจริง หรือต้องการไกด์ไลน์ในช่วงการตัดสินใจครั้งใหญ่ของชีวิต',
    features: [
      // #573 DECIDED: Pro is NOT touched, and this is a ruling, not an omission. lib/v2/entitlement.ts:41
      // gives PRO `null` for compatibility — no monthly ceiling exists — so 'ไม่จำกัด / เดือน' would name a
      // cycle that is not there, and a reader who has met the Free and + cards reads a cycle as a cap. The
      // other two Pro bullets are bare 'ไม่จำกัด' for the same reason; changing one of the three would make
      // this card internally uneven while making the set of cards look even.
      'ดวงสมพงษ์ การงาน, ความรัก ไม่จำกัด (Unlimited)',
      'ปฏิทินดวงเฉพาะบุคคล ไม่จำกัด (รายวันแบบเต็ม)',
      'เชี่ยวมู chat (ชินแซ 24 ชม): ไม่จำกัด (Unlimited)',
    ],
    codes: { monthly: 'V2_PRO_MONTHLY', annual: 'V2_PRO_YEARLY' },
    badge: { label: 'แนะนำ 🔥', tone: 'error' },
  },
]

/** #466 — the plan NAME for a tier code, from the SAME list the cards are drawn from.
 *
 *  🔴 A fourth copy of this mapping was the easy move and the wrong one: `plan.ts:24` and
 *  `payment-history.ts:55` already each hold their own, and `PackageCard.tsx:159` records that ฟีม decided
 *  the screen says `Mumate +` / `Mumate Pro` and never `PLUS` / `PRO`. One more hand-typed table is one more
 *  place for that decision to drift out of. This reads PLANS, so a renamed plan renames everywhere at once.
 *
 *  null when the tier is unknown or has no plan — the caller must say something tier-less rather than
 *  print a code at the user. */
export function planNameForTier(tier: string | null | undefined): string | null {
  if (!tier) return null
  const id = tier.toLowerCase()
  return PLANS.find((p) => p.id === id)?.name ?? null
}

/** The code this plan sells for the selected period, or null when it is not sellable yet. */
export function codeFor(plan: Plan, period: BillingPeriod): string | null {
  return plan.codes[period]
}

/** A paid plan is sellable for a period only when a real package_code backs it. */
export function isSellable(plan: Plan, period: BillingPeriod): boolean {
  return plan.id !== 'free' && codeFor(plan, period) !== null
}

/** Where a card sends the user. Free never goes to checkout. */
export function checkoutHrefFor(plan: Plan, period: BillingPeriod): string | null {
  const code = codeFor(plan, period)
  if (plan.id === 'free' || code === null) return null
  return `/v2/shop/checkout?package_code=${encodeURIComponent(code)}`
}
