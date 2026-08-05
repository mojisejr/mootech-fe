// features/v2-calendar/components/day-cell-style.ts — "the selected day cell flips to sapphire mode".
//
// Extracted from MonthGrid's JSX (มุน · M-A 2026-08-05) because of a gap บอง traced during M-C review: the
// rule lived as four separate ternaries across two files, had no name, and could only be checked by opening
// a browser — which meant its anchor had to live in harness/, which CI does not run. So the ONE invariant
// that the whole "two colour systems may disagree" argument rests on had nothing enforcing it.
//
// The fix is not "find something to run the browser anchor". It is to move the rule somewhere a plain test
// can reach, and let the browser anchor go back to answering a different question:
//
//     this function      → is the RULE right?     (scripts/day-cell-style.test.ts · CI runs it)
//     run-calendar-month → is the rule PAINTED?   (harness · needs a real browser)
//
// WHY IT IS ONE FUNCTION AND NOT FOUR HELPERS. Selection is a MODE, not four coincidences. Every value the
// cell paints has to move together: miss the background and the tint contradicts the badge; miss any of the
// three text colours and you get dark ink on a sapphire fill, which is not "less pretty", it is unreadable.
// Returning the whole set makes "one of them was forgotten" a thing a test can actually state.
//
// วันพระ is deliberately NOT part of the mode: Figma 368:9929 draws the sapphire fill and the #9D85DA border
// on the same cell, so they are two independent facts about one day. A shipped version once treated them as
// exclusive and was wrong; keeping the border out of this function is what stops that from returning.
import { DAY_CELL_COLORS, SELECTED } from './grade-colors'
import type { DayCellTier } from '../types'

/** every colour a day cell paints, for one (tier, selected) pair. */
export type DayCellStyle = {
  /** cell background */
  bg: string
  /** the day number */
  dayText: string
  /** the 干支 glyph */
  ganzhiText: string
  /** the percent readout */
  pctText: string
}

/** unselected ink — the two fixed navy/sapphire values the grid uses when a cell is not the chosen day. */
const RESTING_DAY_TEXT = '#0B305B'
const RESTING_GANZHI_TEXT = '#1455A4'

/**
 * The rule, in one place: when a cell is selected, EVERY value comes from the sapphire set — never a mix.
 * When it is not, the background and the percent follow its tier and the other two rest on their fixed inks.
 */
export function dayCellStyle(tier: DayCellTier, selected: boolean): DayCellStyle {
  if (selected) {
    return { bg: SELECTED.fill, dayText: SELECTED.text, ganzhiText: SELECTED.text, pctText: SELECTED.text }
  }
  const t = DAY_CELL_COLORS[tier]
  return { bg: t.tint, dayText: RESTING_DAY_TEXT, ganzhiText: RESTING_GANZHI_TEXT, pctText: t.text }
}
