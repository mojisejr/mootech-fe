// MuMate v2 — ปฏิทินดวง · useCalendarMonth (goo · CLIENT-TRUTH state + layer-2 mock data).
// Month cursor (prev/next/today) + the grid. The cursor is pure client state; the grid is mock now,
// API-fed later (swap mockCalendarMonth → adapter, this hook's signature does NOT change).
import { useMemo, useState } from 'react'
import { useHasMounted } from '@/lib/hooks/use-has-mounted'
import type { CalendarMonth } from '../types'
import { mockCalendarMonth, MOCK_YEAR, MOCK_MONTH } from '../fixtures'
import { bangkokTodayISO, bangkokToday } from '../today'

export interface UseCalendarMonth {
  /** The month currently in view (grid + summary source). */
  month: CalendarMonth
  /** Cursor position. */
  year: number
  monthIndex: number // 1-12
  /**
   * Today's ISO date (Asia/Bangkok) — `null` on the server render AND the first client paint
   * (hydration-fenced), then the real date after mount. Bind the "today" ring to this so the server
   * HTML and first client render agree (no ring), avoiding a midnight-straddle hydration mismatch.
   */
  todayISO: string | null
  goPrev: () => void
  goNext: () => void
  /** Jump the cursor to Bangkok-today's month. No-op until mounted (today is unknown before then). */
  goToday: () => void
}

export function useCalendarMonth(): UseCalendarMonth {
  const hasMounted = useHasMounted()
  // Default cursor = the reference mock month (a CONSTANT — same on server and client → hydration-safe).
  // Deliberately NOT "today's month": that would be clock-derived in the first paint = mismatch risk.
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: MOCK_YEAR,
    month: MOCK_MONTH,
  })

  const month = useMemo(() => mockCalendarMonth(cursor.year, cursor.month), [cursor.year, cursor.month])

  // Only expose today AFTER mount — the fence. Before mount both server and client see null.
  const todayISO = hasMounted ? bangkokTodayISO() : null

  const goPrev = () =>
    setCursor((c) => (c.month === 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: c.month - 1 }))
  const goNext = () =>
    setCursor((c) => (c.month === 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: c.month + 1 }))
  const goToday = () => {
    if (!hasMounted) return // today unknown before mount — never guess it on the server
    const t = bangkokToday()
    setCursor({ year: t.year, month: t.month })
  }

  return { month, year: cursor.year, monthIndex: cursor.month, todayISO, goPrev, goNext, goToday }
}
