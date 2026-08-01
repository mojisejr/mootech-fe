// features/v2-service/components/CompatibilityResultScreen.tsx — ดวงสมพงศ์ result screen (Figma 636:18819).
// 3C (scope A, ฟีม 2026-08-02): the TOP is rebuilt into one BLUE HERO (CompatResultHero) — ScoreRing +
// tagline + derived highlights + the two people as mascot cards (mascot art · real photo · name · birthdate).
// This REPLACES the 2E-1 header chips + the separate gradient score card, and the mascots move OUT of the
// รายคน section into the hero. INTENTIONAL spine rebuild (documented in compat-3c.verify-evidence.md);
// golden-rule-6 covers the section cards below, whose component files are untouched.
//
// Unchanged below the hero: tabs (D47) · ภาพรวม (overall.ratingText) · รายมิติ (D22) · ธาตุ&เสา (D45+D44) ·
// รายคน (D21). Rule 4 everywhere: an absent field/section hides.
import { useState } from 'react'
import Link from 'next/link'
import { SectionCard } from '@/features/v2-calendar/components/day-detail/SectionCard'
import { LoadingScreen } from '@/features/v2-shell/components/LoadingScreen'
import { useCompatibilityResult } from '../hooks/useCompatibilityResult'
import type { CompatResultPerson } from '../compatibility-result'
import { COMPAT_CALC_LOADING } from './compat-loading-copy'
import { CompatResultHero } from './CompatResultHero'
import { CompatResultTabs, type CompatTab } from './CompatResultTabs'
import { CompatDimensionCard } from './CompatDimensionCard'
import { CompatElementInteractionCard } from './CompatElementInteractionCard'
import { CompatFourPillarsTable } from './CompatFourPillarsTable'
import { CompatPersonDetail } from './CompatPersonDetail'

function BackChevron() {
  return (
    <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
      <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function personHasDetail(p?: CompatResultPerson): boolean {
  return !!(p && (p.dayGanzhi || p.stageTh || p.elementTh || (p.nisai && p.nisai.length)))
}

export function CompatibilityResultScreen({ matchingId }: { matchingId: string }) {
  const r = useCompatibilityResult(matchingId)
  const [activeTab, setActiveTab] = useState('overview')

  // D17/2F — the SAME loader/copy the form showed, so form → result is one continuous screen.
  if (r.loading) {
    return <LoadingScreen title={COMPAT_CALC_LOADING.title} subtitle={COMPAT_CALC_LOADING.subtitle} />
  }

  // no result / parse failure → honest fallback (never a spinner, never fabricated data)
  if (r.error || !r.result) {
    return (
      <div data-testid="compat-result-screen" data-state="empty" className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-v3-bg-cream px-8 text-center font-ibm">
        <p className="text-[17px] font-bold text-v3-navy">ยังไม่พบผลลัพธ์</p>
        <p className="text-[15px] leading-6 text-v3-text-body">ผลดวงสมพงศ์นี้อาจหมดอายุหรือยังไม่ถูกคำนวณ ลองเริ่มใหม่จากหน้าบริการ</p>
        <Link href="/v2/service" className="rounded-[100px] bg-v3-sapphire px-6 py-3 text-[15px] font-semibold text-white">กลับไปหน้าบริการ</Link>
      </div>
    )
  }

  const { overall, persons } = r.result
  const dims = r.result.dimensions ?? []
  const ei = r.result.elementInteraction
  const { mascotA, mascotB } = r

  // D47 — which sections have data → which tabs to show (never an empty tab)
  const hasOverview = !!(overall?.ratingText)
  const hasDims = dims.length > 0
  const hasElement = !!(ei && (ei.summaryTh || ei.aElementTh || ei.bElementTh)) || !!(persons?.a?.fourPillars || persons?.b?.fourPillars)
  const hasPeople = personHasDetail(persons?.a) || personHasDetail(persons?.b)
  const tabs: CompatTab[] = [
    hasOverview ? { key: 'overview', label: 'ภาพรวม' } : null,
    hasDims ? { key: 'dims', label: 'รายมิติ' } : null,
    hasElement ? { key: 'element', label: 'ธาตุ & เสา' } : null,
    hasPeople ? { key: 'people', label: 'รายคน' } : null,
  ].filter((t): t is CompatTab => t !== null)

  const onTab = (key: string) => {
    setActiveTab(key)
    if (key === 'overview') { if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    document.getElementById(`compat-sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div data-testid="compat-result-screen" data-state="ready" className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* header — D20: "ผลดวงสมพงศ์" (NOT "รายละเอียดวัน") */}
        <header className="flex items-center gap-2 py-1">
          <Link href="/v2/service" aria-label="ย้อนกลับ" className="grid size-8 shrink-0 place-items-center rounded-full text-v3-navy"><BackChevron /></Link>
          <h1 data-testid="compat-result-title" className="min-w-0 flex-1 text-[22px] font-bold leading-8 text-v3-navy">ผลดวงสมพงศ์</h1>
        </header>

        {/* 3C hero — score + tagline + highlights + the two people as mascot cards (replaces chips + score card) */}
        <CompatResultHero overall={overall} persons={persons} dimensions={dims} mascotA={mascotA} mascotB={mascotB} />

        {/* D47 tabs — only sections that have data; < 2 → no bar. Sticky so they stay usable while scrolling. */}
        {tabs.length >= 2 ? (
          <div className="sticky top-0 z-20 -mx-4 bg-v3-bg-cream/95 px-4 py-2 backdrop-blur-sm">
            <CompatResultTabs tabs={tabs} active={activeTab} onSelect={onTab} />
          </div>
        ) : null}

        {/* ภาพรวม — overall.ratingText (the white personality card, unchanged from 2E-1) */}
        {overall?.ratingText ? (
          <SectionCard title="ภาพรวม" info>
            <p data-testid="compat-result-overview" className="whitespace-pre-line text-[15px] leading-[26px] text-v3-text-body">{overall.ratingText}</p>
          </SectionCard>
        ) : null}

        {/* รายมิติ (D22) */}
        {hasDims ? (
          <section id="compat-sec-dims" data-testid="compat-sec-dims" className="flex scroll-mt-16 flex-col gap-3">
            <h2 className="text-[16px] font-bold text-v3-navy">ความเข้ากัน {dims.length} ด้าน</h2>
            {dims.map((d, i) => <CompatDimensionCard key={d.key ?? i} dimension={d} />)}
          </section>
        ) : null}

        {/* ธาตุ & เสา (D45 + D44; D23: timeKnown=false → ยาม "—") */}
        {hasElement ? (
          <section id="compat-sec-element" data-testid="compat-sec-element" className="flex scroll-mt-16 flex-col gap-3">
            <CompatElementInteractionCard interaction={ei} />
            <CompatFourPillarsTable person={persons?.a} roleLabel="ตัวเรา" />
            <CompatFourPillarsTable person={persons?.b} roleLabel="เขา" />
          </section>
        ) : null}

        {/* รายคน (D21 per-person; มาสคอต moved to the hero) */}
        {hasPeople ? (
          <section id="compat-sec-people" data-testid="compat-sec-people" className="flex scroll-mt-16 flex-col gap-3">
            <CompatPersonDetail person={persons?.a} roleLabel="ตัวเรา" />
            <CompatPersonDetail person={persons?.b} roleLabel="เขา" />
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default CompatibilityResultScreen
