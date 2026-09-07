// features/v2-service/components/WorkResultScreen.tsx — ผลสมพงศ์เพื่อนร่วมงาน (Figma 720:29221 / 720:32490 / 720:26015)
// สเปกจาก design context (MCP, 2026-09-07) — ไม่ใช่จาก screenshot:
//   header  : ← 32 · "ผลความสมพงศ์" 24 bold #0B305B · bell 40 #1B9AAF · avatar 40
//   hero    : การ์ด #1455A4 r22 · px16 pt34 pb24 · gap28 · title ขาว 22 bold 2 บรรทัด · มาสคอต 67×84 มุมบนขวา
//             · **แถวอันดับอยู่ในการ์ด**: กล่อง r16 p8 พื้นตามเกรด (TIER_SOFT) · avatar 40 + rank-badge 22 สีเกรด
//             · ชื่อ 15 bold #0B305B · วันเกิด 14 #464646 · bar h10 bg #EAECEF fill สีเกรด · % 14 bold สีเกรด · badge เกรด w48 px14 py4 r100
//   ปุ่มคู่  : ลอยติดล่างข้าง Mate AI — "บันทึก PDF" #1B9AAF · "แชร์" #1455A4 · h56 r100 · ไอคอน 20 + 16 bold #E1FF00 · เงา
//   การ์ดขาว r16 py24 gap24: toggle "เปิดโหมดแอดวานซ์" (#ECF0FD r50 p16 · Toggle 36×20) · Pill Tabs (#ECF0FD p8 r50 ·
//             tab h40 r50 · active #1455A4 ตัว #E1FF00 16 bold) · การ์ดคนที่เปิด (พื้นเกรด p16 + ชิปธาตุ + วันเกิด + bar)
//   คำอ่าน   : การ์ดขาว r16 p16 gap24 เงา · สรุป 14 #464646 · บล็อกละ ไอคอน 56 #EAF0FA r10 + หัว 16 semibold #464646 + เนื้อ 14 lh22
//             หัว = การงาน / ธุรกิจ / การเงิน (ฟีมเคาะ 2026-09-07) map จากมิติของบทบาท (facets) — ผลเก่าไม่มี facets → 3 มุมมองเดิม
//   แอดวานซ์ : เปิด = โชว์ "ตารางดวงจีน" (ChartTableCard ของคุณ + คนที่เปิด) · ปิด = ซ่อน
// 🔴 ONE SOURCE OF ORDER: แถวอันดับและแท็บมาจาก `entries` เดียวกัน (server เรียงตาม ranking แล้ว) — ห้ามเรียงเอง
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { TopBarBell } from '@/features/v2-shell/components/TopBarBell'
import { TopBarAvatar } from '@/features/v2-shell/components/TopBarAvatar'
import { LoadingScreen } from '@/features/v2-shell/components/LoadingScreen'
import { ComingSoonNotice } from '@/features/v2-shell/components/ComingSoon'
import { ResultActionBar } from './ResultActionBar'
import { gradeTier, TIER_COLOR, TIER_INK, TIER_SOFT, pctWidth } from '../compat-result-parts'
import { useWorkResult } from '../hooks/useWorkResult'
import type { WorkEntry, WorkFacet, WorkRole } from '../work-comparison'
import { orderRoles } from '../work-role-order'
import { colleagueRoleOfRelationship } from '../compatibility'
import { ChartTableCard } from './ChartTableCard'
import { CompatDimensionCard } from './CompatDimensionCard'
import { CompatElementInteractionCard } from './CompatElementInteractionCard'
import { SectionCard } from '@/features/v2-calendar/components/day-detail/SectionCard'
import type { CompatDimension, CompatElementInteraction } from '../compatibility-result'
import { CHART_ELEMENT_SOFT, CHART_PILL_INK, readChartTable, type ChartTable } from '../chart-table'
import { formatCompatBirth } from './compat-format'

const INK_NAVY = '#0B305B'
const INK_BODY = '#464646'

