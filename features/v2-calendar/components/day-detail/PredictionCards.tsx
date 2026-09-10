// §8 "คำทำนายรายด้าน" — one Grade Card per life-area (DESIGN.md Grade Card 636-21251: bg = grade tint,
// header = title Bold + % in grade colour + badge pill, body = advice lines #71717A). Same 4 areas as §6,
// so the two sections can never disagree — they read the one DayDetailArea[] from the content module.
//
// ฟีม สไลด์ 4 (2026-09-10): ทุกหัวข้อต้องมีคำอธิบายของตัวเอง + กดย่อ/ขยายได้. ตอนนี้ engine ส่ง lines[] ต่อ facet
// มาแล้ว (BFF mapDayDetail เก็บครบ ไม่ทิ้งของที่ไม่ใช่ main) → การ์ดแต่ละใบกดสลับเปิด/ปิดคำอธิบายของ facet นั้นเอง.
// ค่าเริ่มต้น: ด้านหลัก (จุดแข็ง) เปิดไว้ ที่เหลือย่อ — กดหัวการ์ดเพื่อสลับ.
import { useState } from 'react'
import type { DayDetailArea } from '../../types'
import { GradeBadge } from './GradeBadge'
import { SectionCard } from './SectionCard'
import { facetLabel, orderFacets } from './facet-order'
import { gradeColors } from '../grade-colors'
import { percentText } from '../percent-display'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
      className={`flex-none text-v3-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PredictionCard({ area, lines, defaultOpen }: { area: DayDetailArea; lines: string[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const c = gradeColors(area.grade)
  const pctColor = c.badgeText === '#374151' ? '#374151' : c.accent
  const hasLines = lines.length > 0
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: c.bg }} data-testid="day-prediction-card">
      {/* header เป็นปุ่มย่อ/ขยาย — ทั้งแถวกดได้ (ถ้ามีคำอธิบาย); ไม่มีคำอธิบายก็เป็นแถวเฉยๆ ไม่หลอกว่ากดได้ */}
      <button
        type="button"
        onClick={hasLines ? () => setOpen((v) => !v) : undefined}
        aria-expanded={hasLines ? open : undefined}
        className={`flex w-full items-center gap-2 text-left ${hasLines ? '' : 'cursor-default'}`}
      >
        <p className="min-w-0 flex-1 text-base font-bold leading-6 text-v3-navy">{facetLabel(area)}</p>
        <span className="text-sm font-normal leading-[22px]" style={{ color: pctColor }}>{percentText(area.percent)}%</span>
        <GradeBadge grade={area.grade ?? '—'} className="!min-w-[48px]" />
        {hasLines && <Chevron open={open} />}
      </button>
      {hasLines && open && (
        <ul className="mt-1.5 space-y-0.5">
          {lines.map((line, i) => (
            <li key={i} className="text-sm leading-[22px] text-v3-text-muted">{line}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * แต่ละ facet ใช้ `lines` ของตัวเอง (engine man-vs-day ส่งมาครบทุกด้าน). `advice` prop ยังรับไว้เป็น fallback
 * ของด้านหลัก เผื่อ payload เก่าที่ยังไม่มี per-facet lines (compatAreas[].lines ว่าง) จะได้ไม่หายไปเงียบ ๆ.
 */
export function PredictionCards({ areas, advice }: { areas: DayDetailArea[]; advice: string[] }) {
  const mainKey = areas.find((a) => a.isStrength)?.key
  const ordered = orderFacets(areas)
  return (
    <SectionCard title="คำทำนายรายด้าน" testId="day-prediction-cards">
      <div className="flex flex-col gap-3">
        {ordered.map((a) => {
          // per-facet lines ก่อน; ถ้าว่างและเป็นด้านหลัก ใช้ advice เดิม (backward-compat)
          const lines = a.lines.length > 0 ? a.lines : a.key === mainKey ? advice : []
          return <PredictionCard key={a.key || a.label} area={a} lines={lines} defaultOpen={a.key === mainKey} />
        })}
      </div>
    </SectionCard>
  )
}
