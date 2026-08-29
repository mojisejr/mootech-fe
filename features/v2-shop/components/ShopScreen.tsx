// features/v2-shop/components/ShopScreen.tsx — "เลือกแพ็คเกจที่ใช่" (Figma 636:11973, 393×2582).
//
// Shell PATTERN copied from ServiceHubScreen: own cream ground + BG01 hero fade + centred max-w column that
// clears the fixed Menubar. NOT AppShell (its ghost-white ground would flatten the white cards).
//
// Deliberate differences from the frame — each one is a promise the app cannot keep today:
//   ① the header copy says "ยกเลิกได้ทุกเมื่อ". There is no auto-renewal in round one (ฟีม 2026-08-13), so
//      there is nothing to cancel. Replaced with what is actually true: จ่ายครั้งเดียว ไม่ต่ออายุอัตโนมัติ.
//   ② the frame floats a Mate AI mascot over the Mumate + card's right edge. Not reproduced: this repo
//      already names that bug-class in its own source —
//      features/v2-calendar/components/upsell/PersonalCalendarUpsell.tsx:28 "a Figma coordinate treated as
//      a layout rule". The footer mascot IS reproduced, in flow, where it overlaps nothing tappable.
//   ③ no bonus box / no "ส่วนลดร้าน" line / Privacy-only legal note — see PackageCard.
import Head from 'next/head'
import Image from 'next/image'
import { useState } from 'react'
import { PillTabs } from '@/components/ui/pill-tabs'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { useClientTier } from '@/features/v2-shell/hooks/useClientTier'
import { useV2User } from '@/features/auth/hooks/useV2User'
import { PLANS, type BillingPeriod } from '../packages'
import { cardVerdictFor, type ViewerMembership } from '../card-verdict'
import { PackageCard } from './PackageCard'

// 🔴 THE ONLY CLOCK READ ON THIS SCREEN, and nothing rendered depends on it.
// `decidePurchase` needs a calendar day to COUNT remaining days; the card never prints that number (the
// binding one comes from /api/v2/payment/preview at checkout). Asia/Bangkok is pinned rather than taken
// from the device so two people looking at the same account on the same evening cannot get different
// answers — the mootech-fe#452 bug-class, where a timezone slid a rendered date back a day.
// 'en-CA' is the locale whose numeric format IS 'YYYY-MM-DD'; no Date arithmetic happens here.
function todayInBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const PERIOD_TABS = [
  { label: 'รายเดือน', value: 'monthly' },
  { label: 'รายปี (คุ้มกว่า 2 เดือน)', value: 'annual' },
]

export function ShopScreen({ teamPreview = false }: { teamPreview?: boolean } = {}) {
  // The design shows รายปี pre-selected.
  const [period, setPeriod] = useState<BillingPeriod>('annual')
  const tier = useClientTier(teamPreview)
  // 🔴 TWO HOOKS, ON PURPOSE — and they are NOT two fetches: useV2Tier.ts:39 already calls useV2User, which
  // de-duplicates /api/user across the page.
  //   · `tier` (useV2Tier) owns the PAID VERDICT, and it is the only thing that tells an anonymous visitor
  //     (KNOWN not-paid, tier.ts:55 → isPaid false) apart from identity-limbo and a failed fetch (both
  //     null, tier.ts:59-64). Reading `user.membership == null` instead would collapse those: a logged-out
  //     visitor would be treated as "we do not know" and LOSE the buy button they have today.
  //   · `user.membership` is borrowed for ONE field, `expireAt`, which V2Tier does not carry (tier.ts:26-33)
  //     and DoD ② needs. Widening V2Tier would drag six other screens through a contract change
  //     (header-badge.ts:31 accepts its result verbatim) for one card's date line.
  const { user } = useV2User()
  //     `source` rides on the SAME composite and must not be dropped here: since #358 Phase 1 a legacy
  //     member's tier NAME is a decision (subscription.ts:26), and `source` is the only field that says so.
  //     Rebuilding the membership without it made both paid cards refuse them (card-verdict.ts, the
  //     display-reads-the-tier/gate-reads-the-source note). Plumbing, not a rule — nothing is decided here.
  const membership: ViewerMembership =
    tier.isPaid == null
      ? null
      : {
          isPaid: tier.isPaid,
          tier: tier.tier,
          source: user?.membership?.source ?? null,
          expireAt: user?.membership?.expireAt ?? null,
        }
  const today = todayInBangkok()

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head>
        <title>เลือกแพ็คเกจที่ใช่ · MuMate</title>
      </Head>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[365px] select-none">
        <Image src="/images/v2/bg/BG01.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-v3-bg-cream/40 to-v3-bg-cream" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* upgradeCta={false}: the อัพเกรด pill's destination IS this screen — it must not point at itself.
            The LEVEL badge is a different object and does show here (#384). The old `showUpgrade={false}`
            suppressed both at once because they were one boolean; they are not one thing. This is the screen
            where a member most needs to see the package they already hold — it is the only screen in the app
            where not knowing it costs them money twice. */}
        <AppHeader testId="shop-header" title="เลือกแพ็คเกจที่ใช่" membership={tier} upgradeCta={false} className="items-center py-4" />

        <p data-testid="shop-intro" className="text-sm leading-6 text-v3-text-body">
          ทุกแพ็คเกจออกแบบมาเพื่อคุณโดยเฉพาะ เลือกแผนที่ตอบโจทย์ไลฟ์สไตล์และเป้าหมายของคุณ
          อัปเกรดเมื่อพร้อม จ่ายครั้งเดียว ไม่ต่ออายุอัตโนมัติ
        </p>

        <div className="mt-5">
          <PillTabs
            variant="calendar"
            ariaLabel="เลือกรอบการชำระเงิน"
            items={PERIOD_TABS}
            value={period}
            onChange={(v) => setPeriod(v as BillingPeriod)}
          />
        </div>

        <div data-testid="shop-plan-list" className="mt-5 flex flex-col gap-5">
          {PLANS.map((plan) => (
            <PackageCard
              key={plan.id}
              plan={plan}
              period={period}
              verdict={cardVerdictFor({
                planId: plan.id,
                determined: tier.isPaid != null,
                loading: tier.loading,
                membership,
                today,
              })}
            />
          ))}
        </div>

        {/* Footer ask + mascot — in flow (not absolutely positioned), so it cannot land on a control. */}
        <section data-testid="shop-footer-ask" className="mt-8 flex items-center gap-4 rounded-3xl bg-white/70 px-6 py-5">
          <div className="flex-1">
            <p className="text-base font-bold leading-6 text-v3-navy">มีคำถามเกี่ยวกับดวงชะตา?</p>
            <p className="mt-1 text-sm leading-5 text-v3-text-body">ให้เราคอยดูแลเคียงข้างคุณทุกเวลา</p>
          </div>
          {/* data-testid is the anchor e2e/v2-shop.spec.ts measures against — the mascot must never overlap
              anything tappable, at any viewport, at any scroll position. */}
          <span data-testid="shop-mascot" className="relative size-16 shrink-0">
            <Image src="/images/v2/mascot/01-nav.png" alt="" fill sizes="64px" style={{ objectFit: 'contain' }} />
          </span>
        </section>
      </div>

      <Menubar />
    </div>
  )
}
