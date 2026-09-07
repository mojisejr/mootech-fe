// features/v2-service/components/CompatibilityResultScreen.tsx — ดวงสมพงศ์ result screen (Figma 636:18819).
// 3C (scope A, ฟีม 2026-08-02): the TOP is rebuilt into one BLUE HERO (CompatResultHero) — ScoreRing +
// tagline + derived highlights + the two people as mascot cards (mascot art · real photo · name · birthdate).
// This REPLACES the 2E-1 header chips + the separate gradient score card, and the mascots move OUT of the
// รายคน section into the hero. INTENTIONAL spine rebuild (ฟีม 3C, scope A — see line above);
// golden-rule-6 covers the section cards below, whose component files are untouched.
//
// Unchanged below the hero: tabs (D47) · ภาพรวม (overall.ratingText) · รายมิติ (D22) · ธาตุ&เสา (D45+D44) ·
// รายคน (D21). Rule 4 everywhere: an absent field/section hides.
import { useState } from 'react'
import Link from 'next/link'
import { SectionCard } from '@/features/v2-calendar/components/day-detail/SectionCard'
import { LoadingScreen } from '@/features/v2-shell/components/LoadingScreen'
import { useCompatibilityResult } from '../hooks/useCompatibilityResult'
import { compatibilityBackHref, type CompatResultPerson } from '../compatibility-result'
import { COMPAT_CALC_LOADING } from './compat-loading-copy'
import { CompatResultHero } from './CompatResultHero'
import { CompatResultTabs, type CompatTab } from './CompatResultTabs'
import { CompatDimensionCard } from './CompatDimensionCard'
import { CompatElementInteractionCard } from './CompatElementInteractionCard'
import { CompatFourPillarsTable } from './CompatFourPillarsTable'
import { ChartTableCard } from './ChartTableCard'
import { readChartTable } from '../chart-table'
import { CompatPersonDetail } from './CompatPersonDetail'
import { ResultActionBar } from './ResultActionBar'
import { ComingSoonNotice } from '@/features/v2-shell/components/ComingSoon'
import { TopBarBell } from '@/features/v2-shell/components/TopBarBell'
import { TopBarAvatar } from '@/features/v2-shell/components/TopBarAvatar'

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
  // Figma 636:18819: toggle base สีเทา = ปิดเป็นค่าเริ่มต้น; เปิดแล้วโชว์ตารางดวงจีน
  const [advanced, setAdvanced] = useState(false)

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
  // #571 — back returns to the form screen this calculation was made on. The kind comes from the result
  // (i.e. from the row), so it survives a refresh and a direct link; an unmappable type falls back to the
  // hub, same as the empty state above.
  const backHref = compatibilityBackHref(r.result.kind)
  const dims = r.result.dimensions ?? []
  const ei = r.result.elementInteraction
  const { mascotA, mascotB } = r

  // D47 — which sections have data → which tabs to show (never an empty tab)
  // Figma 636:18819 — แท็บ 3 อัน (ภาพรวม → hero · ความเข้ากัน · ทำนายพื้นฐาน) + toggle แอดวานซ์ (= ตารางดวงจีน)
  const hasDims = dims.length > 0
  const chartA = readChartTable(persons?.a?.chart)
  const chartB = readChartTable(persons?.b?.chart)
  const hasElement = !!(ei && (ei.summaryTh || ei.aElementTh || ei.bElementTh)) || !!(persons?.a?.fourPillars || persons?.b?.fourPillars) || !!(chartA || chartB)
  const hasPeople = personHasDetail(persons?.a) || personHasDetail(persons?.b)
  const tabs: CompatTab[] = [
    { key: 'overview', label: 'ภาพรวม' },
    hasDims ? { key: 'dims', label: 'ความเข้ากัน' } : null,
    hasPeople ? { key: 'people', label: 'ทำนายพื้นฐาน' } : null,
  ].filter((t): t is CompatTab => t !== null)

  const onTab = (key: string) => {
    setActiveTab(key)
    if (key === 'overview') { if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    document.getElementById(`compat-sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div data-testid="compat-result-screen" data-state="ready" className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <ComingSoonNotice />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-32 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-2 py-1">
          <Link href={backHref} aria-label="ย้อนกลับ" className="grid size-8 shrink-0 place-items-center rounded-full text-v3-navy"><BackChevron /></Link>
          <h1 data-testid="compat-result-title" className="min-w-0 flex-1 text-[24px] font-bold leading-8 text-v3-navy">ผลดวงสมพงศ์</h1>
          <TopBarBell variant="solid" href="/v2/calendar/notifications" />
          <TopBarAvatar variant="sapphire" />
        </header>

        {/* hero — donut + headline + สรุป + สองคน (Figma 636:18819 §promo-personal-calendar) */}
        <CompatResultHero overall={overall} persons={persons} mascotA={mascotA} mascotB={mascotB} />

        {/* การ์ดขาว r16 py24 gap24: toggle แอดวานซ์ + Pill Tabs (sticky ให้กดได้ระหว่างเลื่อน) */}
        <div className="sticky top-0 z-20 -mx-4 bg-v3-bg-cream/95 px-4 py-2 backdrop-blur-sm">
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between rounded-[50px] bg-[#ECF0FD] p-4">
              <span className="text-[16px] font-bold leading-6 text-[#0B305B]">เปิดโหมดแอดวานซ์</span>
              <button
                type="button"
                role="switch"
                aria-checked={advanced}
                data-testid="compat-advanced-toggle"
                onClick={() => setAdvanced((v) => !v)}
                className="relative h-5 w-9 shrink-0 rounded-xl p-0.5 transition-colors"
                style={{ backgroundColor: advanced ? '#1455A4' : '#E5E7EB' }}
              >
                <span className={`block size-4 rounded-full bg-white shadow transition-transform ${advanced ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            <CompatResultTabs tabs={tabs} active={activeTab} onSelect={onTab} />
          </div>
        </div>

        {/* ความเข้ากัน N ด้าน (Figma: การ์ด r16 py24 px16 gap24 เงา · header 18 + ⓘ) */}
        {hasDims ? (
          <section id="compat-sec-dims" data-testid="compat-sec-dims" className="scroll-mt-28">
            <SectionCard title={`ความเข้ากัน ${dims.length} ด้าน`} info>
              <div className="flex flex-col gap-6">
                {dims.map((d, i) => <CompatDimensionCard key={d.key ?? i} dimension={d} />)}
              </div>
            </SectionCard>
          </section>
        ) : null}

        {/* คำทำนายพื้นฐาน (Figma: การ์ด r20 py24 px16 gap16 · pc ×2 + อ่านเพิ่ม) */}
        {hasPeople ? (
          <section id="compat-sec-people" data-testid="compat-sec-people" className="scroll-mt-28">
            <SectionCard title="คำทำนายพื้นฐาน">
              <div className="flex flex-col gap-4">
                <CompatPersonDetail person={persons?.a} roleLabel="คุณ" side="self" mascot={mascotA} />
                <CompatPersonDetail person={persons?.b} roleLabel="เขา" side="other" mascot={mascotB} />
              </div>
            </SectionCard>
          </section>
        ) : null}

        {/* โหมดแอดวานซ์ = ตารางดวงจีน (Figma 776:9730): ปฏิกิริยาธาตุ + การ์ดคนละใบ (5 เสา ลงสีธาตุ, วัยจร/ปีจร กางได้)
            ผลเก่าที่ engine ยังไม่แนบ chart → ตารางสี่เสาเดิม (ไม่เดาข้อมูล) */}
        {advanced && hasElement ? (
          <section id="compat-sec-element" data-testid="compat-sec-element" className="scroll-mt-28">
            <SectionCard title="ตารางดวงจีน">
              <div className="flex flex-col gap-4">
                <CompatElementInteractionCard interaction={ei} />
                {chartA ? (
                  <ChartTableCard testId="chart-table-a" roleLabel="คุณ" side="self" chart={chartA} person={{ name: persons?.a?.displayName, pictureUrl: persons?.a?.imageProfile, mascotUrl: mascotA?.imageUrl, timeKnown: persons?.a?.timeKnown }} />
                ) : (
                  <CompatFourPillarsTable person={persons?.a} roleLabel="ตัวเรา" side="self" />
                )}
                {chartB ? (
                  <ChartTableCard testId="chart-table-b" roleLabel="เขา" side="other" chart={chartB} person={{ name: persons?.b?.displayName, pictureUrl: persons?.b?.imageProfile, mascotUrl: mascotB?.imageUrl, timeKnown: persons?.b?.timeKnown }} />
                ) : (
                  <CompatFourPillarsTable person={persons?.b} roleLabel="เขา" side="other" />
                )}
              </div>
            </SectionCard>
          </section>
        ) : null}
        {advanced && !hasElement ? (
          <p data-testid="compat-chart-unavailable" className="text-center text-[13px] text-v3-text-muted">ผลนี้ยังไม่มีตารางดวงจีน — คำนวณใหม่เพื่อดูสี่เสาและวัยจร</p>
        ) : null}
      </div>

      <ResultActionBar shareText="ผลดวงสมพงศ์ของฉันจาก Mumate" testIdPrefix="compat" />
    </div>
  )
}

export default CompatibilityResultScreen
