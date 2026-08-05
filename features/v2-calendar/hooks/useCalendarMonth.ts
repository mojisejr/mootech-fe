// MuMate v2 — ปฏิทินดวง · useCalendarMonth (goo · CLIENT-TRUTH state + layer-2 data).
// Month cursor (prev/next/today) + the grid + the selected day.
//
// 🔒 SEAM (locked by บอง 2026-08-05 — do NOT change this shape without asking; μุน's screen binds to it):
//   month: CalendarMonth | null   — the whole month arrives as ONE API blob, so the only real states are
//                                    "no month yet" (null) and "full month". There is NO per-day unknown.
//   loading: boolean              — true while the month is not yet available.
//   selectedDate: string | null   — the day the card follows (null before the rule resolves it post-mount).
//   selectDay(date)               — user picks a day (grid cell → button, μุน's M-A).
//   year · monthIndex · todayISO · goPrev · goNext · goToday — unchanged.
//
// CURSOR = null until mount, then Bangkok-TODAY's month (บอง's catch 2026-08-05). Resolving the current
// month CLIENT-SIDE post-mount — the SAME fence as todayISO — is why `month` is nullable: server + first
// client paint both see `null` (no clock-straddle hydration mismatch), then the effect sets today's month.
// This also matches G-0c's reality: a PERSONALISED month is fetched client-side (needs auth) and can never
// be SSR'd, so "null on first paint" is the truth either way. Done-condition (open → CURRENT month, today
// highlighted, card = today) is therefore met already at this mock stage — mockCalendarMonth generates any
// month deterministically. G-0c swaps mockCalendarMonth → the API adapter and deletes CalendarDay.grade.
import { useEffect, useMemo, useState } from 'react'
import { useHasMounted } from '@/lib/hooks/use-has-mounted'
import type { CalendarMonth } from '../types'
import { mockCalendarMonth, MOCK_YEAR, MOCK_MONTH } from '../fixtures'
import { bangkokTodayISO, bangkokToday } from '../today'
import { defaultSelectedDate, isSelectableDate } from './selection'

type Cursor = { year: number; month: number }

export interface UseCalendarMonth {
  /** The month currently in view (grid + summary source) — `null` until the month resolves (post-mount). */
  month: CalendarMonth | null
  /** true while the month is not yet available (before the cursor resolves; a real fetch later). */
  loading: boolean
  /** Cursor position (falls back to the reference constant before the cursor resolves — unused then). */
  year: number
  monthIndex: number // 1-12
  /**
   * Today's ISO date (Asia/Bangkok) — `null` on the server render AND the first client paint
   * (hydration-fenced), then the real date after mount. Bind the "today" ring to this so the server
   * HTML and first client render agree (no ring), avoiding a midnight-straddle hydration mismatch.
   */
  todayISO: string | null
  /**
   * The day the bottom card follows. `null` before the rule resolves it (server + first paint, fenced).
   * On entering a month: today if today is in view, else day 1 — the old silent "day 14" is gone.
   */
  selectedDate: string | null
  /** Select a real (non-padding) day of the current month; ignores anything else. */
  selectDay: (date: string) => void
  goPrev: () => void
  goNext: () => void
  /** Jump the cursor to Bangkok-today's month. No-op until mounted (today is unknown before then). */
  goToday: () => void
}

export function useCalendarMonth(): UseCalendarMonth {
  const hasMounted = useHasMounted()

  // Cursor starts NULL (hydration fence) — resolved to Bangkok-today's month in a post-mount effect.
  const [cursor, setCursor] = useState<Cursor | null>(null)
  useEffect(() => {
    const t = bangkokToday()
    setCursor((c) => c ?? { year: t.year, month: t.month }) // set once; nav changes are preserved
  }, [])

  // G-0b: still the mock (but for the RESOLVED month, incl. the current one). G-0c: the adapter's fetched
  // month, which CAN be null / loading true while the fetch is in flight.
  const month: CalendarMonth | null = useMemo(
    () => (cursor ? mockCalendarMonth(cursor.year, cursor.month) : null),
    [cursor],
  )
  const loading = cursor === null

  // Only expose today AFTER mount — the fence. Before mount both server and client see null.
  const todayISO = hasMounted ? bangkokTodayISO() : null

  // Selected day. Re-applies the default rule whenever the MONTH changes (cursor move / first resolve) or
  // today resolves (mount). A manual selectDay within a month persists — it changes neither `month` nor
  // `todayISO`, so this effect does not re-fire and overwrite it. `null` until the month exists.
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  useEffect(() => {
    setSelectedDate(month ? defaultSelectedDate(month, todayISO) : null)
  }, [month, todayISO])

  const selectDay = (date: string) => {
    if (month && isSelectableDate(month, date)) setSelectedDate(date)
  }

  const goPrev = () =>
    setCursor((c) => (c ? (c.month === 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: c.month - 1 }) : c))
  const goNext = () =>
    setCursor((c) => (c ? (c.month === 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: c.month + 1 }) : c))
  const goToday = () => {
    if (!hasMounted) return // today unknown before mount — never guess it on the server
    const t = bangkokToday()
    setCursor({ year: t.year, month: t.month })
  }

  return {
    month,
    loading,
    year: cursor?.year ?? MOCK_YEAR,
    monthIndex: cursor?.month ?? MOCK_MONTH,
    todayISO,
    selectedDate,
    selectDay,
    goPrev,
    goNext,
    goToday,
  }
}
