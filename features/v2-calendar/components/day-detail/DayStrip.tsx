// §2 — the horizontal date strip: ← / → to the prev/next day + 5 day cards (เลขวัน + ganzhi + %). The
// selected day is sapphire-filled (SELECTED); others carry the day-cell tier %-text (DESIGN.md). Neighbours
// come from goo's deterministic generateMonthDays (hydration-safe) — no network. ← → and the cards are real
// route links (/v2/calendar/[date]); routing itself is goo's and unchanged.
import Link from 'next/link'
import { generateMonthDays, dayCellTier, type CalendarDay } from '../../'
import { DAY_CELL_COLORS, SELECTED } from '../grade-colors'

// The 5-card window centred on `date` (clamped to the month edges — mock month is deterministic).
function windowAround(date: string): { days: CalendarDay[]; prev?: string; next?: string } {
  const [y, m] = date.split('-').map(Number)
  const month = generateMonthDays(y, m)
  const idx = month.findIndex((d) => d.date === date)
  if (idx < 0) return { days: month.slice(0, 5) }
  const start = Math.max(0, Math.min(idx - 2, month.length - 5))
  return {
    days: month.slice(start, start + 5),
    prev: month[idx - 1]?.date,
    next: month[idx + 1]?.date,
  }
}

function ArrowButton({ href, dir, label }: { href?: string; dir: 'l' | 'r'; label: string }) {
  const path = dir === 'l' ? 'M12.5 5 7.5 10l5 5' : 'M7.5 5l5 5-5 5'
  const glyph = (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
      <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  const cls = 'grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-v3-mate-teal to-v3-mate-purple text-white'
  return href ? (
    <Link href={`/v2/calendar/${href}`} aria-label={label} className={cls}>{glyph}</Link>
  ) : (
    <span aria-hidden className={`${cls} opacity-40`}>{glyph}</span>
  )
}

function DayCard({ cell, selected }: { cell: CalendarDay; selected: boolean }) {
  const tint = DAY_CELL_COLORS[dayCellTier(cell.percent)]
  const style = selected
    ? { backgroundColor: SELECTED.fill, color: SELECTED.text }
    : { backgroundColor: '#F4F7FB', color: '#0B305B' }
  return (
    <Link
      href={`/v2/calendar/${cell.date}`}
      aria-label={`วันที่ ${cell.day} ${cell.percent}%`}
      className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-2 leading-none"
      style={style}
    >
      <span className="text-lg font-extrabold">{cell.day}</span>
      <span className="text-[11px] font-medium opacity-90">{cell.ganzhi}</span>
      <span className="text-xs font-bold" style={{ color: selected ? SELECTED.text : tint.text }}>{cell.percent}%</span>
    </Link>
  )
}

export function DayStrip({ date }: { date: string }) {
  const { days, prev, next } = windowAround(date)
  return (
    <div data-testid="day-strip" className="flex items-center gap-2">
      <ArrowButton href={prev} dir="l" label="วันก่อนหน้า" />
      <div className="flex flex-1 items-stretch gap-1.5">
        {days.map((d) => (
          <DayCard key={d.date} cell={d} selected={d.date === date} />
        ))}
      </div>
      <ArrowButton href={next} dir="r" label="วันถัดไป" />
    </div>
  )
}
