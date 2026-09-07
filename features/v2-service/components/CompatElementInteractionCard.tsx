// features/v2-service/components/CompatElementInteractionCard.tsx — ดวงสมพงศ์ 2E-2 · D45 "ปฏิกิริยาธาตุ".
// Figma 636:18819: element chip (ตัวเรา) — a directional relation — element chip (เขา), then the summaryTh
// prose. Contract CompatElementInteraction { aElementTh, bElementTh, summaryTh, aToB, bToA }. The engine's
// summaryTh is the source of truth for the dynamic; the aToB/bToA labelTh are shown as secondary chips when
// present (I do NOT guess which direction is the "headline" — see the flag in the 2E-2 handoff). Rule 4: no
// element data and no summary → render null.
import type { CompatElementInteraction } from '../compatibility-result'
import { wuxing } from '../compat-result-parts'
import { chartInk } from '../chart-table'
import { ElementPill } from './CompatResultHero'
import { useId } from 'react'

// Figma 636:18819 §flow/chip (parity 2026-09-07): tile 56 r16 (bg = glyph at 16%, hanzi 24 bold) · gap6 ·
// role 15 bold #0B305B · element-pill 12 bold (same PillWrapper as the hero / person cards)
function ElementChip({ elementTh, roleLabel }: { elementTh?: string | null; roleLabel: string }) {
  const wx = wuxing(elementTh)
  const th = (elementTh ?? '').trim()
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span data-testid="compat-element-chip" className="grid size-14 place-items-center rounded-2xl text-[24px] font-bold" style={{ backgroundColor: wx.bg, color: wx.fg }}>
        {wx.hanzi || th.charAt(0) || '—'}
      </span>
      <span className="flex flex-col items-center gap-0.5">
        <span className="text-[15px] font-bold text-v3-navy">{roleLabel}</span>
        <ElementPill elementTh={th} />
      </span>
    </div>
  )
}

/**
 * ป้ายลูกศร (Figma 776:9730 §flow): บน = ประโยคธาตุ "ทองข่มน้ำ" (cyan 15) · ล่าง = ชื่อชั้นความสัมพันธ์ "พิฆาต" (เทา 14)
 * engine ส่งคีย์อังกฤษ (same/resource/output/power/wealth) — ห้ามหลุดไปโชว์ดิบ (ผู้ใช้เจอ "resource" บนจอ 2026-09-07)
 * ทิศทาง: aToB = เขา (B) อยู่ในฐานะอะไรของเรา (A) → power = เขาข่มเรา · wealth = เราข่มเขา · resource = เขาส่งเสริมเรา · output = เราถ่ายเทให้เขา
 */
export function relationArrowLabels(rel: string | undefined, a: string, b: string): { top: string; bottom: string } {
  const A = a || 'เรา'
  const B = b || 'เขา'
  switch ((rel ?? '').trim()) {
    case 'same': return { top: `${A}คู่ธาตุ${B}`, bottom: 'คู่ธาตุ' }
    case 'resource': return { top: `${B}ส่งเสริม${A}`, bottom: 'ส่งเสริม' }
    case 'output': return { top: `${A}ถ่ายเทให้${B}`, bottom: 'ถ่ายเท' }
    case 'power': return { top: `${B}ข่ม${A}`, bottom: 'พิฆาต' }
    case 'wealth': return { top: `${A}ข่ม${B}`, bottom: 'พิฆาต' }
    default: return { top: '', bottom: '' }
  }
}

export function CompatElementInteractionCard({ interaction }: { interaction?: CompatElementInteraction }) {
  const i = interaction
  const a = (i?.aElementTh ?? '').trim()
  const b = (i?.bElementTh ?? '').trim()
  const { top: relLabel, bottom: relKind } = relationArrowLabels(i?.aToB?.relation, a, b)
  const hasElements = !!(a || b)
  const inkA = chartInk(a)
  const inkB = chartInk(b)
  const gradId = useId()
  // ย่อหน้าสรุป "ดิถีเรา (ไฟ) มองเขา (ไม้) เป็น…" ของ engine ถูกตัดออก (ฟีม สไลด์ 15 "ตัดออก" + ผู้ใช้ย้ำ 2026-09-07)
  if (!hasElements) return null

  return (
    <section data-testid="compat-element-interaction" className="flex flex-col gap-4">
      {/* Figma: หัว 16 bold #1F2937 (= v3-text-price) · flow gap4 · arr: ป้ายบน 15 bold · ลูกศร 40×16 · ป้ายล่าง 14/22 #94A3B8 */}
      <p className="text-[16px] font-bold text-v3-text-price">ปฏิกิริยาธาตุ</p>
      {hasElements ? (
        <div className="flex items-start justify-center gap-1">
          <ElementChip elementTh={i?.aElementTh} roleLabel="ตัวเรา" />
          <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1">
            {/* ผู้ใช้เคาะ 2026-09-07: ลูกศร+ป้ายบนไล่สีตามธาตุ เรา → เขา (Figma เดิมเป็น cyan ตายตัว) */}
            {relLabel ? <span data-testid="compat-element-rel" className="text-center text-[15px] font-bold" style={{ color: inkB }}>{relLabel}</span> : null}
            <svg viewBox="0 0 40 16" className="h-4 w-10" fill="none" aria-hidden data-testid="compat-element-arrow">
              <defs><linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor={inkA} /><stop offset="1" stopColor={inkB} /></linearGradient></defs>
              <path d="M1 8h34m0 0-6-6m6 6-6 6" stroke={`url(#${gradId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {relKind ? <span className="text-center text-[14px] leading-[22px] text-v3-slate-muted">{relKind}</span> : null}
          </div>
          <ElementChip elementTh={i?.bElementTh} roleLabel="เขา" />
        </div>
      ) : null}
    </section>
  )
}

export default CompatElementInteractionCard
