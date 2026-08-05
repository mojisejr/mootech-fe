// features/v2-calendar/components/MonthGrid.tsx — the ปฏิทินดวง month grid (Figma 368:9832 `calendar-grid`).
//
// Built from `get_design_context` on the node, not from a screenshot. Every value below is one the node
// returned; the tokens it names were ALREADY in tailwind.config.ts and grade-colors.ts — the drift was that
// the shipped grid rendered something else entirely:
//
//   Figma cell : [เลขวัน Bold 13 #0B305B] [干支 Regular 8 #1455A4]  /  [% Bold 12 tier-colour]
//   was        : [เลขวัน] [GRADE LETTER]                            /  [% ]
//
// i.e. the grade letter sat in the exact slot Figma draws the 干支 in, and the 干支 — which `CalendarDay`
// has carried since goo's Phase 0 — was never rendered at all. Figma's grid shows NO grade letter anywhere.
//
// TIERS are goo's `dayCellTier(percent)` (DESIGN.md §CALENDAR: ≥60 / 40–59 / <40) and the hexes are the
// existing DAY_CELL_COLORS. Both match the node exactly (#E2F4F6/#0B7A8C · #FEF1E0/#B47E35 · #FEE7E4/#CD3D2E),
// which is the good kind of surprise: the system was right and only the markup had drifted.
//
// SELECTED + วันพระ COMPOSE. Figma's day-14 cell (368:9929) carries the sapphire fill AND the #9D85DA
// border at the same time, so "today" must not erase the วันพระ marker — they are different facts about the
// same day. The shipped version treated them as exclusive.
import Link from 'next/link'
import { dayCellTier, type CalendarDay } from '@/features/v2-calendar'
import { DAY_CELL_COLORS, CALENDAR_MARKER } from './grade-colors'
import { dayCellStyle } from './day-cell-style'
import { percentText } from './percent-display'

const THAI_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

// Figma legend (368:10025): swatch 14×14 r5 + 9px caption. The วันพระ swatch is white with the marker border,
// i.e. the legend explains the BORDER, not a fill — the shipped legend used a dot and said "วันนี้".
const LEGEND: { label: string; bg: string; border?: string }[] = [
  { label: '≥60% วันดี', bg: DAY_CELL_COLORS.good.tint },
  { label: '40–59%', bg: DAY_CELL_COLORS.medium.tint },
  { label: '<40% ระวัง', bg: DAY_CELL_COLORS.bad.tint },
  { label: 'วันพระ', bg: '#FFFFFF', border: CALENDAR_MARKER },
]

function DayCell({ cell, selected }: { cell: CalendarDay; selected: boolean }) {
  // selection is a MODE — every colour moves together. See day-cell-style.ts for why this is one
  // call and not four ternaries (it is the invariant DESIGN.md §GRADE rests on, and it had no live guard).
  const style = dayCellStyle(dayCellTier(cell.percent), selected)
  return (
    <Link
      href={`/v2/calendar/${cell.date}`}
      aria-label={`วันที่ ${cell.day} ${cell.ganzhi} ${percentText(cell.percent)}%${cell.isBuddhistDay ? ' วันพระ' : ''}`}
      data-testid="calendar-day"
      data-selected={selected ? 'true' : undefined}
      data-wanphra={cell.isBuddhistDay ? 'true' : undefined}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-[11px] py-[3px] leading-none"
      style={{
        backgroundColor: style.bg,
        // วันพระ survives selection — two independent facts, two independent marks (Figma 368:9929)
        border: cell.isBuddhistDay ? `1.6px solid ${CALENDAR_MARKER}` : '1.6px solid transparent',
      }}
    >
      <span className="flex items-center gap-[2px]">
        <span className="text-[13px] font-bold" style={{ color: style.dayText }}>{cell.day}</span>
        <span data-testid="calendar-ganzhi" className="text-[8px] font-normal" style={{ color: style.ganzhiText }}>{cell.ganzhi}</span>
      </span>
      {/* colour from the selection MODE (day-cell-style), number through the ONE rounding site (percent-display) */}
      <span className="text-[12px] font-bold" style={{ color: style.pctText }}>{percentText(cell.percent)}%</span>
    </Link>
  )
}

export function MonthGrid({ weeks, todayISO }: { weeks: CalendarDay[][]; todayISO: string | null }) {
  return (
    <section data-testid="calendar-grid-card" className="flex flex-col gap-[14px] overflow-hidden rounded-[20px] bg-white p-4 shadow-[0_4px_14px_rgba(26,38,77,0.06)]">
      <div className="flex w-full">
        {THAI_DOW.map((d) => (
          <span key={d} className="flex flex-1 items-center justify-center pb-[6px] pt-[2px] text-[12px] leading-[18px] text-v3-text-body">{d}</span>
        ))}
      </div>

      <div data-testid="calendar-grid" className="flex w-full flex-col gap-[2px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex w-full gap-[2px]">
            {week.map((cell, ci) =>
              cell.isPadding
                ? <span key={`${wi}-${ci}`} aria-hidden className="min-w-0 flex-1" />
                : <DayCell key={cell.date} cell={cell} selected={cell.date === (todayISO ?? '')} />,
            )}
          </div>
        ))}
      </div>

      <hr className="border-t border-v3-border-card" />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span
              aria-hidden
              className="size-[14px] shrink-0 rounded-[5px]"
              style={{ backgroundColor: l.bg, border: l.border ? `1.5px solid ${l.border}` : undefined }}
            />
            <span className="text-[9px] leading-none text-v3-text-body">{l.label}</span>
          </span>
        ))}
      </div>
    </section>
  )
}

export default MonthGrid
