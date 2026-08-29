// MuMate v2 — ปฏิทินดวง · client fetch for the personalised month grid.
// Browser → same-origin BFF (/api/v2/calendar-month) → bazi man-vs-day + almanac (the BFF proxies; birth
// data never leaves to a 3rd origin). One call returns the WHOLE month at once — there is no per-day
// "loading" state, only "no month yet" vs "month here" (บอง 2026-08-05). Pure I/O: given person+month it
// resolves a typed response or a graceful degraded/empty one; it NEVER throws to the caller (the hook maps
// this to { month:null, loading:false }). No identity is passed: since #391 the BFF derives the caller
// from their signed session, so this call carries none.
import type { FeCalcInput } from '@/lib/bazi-bridge/input'
import type { CalendarDay as ApiCalendarDay } from '@/lib/v2-calendar/month'

/**
 * 🔴 #530 — WHY the month was refused. The route has exactly two `allowed:false` exits and they mean
 * opposite things to the person looking at the screen:
 *   'no-identity'  we do not know who you are        → sign in again
 *   'out-of-span'  this month is past what you bought → an invitation to upgrade (ฟีมเคาะ 2026-08-24)
 * Before this they answered a byte-identical object, so a paid wall and an expired session were the same
 * pixel. Optional because a response that predates the field, or one this client could not parse, has no
 * honest answer — and inventing one would put an upsell in front of somebody whose session just died.
 */
export type CalendarRefusalReason = 'no-identity' | 'out-of-span'

/** Shape the BFF returns (pages/api/v2/calendar-month). `allowed:false` = the membership gate refused, or
 *  there is no usable session (#391 — it is no longer "no userId in the body"); days empty either way.
 *  When it is false, `reason` says which — see CalendarRefusalReason. */
export interface CalendarMonthResponse {
  allowed: boolean
  year: number
  month: number
  days: ApiCalendarDay[]
  /** true when the upstream fortune was unreachable/timeout → days is empty but the request itself was ok. */
  degraded?: boolean
  /** #530 — present only alongside `allowed:false`, and only when the route named it. */
  reason?: CalendarRefusalReason
}

/** Accept ONLY the two strings the route emits. An unknown value becomes `undefined` rather than being
 *  passed through: a screen switching on this must fall to its neutral branch for anything it does not
 *  recognise, never render an upgrade prompt because the server said something new. */
function parseRefusalReason(raw: unknown): CalendarRefusalReason | undefined {
  return raw === 'no-identity' || raw === 'out-of-span' ? raw : undefined
}

/** `YYYY-MM` for the BFF from a 1-12 month. */
export function toMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * POST the personalised month. Resolves a well-formed response even on network/parse failure (degraded,
 * empty days) so the caller has a single, total mapping and never a rejected promise to babysit.
 */
// 🔴 #391 — the `userId` parameter is GONE, not just unused. The route derives the caller from their
// signed session now, so a user id on this call would be a value that travels, looks authoritative, and
// is ignored — the shape that got us mootech-fe#252. The caller still keeps its own userId for the
// CLIENT-side month cache key (that one never leaves the browser and partitions local storage), which is
// a different job with a different trust level.
export async function fetchCalendarMonth(
  person: FeCalcInput,
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<CalendarMonthResponse> {
  const fallback: CalendarMonthResponse = { allowed: true, year, month, days: [], degraded: true }
  try {
    const r = await fetch('/api/v2/calendar-month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, month: toMonthParam(year, month) }),
      ...(signal ? { signal } : {}),
    })
    if (!r.ok) return fallback
    const data = (await r.json()) as Partial<CalendarMonthResponse>
    const allowed = data.allowed ?? false
    const reason = parseRefusalReason(data.reason)
    return {
      allowed,
      year: typeof data.year === 'number' ? data.year : year,
      month: typeof data.month === 'number' ? data.month : month,
      days: Array.isArray(data.days) ? (data.days as ApiCalendarDay[]) : [],
      ...(data.degraded ? { degraded: true } : {}),
      // #530 — carried ONLY when the month was actually refused. A `reason` riding alongside allowed:true
      // would be a contradiction the screen would have to arbitrate, and ตู๋ B4 found the day route's flag
      // dying at exactly this kind of rebuild (#529): a field the route emits and the client drops.
      ...(!allowed && reason ? { reason } : {}),
    }
  } catch {
    return fallback // network error / aborted / bad JSON → graceful, never throws
  }
}
