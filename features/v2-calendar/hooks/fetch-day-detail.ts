// MuMate v2 — ปฏิทินดวง · client fetch for one day's detail (G-2 foundation).
// Browser → same-origin BFF (/api/v2/day-detail) → bazi man-vs-day(day) + almanac (the BFF proxies; birth
// data never leaves to a 3rd origin). Returns the trimmed lib DayDetail (mapDayDetail). Pure I/O: given
// person+date it resolves a typed response or a graceful degraded one; it NEVER throws to the caller
// (the hook maps this to a settled "no detail" state). Grade-independent — returns the pipe's DayDetail
// as-is; the lib→feature adapter (with the 13-level grade decision, M-C) wires it into useDayDetail later.
import type { FeCalcInput } from '@/lib/bazi-bridge/input'
import type { DayDetail as LibDayDetail } from '@/lib/v2-calendar/day-detail'

/** Shape the BFF returns (pages/api/v2/day-detail). `detail` null on a bad/degraded response.
 *  #226: for a FREE caller the paid fields are ABSENT from `detail` — the type stays LibDayDetail because
 *  every consumer already reads it field-by-field behind a `paid &&` guard; what changed is that the free
 *  browser no longer HAS them to read. */
export interface DayDetailResponse {
  detail: LibDayDetail | null
  /** the day was served from the per-(user,birth,date) cache (re-open a day = instant). */
  cached?: boolean
  /** upstream unreachable/timeout → detail null but the request itself was ok. */
  degraded?: boolean
  /** 🔴 #358 Phase 3 — the day is OUTSIDE what this level's package sells (pages/api/v2/day-detail.ts).
   *  It arrives as `detail: null` exactly like the two states above, and it is a completely different
   *  thing: those are "we broke", this is "you did not buy this month". ตู๋ B4 found it dropped right
   *  here — the route emitted the field and the rebuild below discarded it, so the only thing separating
   *  a paid wall from a crash never reached the client. ฟีม decided the arrow should INVITE AN UPGRADE,
   *  and nothing that cannot be told apart from breakage can invite anything.
   *  ⚠️ It stops at THIS layer today: useDayDetail caches `detail` alone, so the screen still cannot see
   *  it. That half is mojisejr/mootech-fe#529 and is NOT claimed as done here. */
  outOfSpan?: boolean
}

/**
 * POST one day's detail. Resolves a well-formed response even on network/parse/non-2xx failure (detail
 * null, degraded) so the caller has a single, total mapping and never a rejected promise to babysit.
 */
// 🔴 #226 — no identity travels on this call. The BFF derives the caller from their signed session and
// decides the TIER there, so the response a free user gets is already trimmed (paid sections absent, not
// hidden). A `userId` here would be a value that looks authoritative and is ignored — the #252 shape.
export async function fetchDayDetail(
  person: FeCalcInput,
  date: string,
  signal?: AbortSignal,
): Promise<DayDetailResponse> {
  const fallback: DayDetailResponse = { detail: null, degraded: true }
  try {
    const r = await fetch('/api/v2/day-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, date }),
      ...(signal ? { signal } : {}),
    })
    if (!r.ok) return fallback
    const data = (await r.json()) as Partial<DayDetailResponse>
    return {
      detail: (data.detail as LibDayDetail | undefined) ?? null,
      ...(data.cached ? { cached: true } : {}),
      ...(data.degraded ? { degraded: true } : {}),
      ...(data.outOfSpan ? { outOfSpan: true } : {}),
    }
  } catch {
    return fallback // network error / aborted / bad JSON → graceful, never throws
  }
}
