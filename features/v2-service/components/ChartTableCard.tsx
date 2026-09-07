// features/v2-service/components/ChartTableCard.tsx — การ์ด "ตารางดวงจีน" ของคน 1 คน
// สเปกจาก Figma design context 720:32490 §ตารางดวงจีน (อ่านผ่าน MCP 2026-09-07):
//   การ์ด: bg ตัวเรา #ECF0FD / เขา #F9F4F0 · p16 · r14 · gap16
//   header: Avatar 40 (ตัวเรา: ring lime #E1FF00 · เขา: ตัวย่อบน #DAE2FF สี #3758F9 + rank-badge #66BB6A 22px) ·
//           ชื่อ 15px #0B305B · element-pill (bg/ink = variables สีธาตุ) 12px · วันเกิด 14px #464646 · มาสคอต 51×70 r16
//   คอลัมน์ ×5 (ปี เดือน วัน ยาม ลัคนา): gap8 · py7 r10 · หัว 14px #464646 · ก้าน/กิ่ง 16px สีตามธาตุของตัวเอง · ธาตุก้าน 14px #464646
//   ปุ่ม: bg #D4DDFC · ตัว #1455A4 14px · px16 py8 · r32 · ไอคอนลูกศร 13px → "โชว์ตารางวัยจร ปีจร"
//   วัยจร/ปีจร (758:3239 / 758:2527): bg #294F74 r24 px20 pt20 pb24 gap14 · หัว 20px bold ขาว ·
//           cell 80×130 ขาว r10 px6 py8 · age-badge bg #E3EDF5 ตัว #294F74 13px bold r8 · glyph 16px bold · pill นักษัตร bg #EEE ตัว #555 11px
// ข้อมูลทั้งหมดจาก engine (chart-table.ts) — จอไม่คำนวณเอง; ไม่ทราบเวลาเกิด → ยาม/ลัคนา "—"
import { useId, useState } from 'react'
import Image from 'next/image'
import { CHART_ELEMENT_SOFT, CHART_PILL_INK, chartInk, type ChartPillar, type ChartTable } from '../chart-table'
import { SIDE_TINT, type SideKey } from '../compat-result-parts'
import { formatCompatBirth } from './compat-format'

const UNKNOWN = '—'
const INK_BODY = '#464646'

function PillarColumn({ head, pillar, unknown, testId }: { head: string; pillar: ChartPillar | null; unknown?: boolean; testId: string }) {
  const show = !unknown && pillar
  return (
    <div data-testid={testId} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[10px] bg-white py-[7px]">
      <span className="text-[14px] leading-5" style={{ color: INK_BODY }}>{head}</span>
      <span className="text-[16px] font-bold leading-6" style={{ color: show ? chartInk(pillar.stemElement) : '#8B8B8B' }}>{show ? pillar.stem : UNKNOWN}</span>
      <span className="text-[16px] font-bold leading-6" style={{ color: show ? chartInk(pillar.branchElement) : '#8B8B8B' }}>{show ? pillar.branch : UNKNOWN}</span>
      <span className="text-[14px] leading-5" style={{ color: INK_BODY }}>{show ? pillar.stemElement || ' ' : UNKNOWN}</span>
    </div>
  )
}

