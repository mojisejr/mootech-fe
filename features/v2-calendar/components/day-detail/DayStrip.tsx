// §2 — the horizontal date strip: ← / → to the prev/next day + 5 day cards. A DATE PICKER, nothing more.
//
// M-D (มุน 2026-08-06, บอง's catch via goo): this strip used to print a % and a 干支 on every card, and
// tint the card by the tier that % fell into — all of it from `generateMonthDays`, the deterministic
// FIXTURE generator (a sine wave). It sat directly above the score ring, which shows the REAL number for
// the same day. Two numbers for one day on one screen, disagreeing: exactly the ONE-NUMBER rule ฟีม set.
// The content team is about to write real copy against this screen, so a fabricated number here would get
// quoted as if it meant something.
//
// Cut, not connected: wiring five real day-scores costs a fetch per neighbour (goo priced it at 2–2.5h) and
// does not fit this pass. What ships is a strip that only claims what it knows — WHICH DAY each card is.
//
// The TINT went with the numbers, and that is the part worth saying out loud: the brief was "cut the fake %
// and 干支", but the background colour was ALSO derived from that fake percent, so leaving it would have
// kept the screen saying "this day is good / this day is bad" in colour after the numbers were gone —
// quieter, and just as false.
//
// The weekday is new and is not invented: it is a property of the date itself. Without it the cards were a
// row of bare numerals, which reads as a broken component rather than a deliberate picker.
//
// Neighbours are computed from the date directly instead of through generateMonthDays, so this file no
// longer imports the fixture generator at all — the fake data cannot come back by accident.
import Link from 'next/link'
import { SELECTED } from '../grade-colors'

const THAI_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

/** ISO date shifted by `delta` days, staying inside the same calendar month (the strip does not cross months). */
function shift(date: string, delta: number): string | undefined {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return undefined
  const next = new Date(Date.UTC(y, m - 1, d + delta))
  if (next.getUTCFullYear() !== y || next.getUTCMonth() !== m - 1) return undefined // off the month's edge
  return `${y}-${String(m).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

/** the 5-card window centred on `date`, clamped so it never runs off the month. */
function windowAround(date: string): { days: string[]; prev?: string; next?: string } {
  const days: string[] = []
  for (let offset = -2; offset <= 2; offset++) {
    const iso = shift(date, offset)
    if (iso) days.push(iso)
  }
  // clamped at an edge → back-fill forward/backward so the row keeps its five slots and does not resize
  for (let offset = 3; days.length < 5 && offset <= 6; offset++) {
    const fwd = shift(date, offset)
    if (fwd && !days.includes(fwd)) days.push(fwd)
  }
  for (let offset = -3; days.length < 5 && offset >= -6; offset--) {
    const back = shift(date, offset)
    if (back && !days.includes(back)) days.unshift(back)
  }
  return { days: days.sort(), prev: shift(date, -1), next: shift(date, 1) }
}

function dayOfWeek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return THAI_DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? ''
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

function DayCard({ iso, selected }: { iso: string; selected: boolean }) {
  const day = Number(iso.slice(8))
  return (
    <Link
      href={`/v2/calendar/${iso}`}
      data-testid="day-strip-card"
      data-date={iso}
      aria-current={selected ? 'date' : undefined}
      aria-label={`วันที่ ${day}${selected ? ' (กำลังดูอยู่)' : ''}`}
      className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-2 leading-none"
      // the ONLY thing colour says here is "this is the day you are looking at" — never a quality
      style={selected ? { backgroundColor: SELECTED.fill, color: SELECTED.text } : { backgroundColor: '#F4F7FB', color: '#0B305B' }}
    >
      <span className="text-[11px] font-medium opacity-70">{dayOfWeek(iso)}</span>
      <span className="text-lg font-extrabold">{day}</span>
    </Link>
  )
}

export function DayStrip({ date }: { date: string }) {
  const { days, prev, next } = windowAround(date)
  return (
    <div data-testid="day-strip" className="flex items-center gap-2">
      <ArrowButton href={prev} dir="l" label="วันก่อนหน้า" />
      <div className="flex flex-1 items-stretch gap-1.5">
        {days.map((iso) => (
          <DayCard key={iso} iso={iso} selected={iso === date} />
        ))}
      </div>
      <ArrowButton href={next} dir="r" label="วันถัดไป" />
    </div>
  )
}
