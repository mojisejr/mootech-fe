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
import { PLANS, type BillingPeriod } from '../packages'
import { PackageCard } from './PackageCard'

const PERIOD_TABS = [
  { label: 'รายเดือน', value: 'monthly' },
  { label: 'รายปี (คุ้มกว่า 2 เดือน)', value: 'annual' },
]

export function ShopScreen() {
  // The design shows รายปี pre-selected.
  const [period, setPeriod] = useState<BillingPeriod>('annual')

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
        {/* showUpgrade={false}: the อัพเกรด pill's destination IS this screen — it must not point at itself. */}
        <AppHeader testId="shop-header" title="เลือกแพ็คเกจที่ใช่" showUpgrade={false} className="items-center py-4" />

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
            <PackageCard key={plan.id} plan={plan} period={period} />
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