/** ช่อง 80×130 ในตารางวัยจร/ปีจร (758:3242) */
/** ช่องในแถบวัยจร/ปีจร (สถานะกางใน Figma: ช่องขาว 96×150 r12 บนพื้นการ์ด · ป้ายอายุ #DCE8F5 · ปี 15 bold navy + พ.ศ. 12 เทา · glyph 18 · นักษัตร pill #EEE) */
function GanzhiCell({ top, sub2, pillar, animal, badge }: { top: string; sub2?: string; pillar: ChartPillar; animal: string; badge?: boolean }) {
  return (
    <div className="flex h-[150px] w-24 shrink-0 snap-start flex-col items-center justify-between rounded-xl border border-[#E6E1DD] bg-white px-2 py-2.5">
      {badge ? (
        <span className="whitespace-nowrap rounded-lg bg-[#DCE8F5] px-2.5 py-[3px] text-[13px] font-bold leading-[18px] text-[#0B305B]">{top}</span>
      ) : (
        <span className="flex flex-col items-center">
          <span className="text-[15px] font-bold leading-5 text-[#0B305B]">{top}</span>
          {sub2 ? <span className="text-[12px] leading-4 text-[#8C8C8C]">{sub2}</span> : null}
        </span>
      )}
      <span className="text-[18px] font-bold leading-6" style={{ color: chartInk(pillar.stemElement) }}>{pillar.stem}</span>
      <span className="text-[18px] font-bold leading-6" style={{ color: chartInk(pillar.branchElement) }}>{pillar.branch}</span>
      <span className="rounded-lg bg-[#EEEEEE] px-2 py-[3px] text-[11px] font-semibold leading-[18px] text-[#555555]">{animal}</span>
    </div>
  )
}

function ElementPill({ element, testId }: { element: string; testId?: string }) {
  return (
    <span data-testid={testId} className="rounded-full px-2 py-[2px] text-[12px] font-bold leading-4" style={{ backgroundColor: CHART_ELEMENT_SOFT[element] ?? '#EEF1F4', color: CHART_PILL_INK[element] ?? '#464646' }}>
      ธาตุ{element}
    </span>
  )
}

function ArrowIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-[13px] shrink-0 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} fill="none" aria-hidden>
      <path d="M4 8h8m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export type ChartTablePerson = {
  name?: string | null
  /** รูปจริง (ถ้ามี) */
  pictureUrl?: string | null
  /** ตัวย่อเมื่อไม่มีรูป (2 ตัวอักษร) */
  initials?: string
  /** มาสคอต (ถ้ามี — จอคู่รักมีจาก hook; จอเพื่อนร่วมงานยังไม่มี) */
  mascotUrl?: string | null
  /** false → ยาม "—" */
  timeKnown?: boolean
  /** อันดับ (จอเพื่อนร่วมงาน) — ป้ายเขียวใต้รูป */
  rank?: number
}

