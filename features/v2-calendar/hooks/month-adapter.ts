// MuMate v2 — ปฏิทินดวง · adapter: BFF month response → the feature-shape CalendarMonth the grid binds to.
//
// The BFF (/api/v2/calendar-month) returns bazi stripped to raw fields per day (lib/v2-calendar/month
// `CalendarDay`: date · dayOfMonth · dayGanzhi · overallPercent · grade · wanPhra). The month grid binds a
// DIFFERENT shape (features/v2-calendar/types `CalendarDay`: date · day · ganzhi · percent · isBuddhistDay).
// This is the ONE translation seam — a pure FIELD MAP, no value invented. Deterministic (buildMonthGrid is
// fixed-arg → hydration-safe): same (year, month, days) in → same weeks out on server and client.
//
// NOTE — the BFF day's `grade` is deliberately DROPPED: the grid never renders grade (it colours by
// dayCellTier(percent)) and the feature CalendarDay has no `grade` field (G-0c removed it, บอง's "delete,
// don't widen"). No 13→10 projection happens anywhere anymore. The grade a user sees is DayDetail.grade.
//
// features → lib is the allowed import direction, so this lives in the feature (consumes the lib type).
import type { CalendarDay as ApiCalendarDay } from '@/lib/v2-calendar/month'
import type { CalendarDay, CalendarMonth } from '../types'
import { buildMonthGrid } from '../month-grid'

/**
 * One BFF day → one grid cell, or `null` when the day carries no score.
 *
 * `overallPercent === null` means bazi could NOT compute that day (not "0%"). The grid renders `percent` as
 * a number (`${percent}%`, `dayCellTier(percent)`), so a scoreless day cannot be a real cell without
 * fabricating a 0 — returning null lets buildMonthGrid render it as an empty (padding-like) slot instead.
 */
export function apiDayToFeatureDay(d: ApiCalendarDay): CalendarDay | null {
  if (d.overallPercent == null) return null
  return {
    date: d.date,
    day: d.dayOfMonth,
    ganzhi: d.dayGanzhi,
    percent: d.overallPercent,
    isBuddhistDay: d.wanPhra,
  }
}

/**
 * BFF month response days → a feature `CalendarMonth` (weeks grid + flat real-day list).
 * Days with no score are dropped to the empty grid (see apiDayToFeatureDay); buildMonthGrid pads the rest.
 */
export function assembleFeatureMonth(year: number, month: number, apiDays: readonly ApiCalendarDay[]): CalendarMonth {
  const days = apiDays.map(apiDayToFeatureDay).filter((d): d is CalendarDay => d !== null)
  return { year, month, weeks: buildMonthGrid(year, month, days), days }
}