function BackChevron() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
      <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** initials for someone with no photo — Figma 720:29221 draws "TG" in a tinted circle for exactly this */
function initialsOf(name?: string | null): string {
  const n = (name ?? '').trim()
  if (!n) return '—'
  // Thai names have no reliable word split for initials, so take the first rendered character. Array.from
  // walks CODE POINTS, not UTF-16 units: `n[0]` would cut a surrogate pair in half and render a box.
  return Array.from(n)[0] ?? '—'
}

function displayName(entry: WorkEntry): string {
  const first = (entry.person.name ?? '').trim()
  const last = (entry.person.surname ?? '').trim()
  const full = [first, last].filter(Boolean).join(' ')
  // NEVER a blank label: a nameless row is still a person the user chose, and an empty pill reads as a
  // broken screen rather than as missing data.
  return full || 'ไม่ทราบชื่อ'
}

/** วันเกิดของคนในแถว — engine แนบมากับ chart (birthDate/birthTime); ผลเก่าไม่มี → '' (ไม่วาดบรรทัด ไม่เดา) */
function birthLineOf(chart: ChartTable | null, timeKnown: boolean): string {
  if (!chart) return ''
  return formatCompatBirth(chart.birthDate, timeKnown ? chart.birthTime ?? '' : '')
}

/** Figma 720:29221: avatar 40 · รูปจริง หรือ ตัวย่อบน #DAE2FF สี #3758F9 · rank-badge 22 สีเกรด ทับมุมล่าง */
function Avatar({ entry, showRank, badgeTestId }: { entry: WorkEntry; showRank: boolean; badgeTestId: string }) {
  const url = entry.person.pictureUrl?.trim()
  const tier = gradeTier(entry.grade)
  return (
    <span className="relative size-10 shrink-0">
      {url ? (
        <Image src={url} alt="" width={40} height={40} className="size-10 rounded-full object-cover" />
      ) : (
        <span className="grid size-10 place-items-center rounded-full bg-[#DAE2FF] text-[16px] font-bold text-[#3758F9]" aria-hidden>
          {initialsOf(entry.person.name)}
        </span>
      )}
      {/* 🔴 The badge prints the engine's ranking or it does not print at all (ตู๋, mootech-fe#593). */}
      {showRank && entry.rankFromEngine ? (
        <span
          data-testid={badgeTestId}
          className="absolute -bottom-1.5 left-1/2 grid size-[22px] -translate-x-1/2 place-items-center rounded-full text-[12px] font-bold ring-2 ring-white"
          style={{ backgroundColor: TIER_COLOR[tier], color: TIER_INK[tier] }}
        >
          {entry.rank}
        </span>
      ) : null}
    </span>
  )
}

/** Bar Row (Figma): bar h10 #EAECEF + fill สีเกรด · % 14 bold สีเกรด · badge เกรด w48 px14 py4 r100 */
function ScoreRow({ entry }: { entry: WorkEntry }) {
  const tier = gradeTier(entry.grade)
  const pct = pctWidth(entry.rankScore)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="h-[10px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#EAECEF]">
        <span data-testid={`work-score-bar-${entry.rank}`} className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TIER_COLOR[tier] }} />
      </span>
      <span data-testid={`work-score-pct-${entry.rank}`} className="shrink-0 text-[14px] font-bold leading-5" style={{ color: TIER_COLOR[tier] }}>
        {Math.round(entry.rankScore ?? 0)}%
      </span>
      {entry.grade ? (
        <span
          data-testid={`work-grade-${entry.rank}`}
          className="grid w-12 shrink-0 place-items-center rounded-full px-3.5 py-1 text-[16px] font-bold leading-5"
          style={{ backgroundColor: TIER_COLOR[tier], color: TIER_INK[tier] }}
        >
          {entry.grade}
        </span>
      ) : null}
    </div>
  )
}

