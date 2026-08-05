// MuMate v2 — ปฏิทินดวง · pure month-grid builder (DB-free, deterministic, hydration-safe).
// Deterministic: given (year, month) the weekday layout is fixed, so SSR and client produce the SAME
// grid — no hydration mismatch. Uses `new Date(y, m, d)` with FIXED args only (never `new Date()` now).
import type { CalendarDay } from './types'

/** `YYYY-MM-DD` for a Y/M/D (month is 1-12). Zero-padded, calendar-local (no timezone shift). */
export function toISODate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** Days in a month (month 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Weekday of the 1st (0=Sun..6=Sat) — fixed args → deterministic across server/client. */
export function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

/**
 * Lay `days` (the real, non-padding cells for month/year) into weeks of 7 (Sun..Sat), padding the
 * leading/trailing gaps with isPadding cells so every week is length 7. `days` need not be complete —
 * missing dates get a minimal padding-like placeholder (percent 0), but normally you pass a full month.
 */
export function buildMonthGrid(year: number, month: number, days: CalendarDay[]): CalendarDay[][] {
  const byDay = new Map(days.map((d) => [d.day, d]))
  const total = daysInMonth(year, month)
  const lead = firstWeekday(year, month)

  const cells: CalendarDay[] = []
  // leading padding
  for (let i = 0; i < lead; i++) {
    cells.push(paddingCell(year, month, -(lead - i)))
  }
  // real days
  for (let d = 1; d <= total; d++) {
    cells.push(byDay.get(d) ?? paddingCell(year, month, d)) // a real day is expected; fall back gracefully
  }
  // trailing padding to fill the last week
  while (cells.length % 7 !== 0) {
    cells.push(paddingCell(year, month, total + (cells.length % 7)))
  }

  const weeks: CalendarDay[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function paddingCell(year: number, month: number, dayOffset: number): CalendarDay {
  // A padding cell renders empty; date/day kept only so keys are stable. Never counted in summaries.
  return {
    date: toISODate(year, month, Math.max(1, dayOffset)),
    day: dayOffset,
    ganzhi: '',
    percent: 0,
    grade: '', // padding cell — never rendered (isPadding); empty placeholder to satisfy the non-null type
    isPadding: true,
  }
}
