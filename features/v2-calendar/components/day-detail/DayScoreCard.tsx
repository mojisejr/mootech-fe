// §3 — the hero score card (Figma 634:8194): pastel gradient card + the lime/navy ring, a 2-line headline,
// the Thai date, the ganzhi + fortune chips, and the วันพระ row. Grade/percent/ganzhi/summary come from goo's
// DayDetail; the extra chips + วันพระ copy come from the Figma-frozen content module (see content.ts TODO).
import type { DayDetail } from '../../types'
import { directionLabelTH } from './gate-compass'
import { ScoreRing } from './ScoreRing'

const THAI_DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

// Deterministic (route param, not "now") → hydration-safe. `YYYY-MM-DD` → "อังคารที่ 14 กรกฎาคม 2569".
function thaiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dow = THAI_DOW_FULL[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${dow}ที่ ${d} ${THAI_MONTHS[m - 1]} ${y + 543}`
}

// ScoreRing (the lime-progress / navy-track hero ring) is now a shared primitive in ./ScoreRing —
// reused by the compatibility result score card (ดวงสมพงศ์ 2E) instead of duplicated. Markup unchanged.

/**
 * M-D (มุน 2026-08-06) — the chips and the วันพระ row now come from the pipe instead of the frozen module.
 * The chips are `dithi.officer` and `luckyDirection`, both raw ตำรา strings; the 財 chip the mock carried is
 * gone because bazi's eight gates have no 財 (ฟีม's cut — deliberate, not forgotten). Empty strings are
 * dropped rather than rendered as bare "·" separators.
 */
export function DayScoreCard({ detail }: { detail: DayDetail }) {
  // "NE" is not a word a Thai reader uses — the raw compass code was showing on the chip until the render
  // was actually looked at. Labelled too: a lone direction on a fortune card does not say what it is FOR.
  const luckyDir = directionLabelTH(detail.luckyDirection)
  const chips = [detail.dithi?.officer, luckyDir ? `ทิศมงคล ${luckyDir}` : ''].filter((c): c is string => !!c?.trim())
  return (
    <div
      data-testid="day-score"
      className="flex flex-col items-center rounded-[20px] px-5 py-6 text-center"
      style={{ background: 'linear-gradient(150deg, #E8F1FC 0%, #CBC8FC 48%, #FCE3FA 100%)' }}
    >
      <ScoreRing grade={detail.grade} percent={detail.percent} />

      <p className="mt-4 text-lg font-extrabold leading-6 text-v3-navy">{detail.summary}</p>
      <p className="mt-2 text-sm font-bold text-v3-navy">วันนี้ · {thaiDate(detail.date)}</p>

      {/* chips: ganzhi (lime pill) + fortune tags */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-semibold text-v3-navy">
        <span className="rounded-md bg-v3-lime px-2 py-0.5 font-bold text-v3-navy">{detail.ganzhi}</span>
        {chips.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-v3-navy/40">·</span>
            {c}
          </span>
        ))}
      </div>

      {/* วันพระ row */}
      {detail.wanPhra?.isWanPhra && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-v3-navy/80">
          <span className="rounded-full border border-v3-navy/30 bg-white/50 px-2.5 py-1 font-semibold">🙏 วันพระ</span>
          <span>{[detail.wanPhra.label, detail.dayDeity].filter(Boolean).join(' · ')}</span>
        </div>
      )}
    </div>
  )
}
