// §3 — the hero score card (Figma 634:8194): pastel gradient card + the lime/navy ring, a 2-line headline,
// the Thai date, the ganzhi + fortune chips, and the วันพระ row. Grade/percent/ganzhi/summary come from goo's
// DayDetail; the extra chips + วันพระ copy come from the Figma-frozen content module (see content.ts TODO).
import type { DayDetail } from '../../types'
import type { DayFortuneContent } from './content'

const THAI_DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

// Deterministic (route param, not "now") → hydration-safe. `YYYY-MM-DD` → "อังคารที่ 14 กรกฎาคม 2569".
function thaiDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dow = THAI_DOW_FULL[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${dow}ที่ ${d} ${THAI_MONTHS[m - 1]} ${y + 543}`
}

// The lime-progress / navy-track hero ring with a lime inner disc + navy grade + %.
function ScoreRing({ grade, percent }: { grade: string; percent: number }) {
  const R = 46
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(100, percent))
  return (
    <div className="relative grid size-[132px] place-items-center">
      <svg viewBox="0 0 120 120" className="size-[132px] -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#1B3A6B" strokeWidth="11" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="#E1FF00" strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
        <circle cx="60" cy="60" r="30" fill="#E1FF00" />
      </svg>
      <span className="absolute flex flex-col items-center leading-none">
        <span className="text-[34px] font-extrabold text-v3-navy">{grade}</span>
        <span className="mt-0.5 text-sm font-bold text-v3-navy">{percent}%</span>
      </span>
    </div>
  )
}

export function DayScoreCard({ detail, content }: { detail: DayDetail; content: DayFortuneContent }) {
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
        {content.chips.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-v3-navy/40">·</span>
            {c}
          </span>
        ))}
      </div>

      {/* วันพระ row */}
      {content.buddhistDay && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-v3-navy/80">
          <span className="rounded-full border border-v3-navy/30 bg-white/50 px-2.5 py-1 font-semibold">🙏 วันพระ</span>
          <span>{content.buddhistDay.label} · {content.buddhistDay.deity}</span>
        </div>
      )}
    </div>
  )
}
