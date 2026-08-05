// MuMate v2 — ปฏิทินดวง · client fetch for one day's detail (G-2 foundation).
// Browser → same-origin BFF (/api/v2/day-detail) → bazi man-vs-day(day) + almanac (the BFF proxies; birth
// data never leaves to a 3rd origin). Returns the trimmed lib DayDetail (mapDayDetail). Pure I/O: given
// person+userId+date it resolves a typed response or a graceful degraded one; it NEVER throws to the caller
// (the hook maps this to a settled "no detail" state). Grade-independent — returns the pipe's DayDetail
// as-is; the lib→feature adapter (with the 13-level grade decision, M-C) wires it into useDayDetail later.
import type { FeCalcInput } from '@/lib/bazi-bridge/input'
import type { DayDetail as LibDayDetail } from '@/lib/v2-calendar/day-detail'

/** Shape the BFF returns (pages/api/v2/day-detail). `detail` null on a bad/degraded response. */
export interface DayDetailResponse {
  detail: LibDayDetail | null
  /** the day was served from the per-(user,birth,date) cache (re-open a day = instant). */
  cached?: boolean
  /** upstream unreachable/timeout → detail null but the request itself was ok. */
  degraded?: boolean
}

/**
 * POST one day's detail. Resolves a well-formed response even on network/parse/non-2xx failure (detail
 * null, degraded) so the caller has a single, total mapping and never a rejected promise to babysit.
 */
export async function fetchDayDetail(
  person: FeCalcInput,
  userId: string,
  date: string,
  signal?: AbortSignal,
): Promise<DayDetailResponse> {
  const fallback: DayDetailResponse = { detail: null, degraded: true }
  try {
    const r = await fetch('/api/v2/day-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, userId, date }),
      ...(signal ? { signal } : {}),
    })
    if (!r.ok) return fallback
    const data = (await r.json()) as Partial<DayDetailResponse>
    return {
      detail: (data.detail as LibDayDetail | undefined) ?? null,
      ...(data.cached ? { cached: true } : {}),
      ...(data.degraded ? { degraded: true } : {}),
    }
  } catch {
    return fallback // network error / aborted / bad JSON → graceful, never throws
  }
}
