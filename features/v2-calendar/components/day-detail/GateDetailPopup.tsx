// features/v2-calendar/components/day-detail/GateDetailPopup.tsx
//
// #2/#4 (ซินแสนุ้ย 2026-09-15): กดช่องในตาราง 8 ประตู → popup รายละเอียด ประตู(八門)+เทพ(十神) ของช่องนั้น
// สไตล์ "ใบเซียมซี" (แบบรูป 2) — หัวตัวจีน ประตู+เทพ ขนาดเท่ากัน (กฎ #5), ชื่อไทย + สรุป(keyword) + คีย์เวิร์ด/การกระทำ.
// เนื้อหา static จาก GATE_INFO/DEITY_INFO (ไม่ใช้ AI).
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { DayDetailGate } from '../../types'
import { GATE_INFO, DEITY_INFO, type GlyphInfo } from './gate-deity-info'
import { SPIRIT_STYLE } from './EightDeities'
import { GATE_ELEMENT, ELEMENT_TINT, DIR_LABEL_TH, type Direction } from './gate-compass'

const inkOfGate = (glyph: string): string => {
  const el = GATE_ELEMENT[glyph.trim()]
  return el ? ELEMENT_TINT[el].ink : '#0B305B'
}
const inkOfDeity = (glyph: string): string => SPIRIT_STYLE[glyph.trim()]?.ink ?? '#1B62B3'

function GlyphBlock({ label, glyph, info, ink }: { label: string; glyph: string; info: GlyphInfo; ink: string }) {
  return (
    <div className="rounded-2xl border border-[#e7d6a8] bg-[#fffdf5] p-3.5" data-testid="gate-detail-block">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-3xl font-black leading-none shadow-sm" style={{ color: ink }}>{glyph}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-v3-text-muted">{label}</p>
          <p className="text-[15px] font-black text-v3-navy">{info.teochew}</p>
          <p className="text-xs font-semibold" style={{ color: ink }}>{info.keyword}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {info.meanings.map((m) => (
          <span key={m} className="rounded-full bg-white px-2.5 py-1 text-[11px] leading-none text-v3-text-body ring-1 ring-[#eadfbf]">{m}</span>
        ))}
      </div>
    </div>
  )
}

export function GateDetailPopup({ direction, gate, onClose }: { direction: Direction; gate: DayDetailGate; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const gateGlyph = gate.name.trim()
  const deityGlyph = gate.deity?.trim() || ''
  const gateInfo = GATE_INFO[gateGlyph]
  const deityInfo = deityGlyph ? DEITY_INFO[deityGlyph] : undefined
  const gInk = inkOfGate(gateGlyph)
  const dInk = deityGlyph ? inkOfDeity(deityGlyph) : gInk

  // portal ไป body: popup ต้องลอยเหนือทุกอย่าง (เดิมติด stacking context ของ ancestor ทำให้แถบเมนูล่างบังส่วนล่าง)
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      data-testid="gate-detail-popup"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-[#fbf3df] p-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[85vh] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="ปิด" data-testid="gate-detail-close" onClick={onClose} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/80 text-v3-text-muted">✕</button>

        {/* หัวใหญ่ตัวจีน — ประตู+เทพ ขนาดเท่ากัน (text-4xl) สไตล์ใบเซียมซี */}
        <div className="mx-auto mb-4 flex w-full max-w-[220px] flex-col items-center rounded-[18px] border-2 border-v3-sapphire bg-[#fdf6e3] px-4 py-4">
          <span className="mb-1 text-[12px] font-bold text-v3-text-muted">{DIR_LABEL_TH[direction]} ({direction})</span>
          {deityGlyph && <span className="text-4xl font-black leading-tight" style={{ color: dInk }}>{deityGlyph}</span>}
          <span className="text-4xl font-black leading-tight" style={{ color: gInk }}>{gateGlyph}</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {deityInfo && <GlyphBlock label="เทพ 十神" glyph={deityGlyph} info={deityInfo} ink={dInk} />}
          {gateInfo && <GlyphBlock label="ประตู 八門" glyph={gateGlyph} info={gateInfo} ink={gInk} />}
          {!deityInfo && !gateInfo && (
            <p className="text-center text-[13px] text-v3-text-body">ยังไม่มีคำอธิบายของช่องนี้</p>
          )}
        </div>

        <p className="mt-3 px-1 text-[11px] leading-4 text-v3-text-muted">คีย์เวิร์ด = การกระทำที่เหมาะกับประตู·เทพนี้ · ใช้เสริมการเลือกทิศประจำวัน</p>
      </div>
    </div>,
    document.body,
  )
}
