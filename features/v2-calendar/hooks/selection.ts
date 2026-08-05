// MuMate v2 — ปฏิทินดวง · selected-day RULE (pure, DB-free, screen-free, hydration-safe).
//
// ฟีม's behaviour (FROZEN 2026-08-05) + บอง's month-change ruling: the card must ALWAYS show a day — there
// is no "empty" state. So on entering a month:
//   • today is a real day of this month  → select today
//   • otherwise                          → select day 1 of that month
// Manual selection (selectDay) persists WITHIN a month; changing month re-applies this rule (the old
// silent "day 14" fallback — month.days[13] — is gone). Pure so it's unit-tested without a browser.
import type { CalendarMonth } from '../types'

/** First day of a month as ISO (fallback when the month has no real days — shouldn't happen for a real grid). */
function firstOfMonthISO(month: CalendarMonth): string {
  return `${month.year}-${String(month.month).padStart(2, '0')}-01`
}

/**
 * The date a month should default-select: today if today is a real (non-padding) day of THIS month, else
 * the month's first real day. `todayISO` is null before mount (hydration fence) → then no day matches →
 * day 1, which is exactly what server + first client paint should agree on.
 */
export function defaultSelectedDate(month: CalendarMonth, todayISO: string | null): string {
  if (todayISO && month.days.some((d) => d.date === todayISO)) return todayISO
  return month.days[0]?.date ?? firstOfMonthISO(month)
}

/** Whether `date` is a selectable real (non-padding) day of this month — selectDay ignores anything else. */
export function isSelectableDate(month: CalendarMonth, date: string): boolean {
  return month.days.some((d) => d.date === date)
}