/** แถวคนหนึ่งคน — ใช้ทั้งในรายการอันดับ (p8) และการ์ดคนที่เปิด (p16 + ชิปธาตุ) */
function PersonRow({ entry, chart, pad, elementChip, testId, badgeTestId, dataAttrs }: {
  entry: WorkEntry
  chart: ChartTable | null
  pad: 'p-2' | 'p-4'
  elementChip?: boolean
  testId: string
  /** testid ของป้ายอันดับ — รายการอันดับใช้ `work-rank-badge-N` (สัญญาเดิม), การ์ดคนที่เปิดใช้ชื่ออื่นกันซ้ำ */
  badgeTestId: string
  dataAttrs?: Record<string, string | number>
}) {
  const tier = gradeTier(entry.grade)
  const birth = birthLineOf(chart, entry.person.timeKnown !== false)
  const element = (chart?.dayElement ?? '').trim()
  return (
    <div data-testid={testId} {...dataAttrs} className={`flex flex-col gap-1 rounded-2xl ${pad}`} style={{ backgroundColor: TIER_SOFT[tier] }}>
      <div className="flex items-center gap-3">
        <Avatar entry={entry} showRank badgeTestId={badgeTestId} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span data-testid={`${testId}-name`} className="truncate text-[15px] font-bold leading-5" style={{ color: INK_NAVY }}>{displayName(entry)}</span>
            {elementChip && element ? (
              <span data-testid={`${testId}-element`} className="rounded-full px-2 py-[2px] text-[12px] font-bold leading-4" style={{ backgroundColor: CHART_ELEMENT_SOFT[element] ?? '#EEF1F4', color: CHART_PILL_INK[element] ?? INK_BODY }}>
                ธาตุ{element}
              </span>
            ) : null}
          </p>
          {birth ? <p data-testid={`${testId}-birth`} className="text-[14px] leading-5" style={{ color: INK_BODY }}>{birth}</p> : null}
        </div>
      </div>
      <ScoreRow entry={entry} />
    </div>
  )
}