export function ChartTableCard({ person, chart, roleLabel, side = 'self', testId = 'chart-table' }: {
  person: ChartTablePerson
  chart: ChartTable
  /** ป้ายเมื่อไม่มีชื่อ ("คุณ" / "เขา") */
  roleLabel: string
  side?: SideKey
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const name = (person.name ?? '').trim() || roleLabel
  const hourUnknown = person.timeKnown === false || chart.birthTime === null
  const birth = formatCompatBirth(chart.birthDate, hourUnknown ? '' : chart.birthTime ?? '')
  const pic = (person.pictureUrl ?? '').trim()
  const mascot = (person.mascotUrl ?? '').trim()
  const element = (chart.dayElement ?? '').trim()
  const hasLuck = chart.daYun.length > 0 || chart.liuNian.length > 0

  return (
    <section data-testid={testId} data-side={side} className="flex flex-col gap-4 rounded-[14px] p-4" style={{ backgroundColor: SIDE_TINT[side] }}>
      {/* header — Avatar · ชื่อ+ชิปธาตุ · วันเกิด · มาสคอต */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {pic ? (
            <span className={`relative block size-10 overflow-hidden rounded-full ${side === 'self' ? 'ring-[3px] ring-[#E1FF00]' : ''}`}>
              <Image src={pic} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
            </span>
          ) : (
            <span className="grid size-10 place-items-center rounded-full bg-[#DAE2FF] text-[16px] font-bold text-[#3758F9]">{(person.initials ?? name.slice(0, 2)).toUpperCase()}</span>
          )}
          {person.rank ? (
            <span data-testid={`${testId}-rank`} className="absolute -bottom-1.5 left-1/2 grid size-[22px] -translate-x-1/2 place-items-center rounded-full bg-[#66BB6A] text-[12px] font-bold text-white ring-2 ring-white">
              {person.rank}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="flex flex-wrap items-center gap-2">
            <span data-testid={`${testId}-name`} className="truncate text-[15px] font-bold leading-5 text-[#0B305B]">{name}</span>
            {element ? <ElementPill element={element} testId={`${testId}-element`} /> : null}
          </p>
          {birth ? <p data-testid={`${testId}-birth`} className="text-[14px] leading-5" style={{ color: INK_BODY }}>{birth}{hourUnknown ? ' · ไม่ทราบเวลา' : ''}</p> : null}
        </div>
        {mascot ? (
          <span className="relative h-[70px] w-[51px] shrink-0 overflow-hidden rounded-2xl">
            <Image src={mascot} alt="" fill sizes="51px" style={{ objectFit: 'cover' }} />
          </span>
        ) : null}
      </div>
      <div className="border-b border-dashed border-[#EBD9C8]" />

      {/* 5 คอลัมน์ */}
      <div className="flex items-stretch gap-2">
        <PillarColumn head="ปี" pillar={chart.pillars.year} testId={`${testId}-pillar-year`} />
        <PillarColumn head="เดือน" pillar={chart.pillars.month} testId={`${testId}-pillar-month`} />
        <PillarColumn head="วัน" pillar={chart.pillars.day} testId={`${testId}-pillar-day`} />
        <PillarColumn head="ยาม" pillar={chart.pillars.hour} unknown={hourUnknown} testId={`${testId}-pillar-hour`} />
        <PillarColumn head="ลัคนา" pillar={chart.pillars.ascendant} unknown={hourUnknown || !chart.pillars.ascendant} testId={`${testId}-pillar-ascendant`} />
      </div>
      {hourUnknown ? <p className="text-[12px] text-v3-text-muted">* ไม่ทราบเวลาเกิด — เสายามและลัคนาจึงไม่แสดง</p> : null}


      {open ? (
        <div id={panelId} data-testid={`${testId}-luck`} className="flex flex-col gap-3">
          {chart.daYun.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[16px] font-bold leading-6 text-[#0B305B]">วัยจร</p>
              {/* สถานะกางใน Figma: แถวเดียว เลื่อนแนวนอน ช่องขนาดจริง */}
              <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
                <div data-testid={`${testId}-dayun`} className="flex w-max snap-x gap-2.5">
                  {chart.daYun.map((d) => <GanzhiCell key={d.ageRange} top={d.ageRange} pillar={d} animal={d.animal} badge />)}
                </div>
              </div>
            </div>
          ) : null}
          {chart.liuNian.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-[16px] font-bold leading-6 text-[#0B305B]">ปีจร</p>
              {/* ปีจรจาก engine = 15 ปีนับจากปีปัจจุบัน (ผู้ใช้เคาะ 2026-09-07) */}
              <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
                <div data-testid={`${testId}-liunian`} className="flex w-max snap-x gap-2.5">
                  {chart.liuNian.map((y) => <GanzhiCell key={y.year} top={String(y.year)} sub2={`พ.ศ. ${y.yearBE}`} pillar={y} animal={y.animal} />)}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {/* ปุ่มกาง — pill #D4DDFC / #1455A4 */}
      {hasLuck ? (
        <button
          type="button"
          data-testid={`${testId}-toggle`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-1 rounded-[32px] border border-[#1455A4] bg-[#D4DDFC] px-4 py-2 text-[14px] font-medium leading-5 text-[#1455A4]"
        >
          <span>{open ? 'ย่อตารางวัยจร ปีจร' : 'โชว์ตารางวัยจร ปีจร'}</span>
          <ArrowIcon open={open} />
        </button>
      ) : null}
    </section>
  )
}

export default ChartTableCard
