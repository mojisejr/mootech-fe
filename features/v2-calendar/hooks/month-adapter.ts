// MuMate v2 — ปฏิทินดวง · adapter: BFF month response → the feature-shape CalendarMonth the grid binds to.
//
// The BFF (/api/v2/calendar-month) returns bazi stripped to 6 raw fields per day (lib/v2-calendar/month
// `CalendarDay`: date · dayOfMonth · dayGanzhi · overallPercent · grade · wanPhra). The month grid binds a
// DIFFERENT shape (features/v2-calendar/types `CalendarDay`: date · day · ganzhi · percent · grade ·
// isBuddhistDay). This is the ONE translation seam — a pure FIELD MAP, no value invented, no grade
// re-derived. Deterministic (buildMonthGrid is fixed-arg → hydration-safe): same (year, month, days) in →
// same weeks out on server and client.
//
// features → lib is the allowed import direction, so this lives in the feature (consumes the lib type).
import type { CalendarDay as ApiCalendarDay } from '@/lib/v2-calendar/month'
import { parseApiGrade } from '@/lib/v2/api-grade'
import type { CalendarDay, CalendarMonth, Grade } from '../types'
import { buildMonthGrid } from '../month-grid'

// ⚠️ INTERIM — the grid cell's `grade` is a VESTIGIAL field: MonthGrid colours cells by dayCellTier(percent),
// it never renders grade (grep-verified). But the shared feature `CalendarDay.grade` is the 10-level UI
// `Grade`, while bazi's day grade is 13-level (F / A- / A+ extra). Widening the type ripples into non-lane
// files (fixtures.ts reads a CalendarDay's grade AS a Grade) — บอง's "don't touch the type" holds. So here
// we PROJECT the 3 orphans to the nearest 10-level grade PURELY to satisfy the type on a field nothing
// displays. The AUTHORITATIVE grade for anything shown to a user is DayDetail.grade (the day-detail path)
// where the real 13-level → colour decision is μุน's M-C. This projection is flagged to บอง, not silent.
const GRADE_10 = new Set<string>(['A', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-'])
function apiGradeToUiGrade(raw: string): Grade {
  const g = parseApiGrade(raw) // validates against the 13; THROWS on an unknown grade (loud, never silent)
  if (g === null) return 'D-' // unreachable in practice (grade tracks percent) — vestigial safety only
  if (GRADE_10.has(g)) return g as Grade
  if (g === 'A+' || g === 'A-') return 'A' // orphans above the 10-scale top → its top
  return 'D-' // 'F' — orphan below the 10-scale bottom → its bottom
}

/**
 * One BFF day → one grid cell, or `null` when the day carries no score.
 *
 * `overallPercent === null` means bazi could NOT compute that day (not "0%"). The grid renders `percent` as
 * a number (`${percent}%`, `dayCellTier(percent)`), so a scoreless day cannot be a real cell without
 * fabricating a 0 — returning null lets buildMonthGrid render it as an empty (padding-like) slot instead.
 * (A cleaner "no-score" cell state needs a UI/type change in the grid's lane; tracked with the loading
 * seam, not smuggled in as a fake 0 here.)
 *
 * `grade` is carried RAW — bazi's letter (13-level, may be A+/A-/F or null). The grid never colours by it,
 * so there is no 13→10 lossy mapping at this seam.
 */
export function apiDayToFeatureDay(d: ApiCalendarDay): CalendarDay | null {
  if (d.overallPercent == null || d.grade == null) return null
  return {
    date: d.date,
    day: d.dayOfMonth,
    ganzhi: d.dayGanzhi,
    percent: d.overallPercent,
    grade: apiGradeToUiGrade(d.grade), // vestigial (grid never renders it) — see the note above
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
