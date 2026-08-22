// v2 shop — the ONE place a plan's identity lives (mootech-fe#359, Phase 7).
//
// 🔴 NO PRICES HERE, by DoD: "ราคาที่โชว์บนการ์ด มาจาก /api/payment-package ❌ ไม่ hardcode ในจอ".
// What IS here is the `package_code` each card sells, because /api/payment-package answers ONE code at a
// time (`pages/api/payment-package.ts:12-14` — WHERE package_code = $code LIMIT 1); there is no list
// endpoint, so the screen must know which codes to ask for. Codes are identity, not price.
//
// 🔴 A plan with no sellable code is NOT hidden and NOT silently broken — it renders with
// `sellable: false` and the card refuses to send the user to checkout (see PackageCard). Reason:
// `lib/payment/catalog.ts:35-43` maps every code that exists today to 'PLUS'; nothing maps to 'PRO', and
// `catalog.ts:79-82` throws UnsellablePackageError for an unmapped code. Wiring the Pro card to checkout
// today would charge the user's tap into a guaranteed error. Blocked on mootech-fe#359 (B2, ฟีม's call).
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

// ⚠️ MONTHLY is the only code `lib/payment/catalog.ts` sells today. The annual/monthly split and the Pro
// codes are marketing's call (#359 B3/B4). Adding them here is a one-line change per plan — the mapping
// test (scripts/shop-package-mapping.test.ts) keeps its teeth either way.
export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    name: 'Mumate Free',
    tagline: 'เริ่มต้นใช้งานและเรียนรู้พื้นฐาน',
    features: [
      'ดวงสมพงษ์ การงาน, ความรัก 2 match',
      'ปฏิทินดวงเฉพาะบุคคล (1 เดือน)',
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
      'ดวงสมพงษ์ การงาน, ความรัก 20 match',
      'ปฏิทินดวงเฉพาะบุคคล 1 ปีเต็ม',
      'เชี่ยวมู chat (ชินแซ 24 ชม): 5 คำถาม / วัน',
      'เซียมซี / Oracle Card: 10 ครั้ง / วัน',
    ],
    codes: { monthly: 'MONTHLY', annual: null },
    badge: { label: 'คุ้มค่าที่สุด', tone: 'pumpkin' },
  },
  {
    id: 'pro',
    // The design draws no เซียมซี line for Pro even though Free and + both have one. Confirmed against the
    // rendered frame (636:11973), not inferred: we draw what is drawn (#359 question 3).
    name: 'Mumate Pro',
    tagline: 'สำหรับสายมูตัวจริง หรือต้องการไกด์ไลน์ในช่วงการตัดสินใจครั้งใหญ่ของชีวิต',
    features: [
      'ดวงสมพงษ์ การงาน, ความรัก ไม่จำกัด (Unlimited)',
      'ปฏิทินดวงเฉพาะบุคคล ไม่จำกัด (Unlimited)',
      'เชี่ยวมู chat (ชินแซ 24 ชม): ไม่จำกัด (Unlimited)',
    ],
    codes: { monthly: null, annual: null },
    badge: { label: 'แนะนำ 🔥', tone: 'error' },
  },
]

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
