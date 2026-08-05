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

function DayCell({ cell, selected, onSelect }: { cell: CalendarDay; selected: boolean; onSelect: (date: string) => void }) {
  // selection is a MODE — every colour moves together. See day-cell-style.ts for why this is one
  // call and not four ternaries (it is the invariant DESIGN.md §GRADE rests on, and it had no live guard).
  const style = dayCellStyle(dayCellTier(cell.percent), selected)
  return (
    <button
      type="button"
      onClick={() => onSelect(cell.date)}
      // WAS a <Link> to /v2/calendar/[date]. ฟีม ruled that tapping a day moves the highlight and swaps the
      // card underneath — it does not leave the screen; the card's own button is the only way into the day
      // page. A control that navigates is a link; one that changes state on this page is a button, and
      // shipping a <Link> that no longer navigates would lie to everyone reading the markup.
      //
      // WHAT THE CHANGE COSTS, stated because it is a real loss and not a detail: a link could be
      // right-clicked, middle-clicked, opened in a new tab, copied. A button cannot. That is acceptable
      // ONLY because tapping no longer goes anywhere — there is no destination to open in a new tab.
      //
      // aria-current="date" is the standard token for "this is the chosen date among these", so a screen
      // reader announces the selection instead of the user having to infer it from a colour they may not
      // see. The label states the state in words for the same reason.
      aria-current={selected ? 'date' : undefined}
      // the spoken label is a percent RENDER POINT too — it goes through percentText, the one rounding site
      // (#188). A raw number here would read "57.0000001 เปอร์เซ็นต์" to a screen reader while the eye sees 57.
      aria-label={`วันที่ ${cell.day} ${cell.ganzhi} ${percentText(cell.percent)}%${cell.isBuddhistDay ? ' วันพระ' : ''}${selected ? ' (เลือกอยู่)' : ''}`}
      data-testid="calendar-day"
      // the date as data, not parsed back out of an href — anchors key on this now that there is no href
      data-date={cell.date}
      data-selected={selected ? 'true' : undefined}
      data-wanphra={cell.isBuddhistDay ? 'true' : undefined}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-[11px] py-[3px] leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-focus-border"
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
    </button>
  )
}

export function MonthGrid({ weeks, selectedDate, onSelect }: { weeks: CalendarDay[][]; selectedDate: string | null; onSelect: (date: string) => void }) {
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
                : <DayCell key={cell.date} cell={cell} selected={cell.date === selectedDate} onSelect={onSelect} />,
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