/** #ECF0FD r50 p16 · "เปิดโหมดแอดวานซ์" 16 · Toggle 36×20 (base #E5E7EB / on #1455A4, thumb 16) */
function AdvancedToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-[50px] bg-[#ECF0FD] p-4">
      <span className="text-[16px] font-bold leading-6" style={{ color: INK_NAVY }}>เปิดโหมดแอดวานซ์</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        data-testid="work-advanced-toggle"
        onClick={onToggle}
        className="relative h-5 w-9 shrink-0 rounded-xl p-0.5 transition-colors"
        style={{ backgroundColor: on ? '#1455A4' : '#E5E7EB' }}
      >
        <span className={`block size-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  )
}

// ── คำอ่าน (Figma 720:26015): 3 บล็อก ไอคอน 56 #EAF0FA r10 + หัว 16 semibold + เนื้อ 14 lh22 ─────────────────────
/** facet key ของบทบาท → หัวข้อตาม Figma (ฟีมเคาะ 2026-09-07). ไอคอนจาก Figma export (public/images/v2/compat/work/reading-*.svg) */
const READING_OF: Record<string, { title: string; icon: string }> = {
  business: { title: 'ธุรกิจ', icon: '/images/v2/compat/work/reading-2.svg' },
  customer: { title: 'การเงิน', icon: '/images/v2/compat/work/reading-3.svg' },
  entourage: { title: 'บริวาร', icon: '/images/v2/compat/work/reading-1.svg' },
}
const READING_DEFAULT = { title: 'การงาน', icon: '/images/v2/compat/work/reading-1.svg' }
/** ลำดับบล็อกคำทำนาย: มิติหลักของบทบาทก่อน แล้วตามด้วยลำดับที่ engine ให้ */
export function readingOrder(facets: WorkFacet[]): WorkFacet[] {
  return [...facets].sort((a, b) => Number(!!b.isMain) - Number(!!a.isMain))
}
/** facets ของบทบาท → แถวมิติแบบเดียวกับหน้าคู่รัก (CompatDimensionCard) */
export function facetsToDimensions(facets: WorkFacet[]): CompatDimension[] {
  return facets.map((f) => ({ key: f.key, label: f.label, percent: f.percent == null ? null : Math.round(f.percent), grade: f.grade, ratingText: f.ratingText, emoji: f.emoji, isMain: f.isMain }))
}
export function readingOf(key: string): { title: string; icon: string } {
  return READING_OF[key] ?? READING_DEFAULT
}
/** เนื้อคำอ่านของมิติ = คำทำนายรายแท่ง (ก้าน/กิ่ง/สี่ซิ้ง) ต่อกัน — ว่าง = ไม่วาดบล็อก */
export function facetNarrative(f: WorkFacet): string {
  return facetLines(f).join('\n')
}
/** คำอ่านรายแท่ง (ก้าน / กิ่ง / สี่ซิ้ง) ของมิติ — ว่างถูกตัด */
export function facetLines(f: WorkFacet): string[] {
  return f.lines.map((l) => (l.text ?? '').trim()).filter(Boolean)
}

function ReadingBlock({ title, subtitle, icon, lead, lines, index }: { title: string; subtitle?: string; icon?: string; lead?: string; lines: string[]; index: number }) {
  const [open, setOpen] = useState(false)
  const shown = open ? lines : lines.slice(0, 1)
  return (
    <section data-testid={`work-reading-${index}`} data-title={title} className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-[#EAF0FA]">
          {icon ? <Image src={icon} alt="" width={27} height={27} className="size-[27px]" /> : null}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 data-testid={`work-reading-heading-${index}`} className="text-[16px] font-semibold leading-6" style={{ color: INK_BODY }}>{title}</h3>
          {subtitle ? <p className="text-[12px] leading-4 text-v3-text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {lead ? <p className="whitespace-pre-line text-[14px] font-medium leading-[22px]" style={{ color: INK_BODY }}>{lead}</p> : null}
      <div data-testid={`work-reading-text-${index}`} className="flex flex-col gap-2">
        {shown.map((t, i) => <p key={i} className="whitespace-pre-line text-[14px] leading-[22px]" style={{ color: INK_BODY }}>{t}</p>)}
      </div>
      {lines.length > 1 ? (
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 self-start text-[14px] font-medium leading-5 text-[#1B9AAF]">
          {open ? 'ย่อ' : 'อ่านเพิ่ม'}
          <svg viewBox="0 0 16 16" className={`size-[13px] ${open ? '-rotate-90' : 'rotate-90'}`} fill="none" aria-hidden><path d="M4 8h8m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      ) : null}
    </section>
  )
}

/** fallback สำหรับผลเก่าที่ไม่มี facets — 3 มุมมองเดิม (heading = perspective) */
export function roleOrderWithChosen(roles: WorkRole[], chosenPerspective?: string): WorkRole[] {
  if (!chosenPerspective) return roles
  const hit = roles.filter((r) => (r.perspective ?? '').trim() === chosenPerspective)
  if (hit.length === 0) return roles
  return [...hit, ...roles.filter((r) => (r.perspective ?? '').trim() !== chosenPerspective)]
}
function RoleSection({ role, index, chosen = false }: { role: WorkRole; index: number; chosen?: boolean }) {
  const heading = (role.perspective ?? '').trim()
  return (
    <section data-testid={`work-role-${index}`} data-perspective={heading} data-chosen={chosen ? 'true' : undefined} className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-[#EAF0FA]"><Image src={READING_DEFAULT.icon} alt="" width={27} height={27} className="size-[27px]" /></span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 data-testid={`work-role-heading-${index}`} className="text-[16px] font-semibold leading-6" style={{ color: INK_BODY }}>{heading}</h3>
          {chosen ? <span data-testid="work-role-chosen" className="text-[12px] font-bold text-v3-sapphire">มุมมองที่คุณเลือก</span> : null}
        </div>
      </div>
      {role.narrative ? (
        <p data-testid={`work-role-narrative-${index}`} className="whitespace-pre-line text-[14px] leading-[22px]" style={{ color: INK_BODY }}>{role.narrative}</p>
      ) : (
        <p data-testid={`work-role-missing-${index}`} className="text-[14px] leading-[22px] text-v3-text-muted">ยังไม่มีคำอ่านสำหรับมุมมองนี้</p>
      )}
    </section>
  )
}

export function WorkResultScreen({ matchingId }: { matchingId: string }) {
  const router = useRouter()
  const state = useWorkResult(matchingId)
  // which tab is open, by RANK (1-based) — not by array position, so the value stays meaningful if the
  // list is ever re-fetched, and not by slot, which is debug-only.
  const [openRank, setOpenRank] = useState(1)
  // Figma 720:32490: toggle base สีเทา = ปิดเป็นค่าเริ่มต้น; เปิดแล้วโชว์ตารางดวงจีน
  const [advanced, setAdvanced] = useState(false)

  if (state.status === 'loading') {
    return <LoadingScreen title="กำลังเปิดผลลัพธ์" subtitle="อีกสักครู่" />
  }


  const shell = (children: React.ReactNode) => (
    <div data-testid="work-result-screen" className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <ComingSoonNotice />
      <div className="mx-auto w-full max-w-[430px] pb-32">
        <header className="flex items-center gap-2 px-4 pb-6 pt-4">
          <button type="button" aria-label="ย้อนกลับ" data-testid="work-back" onClick={() => router.push('/v2/service/compatibility/recent')} className="grid size-8 place-items-center" style={{ color: INK_NAVY }}>
            <BackChevron />
          </button>
          <h1 data-testid="work-title" className="min-w-0 flex-1 truncate text-[24px] font-bold leading-8" style={{ color: INK_NAVY }}>ผลความสมพงศ์</h1>
          <TopBarBell />
          <TopBarAvatar />
        </header>
        {children}
      </div>
      <ResultActionBar shareText="ผลดวงสมพงศ์เพื่อนร่วมงานของฉันจาก Mumate" testIdPrefix="work" />
    </div>
  )

  // 🔴 The two failures say DIFFERENT things, because they are different for the person reading them.
  if (state.status === 'missing') {
    return shell(
      <p role="alert" data-testid="work-result-missing" className="px-6 pt-16 text-center text-[15px] leading-7 text-v3-text-body">
        <span className="block font-bold text-v3-navy">ไม่พบผลลัพธ์นี้</span>
        <span className="block">ลิงก์อาจเก่าไปแล้ว เปิดจากรายการดูดวงสมพงศ์ล่าสุดได้</span>
      </p>,
    )
  }
  if (state.status === 'failed') {
    return shell(
      <p role="alert" data-testid="work-result-failed" className="px-6 pt-16 text-center text-[15px] leading-7 text-v3-text-body">
        <span className="block font-bold text-v3-navy">เปิดผลลัพธ์ไม่ได้</span>
        <span className="block">ผลของคุณยังอยู่ ลองอีกครั้งในอีกสักครู่</span>
      </p>,
    )
  }

  const entries = state.entries
  if (entries.length === 0) {
    return shell(
      <p role="alert" data-testid="work-result-empty" className="px-6 pt-16 text-center text-[15px] leading-7 text-v3-text-body">
        <span className="block font-bold text-v3-navy">ผลลัพธ์นี้ยังไม่มีใครให้เทียบ</span>
        <span className="block">ลองคำนวณใหม่จากหน้าดูดวงเพื่อนร่วมงาน</span>
      </p>,
    )
  }

  const open = entries.find((e) => e.rank === openRank) ?? entries[0]
  const chosenRole = colleagueRoleOfRelationship(state.relationship)
  const selfChart = readChartTable(state.selfChart)
  const chartOf = (e: WorkEntry) => readChartTable(e.chart)
  const openChart = chartOf(open)
  const facets = (open.facets ?? []).filter((f) => facetLines(f).length > 0 || (f.ratingText ?? '').trim())
  const heroTitle = chosenRole ? chosenRole.label : 'เพื่อนร่วมงาน'

  return shell(
    <>
      {/* hero — Figma 720:29221: การ์ด #1455A4 r22 · title + มาสคอต · แถวอันดับในการ์ด */}
      <section data-testid="work-hero" className="relative mx-4 overflow-hidden rounded-[22px] bg-[#1455A4] px-4 pb-6 pt-[34px]">
        <div className="pointer-events-none absolute right-3 top-2 h-[84px] w-[67px]">
          <Image src="/images/v2/mascot/01.webp" alt="" fill sizes="67px" style={{ objectFit: 'contain' }} />
        </div>
        <h2 data-testid="work-hero-title" data-role={chosenRole?.value ?? ''} className="pr-[72px] text-[22px] font-bold leading-8 text-white">
          <span className="block">{heroTitle}</span>
          <span className="block">ที่เข้ากับคุณได้ดีที่สุดตามลำดับ</span>
        </h2>
        <ol data-testid="work-ranked-list" className="mt-7 flex flex-col gap-1">
          {entries.map((e) => (
            <li key={e.person.friendId || e.rank} data-testid={`work-ranked-${e.rank}`} data-slot={e.slot}>
              <PersonRow entry={e} chart={chartOf(e)} pad="p-2" testId={`work-ranked-${e.rank}-card`} badgeTestId={`work-rank-badge-${e.rank}`} />
            </li>
          ))}
        </ol>
      </section>

      {/* การ์ดขาว: toggle แอดวานซ์ · Pill Tabs · การ์ดคนที่เปิด */}
      <section className="mx-4 mt-4 flex flex-col gap-6 rounded-2xl bg-white py-6">
        <div className="px-4"><AdvancedToggle on={advanced} onToggle={() => setAdvanced((v) => !v)} /></div>
        {/* tabs — same array, same order. data-rank so a test can prove the ORDER, not just the names. */}
        <nav data-testid="work-tabs" className="mx-4 flex items-center rounded-[50px] bg-[#ECF0FD] p-2" aria-label="เลือกคนที่จะดูรายละเอียด">
          {entries.map((e) => {
            const active = e.rank === open.rank
            return (
              <button
                key={e.person.friendId || e.rank}
                type="button"
                data-testid={`work-tab-${e.rank}`}
                data-rank={e.rank}
                aria-pressed={active}
                onClick={() => setOpenRank(e.rank)}
                className={['h-10 min-w-0 flex-1 truncate rounded-[50px] px-2 text-[16px] font-bold leading-6', active ? 'bg-[#1455A4] text-[#E1FF00]' : 'text-[#1455A4]'].join(' ')}
              >
                {displayName(e)}
              </button>
            )
          })}
        </nav>
        <div className="px-4">
          <PersonRow entry={open} chart={openChart} pad="p-4" elementChip testId="work-person" badgeTestId="work-person-rank-badge" dataAttrs={{ 'data-open-rank': open.rank }} />
        </div>
      </section>

      {/* ความเข้ากัน N ด้าน — มิติของบทบาทที่เลือก แบบเดียวกับหน้าคู่รัก (Figma 636:18819 §Grade color) */}
      {facets.length > 0 ? (
        <section data-testid="work-dims" className="mx-4 mt-4">
          <SectionCard title={`ความเข้ากัน ${facets.length} ด้าน`}>
            <div className="flex flex-col gap-6">
              {open.ratingText ? (
                <p data-testid="work-person-summary" className="whitespace-pre-line text-[14px] leading-[22px]" style={{ color: INK_BODY }}>{open.ratingText}</p>
              ) : null}
              {facetsToDimensions(readingOrder(facets)).map((d, i) => <CompatDimensionCard key={d.key ?? i} dimension={d} />)}
            </div>
          </SectionCard>
        </section>
      ) : null}

      {/* คำทำนายรายด้าน — Figma 720:26015: บล็อกไอคอน 56 + หัว 16 semibold + เนื้อ 14 lh22 ("อ่านเพิ่ม" กางคำอ่าน ก้าน/กิ่ง/สี่ซิ้ง) */}
      <section data-testid="work-readings" className="mx-4 mt-4">
        <SectionCard title={facets.length > 0 ? 'คำทำนายรายด้าน' : 'คำทำนายพื้นฐาน'}>
          <div className="flex flex-col gap-6">
            {facets.length > 0 ? (
              readingOrder(facets).map((f, i) => {
                const r = readingOf(f.key)
                return <ReadingBlock key={f.key} index={i + 1} title={r.title} subtitle={f.label} icon={r.icon} lead={f.ratingText} lines={facetLines(f)} />
              })
            ) : (
              <>
                {/* ผลเก่าแบบเส้นรวม (#585) — engine ไม่มี facets ให้: คงคำอ่าน 3 มุมมองเดิม และบอกเมื่อมาไม่ครบ */}
                {open.ratingText ? (
                  <p data-testid="work-person-summary" className="whitespace-pre-line text-[14px] leading-[22px]" style={{ color: INK_BODY }}>{open.ratingText}</p>
                ) : null}
                {!open.rolesComplete ? (
                  <p role="status" data-testid="work-roles-incomplete" className="rounded-xl bg-v3-lemon-chiffon px-3 py-2 text-[14px] leading-[22px]" style={{ color: INK_BODY }}>
                    คำทำนายของคนนี้มาไม่ครบ ขาดอยู่ {open.rolesMissing} จาก 3 มุมมอง
                  </p>
                ) : null}
                <div data-testid="work-roles" data-chosen-role={chosenRole?.value ?? ''} className="flex flex-col gap-6">
                  {roleOrderWithChosen(orderRoles(open.roles), chosenRole?.perspective).map((r, i) => (
                    <RoleSection key={`${open.rank}:${r.perspective ?? i}`} role={r} index={i + 1} chosen={!!chosenRole && (r.perspective ?? '').trim() === chosenRole.perspective} />
                  ))}
                </div>
              </>
            )}
          </div>
        </SectionCard>
      </section>

      {/* โหมดแอดวานซ์ = ตารางดวงจีน (Figma 720:32490 §ตารางดวงจีน) — คุณ + คนที่เปิดแท็บ */}
      {advanced && (selfChart || openChart) ? (
        <section data-testid="work-chart-section" className="mx-4 mt-4 rounded-2xl bg-white px-4 py-5 shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
          <h2 className="text-base font-bold" style={{ color: INK_NAVY }}>ตารางดวงจีน</h2>
          <div className="mt-2.5 border-b border-dashed border-[#EBD9C8]" />
          <div className="mt-3.5 flex flex-col gap-4">
            <CompatElementInteractionCard interaction={open.elementInteraction as CompatElementInteraction | undefined} />
            {selfChart ? <ChartTableCard testId="chart-table-self" roleLabel="คุณ" side="self" chart={selfChart} person={{ name: 'คุณ' }} /> : null}
            {openChart ? (
              <ChartTableCard
                testId="chart-table-open"
                roleLabel="เขา"
                side="other"
                chart={openChart}
                person={{ name: displayName(open), pictureUrl: open.person.pictureUrl, initials: initialsOf(open.person.name), timeKnown: open.person.timeKnown !== false, rank: open.rank }}
              />
            ) : null}
          </div>
        </section>
      ) : null}
      {advanced && !selfChart && !openChart ? (
        <p data-testid="work-chart-unavailable" className="mx-4 mt-4 text-center text-[13px] text-v3-text-muted">ผลนี้คำนวณก่อนมีตารางดวงจีน — คำนวณใหม่เพื่อดูสี่เสาและวัยจร</p>
      ) : null}

      <p className="mt-6 px-4 text-center text-[13px] text-v3-text-muted">
        <Link href="/v2/service/compatibility/recent" className="underline">ดูดวงสมพงศ์ล่าสุด</Link>
      </p>
    </>,
  )
}

export default WorkResultScreen
