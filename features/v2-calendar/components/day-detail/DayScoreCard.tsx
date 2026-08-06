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
      style={{
        // The background was a hand-written 3-stop linear-gradient standing in for a design nobody had
        // opened. ฟีม: "bg ไม่เหมือน คุนน่าจะ mock มา". Reading 634:8260 with get_design_context settles
        // what it actually is: the card carries a near-white base fill AND a raster IMAGE fill on top —
        // sky-blue with clouds at the top-left, lavender→pink at the bottom-right, white cloud waves along
        // the bottom, and two four-point sparkles. None of that is expressible as a gradient, which is why
        // the gradient could only ever be "sort of like it". So it ships as the artwork it is.
        //
        // The source is 1122×1402 PNG / 1.26 MB. `images.unoptimized` is on, so nothing downstream will
        // compress it — WebP q80 at full source resolution is 10.7 KB (−99.2%), measured, not assumed.
        //
        // COVER, not stretch: the art is portrait (0.80) and the card is landscape (~1.18), so cover crops
        // the top clouds and bottom waves and shows the middle band — which is exactly what Figma's own
        // `object-cover` render shows, sparkles included.
        backgroundColor: '#F2E9FB', // the crop's mean — so a slow image never flashes white under the text
        backgroundImage: "url('/images/v2/calendar/day-score-bg.webp')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
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
