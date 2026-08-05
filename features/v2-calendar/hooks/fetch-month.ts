// MuMate v2 — ปฏิทินดวง · client fetch for the personalised month grid.
// Browser → same-origin BFF (/api/v2/calendar-month) → bazi man-vs-day + almanac (the BFF proxies; birth
// data never leaves to a 3rd origin). One call returns the WHOLE month at once — there is no per-day
// "loading" state, only "no month yet" vs "month here" (บอง 2026-08-05). Pure I/O: given person+userId+
// month it resolves a typed response or a graceful degraded/empty one; it NEVER throws to the caller (the
// hook maps this to { month:null, loading:false }).
import type { FeCalcInput } from '@/lib/bazi-bridge/input'
import type { CalendarDay as ApiCalendarDay } from '@/lib/v2-calendar/month'

/** Shape the BFF returns (pages/api/v2/calendar-month). `allowed:false` = gated/no-userId; days empty. */
export interface CalendarMonthResponse {
  allowed: boolean
  year: number
  month: number
  days: ApiCalendarDay[]
  /** true when the upstream fortune was unreachable/timeout → days is empty but the request itself was ok. */
  degraded?: boolean
}

/** `YYYY-MM` for the BFF from a 1-12 month. */
export function toMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * POST the personalised month. Resolves a well-formed response even on network/parse failure (degraded,
 * empty days) so the caller has a single, total mapping and never a rejected promise to babysit.
 */
export async function fetchCalendarMonth(
  person: FeCalcInput,
  userId: string,
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<CalendarMonthResponse> {
  const fallback: CalendarMonthResponse = { allowed: true, year, month, days: [], degraded: true }
  try {
    const r = await fetch('/api/v2/calendar-month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, userId, month: toMonthParam(year, month) }),
      ...(signal ? { signal } : {}),
    })
    if (!r.ok) return fallback
    const data = (await r.json()) as Partial<CalendarMonthResponse>
    return {
      allowed: data.allowed ?? false,
      year: typeof data.year === 'number' ? data.year : year,
      month: typeof data.month === 'number' ? data.month : month,
      days: Array.isArray(data.days) ? (data.days as ApiCalendarDay[]) : [],
      ...(data.degraded ? { degraded: true } : {}),
    }
  } catch {
    return fallback // network error / aborted / bad JSON → graceful, never throws
  }
}
