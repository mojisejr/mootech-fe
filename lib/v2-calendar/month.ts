// v2 ปฏิทินดวง — shared month logic for the two BFF routes (pages/api/v2/{calendar-month,almanac-month}).
// ONE source for วันพระ (ฟีม's answer C = bazi-computed): both the paid personalised calendar and the
// free calendar overlay วันพระ from the SAME almanac fetch+cache+category rule here — no second source,
// no drift. Personalised fortune (man-vs-day) is paid-only and lives in the calendar-month route.
//
// LATENCY (curl'd live 2026-08-03, bazi-sft-dataset.vercel.app): man-vs-day month 6.8s cold/3.7s warm/
// 2.2MB (we strip to 5 fields/day → ~2KB to browser); almanac month 3.5s/141KB (deterministic per month
// → cached in-process). Callers run the two upstreams in PARALLEL and cache per (user,month).
export const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
if (/bazichart\.mumate\.co/i.test(BAZI_BASE)) {
  throw new Error(`[GUARDRAIL] BAZI_BASE_URL points at old prod (${BAZI_BASE}).`)
}
export const BAZI_TIMEOUT_MS = 12000

// วันพระ = the two RELIGIOUS special-day categories only. bazi almanac specialDays ALSO carries
// government holidays ("mother-day" · category government) and secular festivals ("ghost" สารทจีน ·
// festival-chinese) — those must NOT flag as วันพระ. A Set so the test can mutant-check
// "any special day ⇒ วันพระ" and see it FAIL on the government/festival fixtures.
const WAN_PHRA_CATEGORIES = new Set(['thai-buddhist', 'chinese-religious']) // #calendar-month-wanphra-category

export type CalendarDay = {
  date: string // ISO "YYYY-MM-DD"
  dayOfMonth: number // 1–31
  dayGanzhi: string // 干支 of the day pillar (personalised route only; '' on the free almanac route)
  overallPercent: number | null // 0–100 personalised; UI derives colour via dayCellTier(percent)
  grade: string | null // bazi's letter grade for overallPercent (ApiGrade | null); pass-through, never re-derived
  wanPhra: boolean // วันพระ (bazi almanac, religious categories only)
}

export type AlmanacDay = { date?: unknown; specialDays?: unknown }
export type MvdDay = { date?: unknown; dayOfMonth?: unknown; dayGanzhi?: unknown; overallPercent?: unknown; grade?: unknown }

/** "YYYY-MM" → {year, month, yearBE(=+543)}; rejects bad shape / month out of range. */
export function parseMonth(input: unknown): { year: number; month: number; yearBE: number } | null {
  if (typeof input !== 'string') return null
  const m = /^(\d{4})-(\d{1,2})$/.exec(input.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { year, month, yearBE: year + 543 }
}

/** true iff a day's almanac specialDays contains a RELIGIOUS (วันพระ) entry — not gov/festival. */
export function isWanPhraDay(specialDays: unknown): boolean {
  if (!Array.isArray(specialDays)) return false
  return specialDays.some(
    (s) => s && typeof (s as { category?: unknown }).category === 'string'
      && WAN_PHRA_CATEGORIES.has((s as { category: string }).category),
  )
}

/** date → isWanPhra map from an almanac days[] (the single วันพระ source). */
export function wanPhraByDate(almanacDays: unknown): Map<string, boolean> {
  const map = new Map<string, boolean>()
  if (Array.isArray(almanacDays)) {
    for (const a of almanacDays as AlmanacDay[]) {
      if (a && typeof a.date === 'string') map.set(a.date, isWanPhraDay(a.specialDays))
    }
  }
  return map
}

/** Free calendar overlay: almanac days[] → [{date, dayOfMonth, wanPhra}] (no personalised fields). */
export function almanacWanPhraDays(almanacDays: unknown): Array<Pick<CalendarDay, 'date' | 'dayOfMonth' | 'wanPhra'>> {
  if (!Array.isArray(almanacDays)) return []
  return (almanacDays as AlmanacDay[])
    .filter((a) => a && typeof a.date === 'string')
    .map((a) => {
      const date = a.date as string
      return { date, dayOfMonth: Number(date.slice(8, 10)), wanPhra: isWanPhraDay(a.specialDays) }
    })
}

/**
 * Paid calendar: join personalised fortune days with วันพระ BY DATE (never by index — the two arrays can
 * differ in length/order). Strips every heavy field bazi echoes to the 5 the grid needs. percent clamped
 * to [0,100]; NaN/absent → null (an empty cell, UI decides).
 */
export function mergeCalendarMonth(mvdDays: unknown, almanacDays: unknown): CalendarDay[] {
  const wanPhra = wanPhraByDate(almanacDays)
  if (!Array.isArray(mvdDays)) return []
  return (mvdDays as MvdDay[])
    .filter((d) => d && typeof d.date === 'string')
    .map((d) => {
      const date = d.date as string
      const pct = typeof d.overallPercent === 'number' && !Number.isNaN(d.overallPercent) ? d.overallPercent : null
      return {
        date,
        dayOfMonth: typeof d.dayOfMonth === 'number' ? d.dayOfMonth : Number(date.slice(8, 10)),
        dayGanzhi: typeof d.dayGanzhi === 'string' ? d.dayGanzhi : '',
        overallPercent: pct == null ? null : Math.max(0, Math.min(100, pct)),
        // grade = bazi's letter (PR-1 #18: man-vs-day now returns it per day). Pass-through — bazi is the
        // single source of the rating-scale; the BFF never re-derives it. null = คิดไม่ได้ (not "-").
        grade: typeof d.grade === 'string' ? d.grade : null,
        wanPhra: wanPhra.get(date) ?? false,
      }
    })
}

// ── almanac cache: deterministic per (yearBE, month) → skip the 3.5s recompute for every viewer of the
// same month (free AND paid share this). Bounded so a long-lived lambda can't grow unbounded. ──
const almanacCache = new Map<string, AlmanacDay[]>()
const ALMANAC_CACHE_MAX = 48

export function _clearAlmanacCache(): void {
  almanacCache.clear() // test hook only
}

export async function fetchAlmanacDays(yearBE: number, month: number, signal?: AbortSignal): Promise<AlmanacDay[]> {
  const key = `${yearBE}-${month}`
  const cached = almanacCache.get(key)
  if (cached) return cached
  const r = await fetch(`${BAZI_BASE}/api/almanac?yearBE=${yearBE}&month=${month}`, signal ? { signal } : {})
  if (!r.ok) throw new Error(`almanac ${r.status}`)
  const data = (await r.json()) as { days?: unknown }
  const days = Array.isArray(data.days) ? (data.days as AlmanacDay[]) : []
  if (almanacCache.size >= ALMANAC_CACHE_MAX) almanacCache.clear()
  almanacCache.set(key, days)
  return days
}

export async function fetchFortuneDays(rawInput: unknown, month: string, signal?: AbortSignal): Promise<MvdDay[]> {
  const r = await fetch(`${BAZI_BASE}/api/bazi/man-vs-day`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person: rawInput, month }),
    ...(signal ? { signal } : {}),
  })
  if (!r.ok) throw new Error(`man-vs-day ${r.status}`)
  const data = (await r.json()) as { days?: unknown }
  return Array.isArray(data.days) ? (data.days as MvdDay[]) : []
}

// ── paid fortune cache: deterministic in (birth data + month) → paging months back and forth never
// re-pays the 6.8s. The key includes a BIRTH SIGNATURE, not userId+month alone: the fortune is a function
// of the birth input, so if a user ever edits their dob the key MUST change or the calendar would show
// stale days ("แก้วันเกิดแล้วปฏิทินไม่เปลี่ยน" — μุน's catch; the fix belongs in THIS key, not a UI refresh).
// Keyed on rawInput (exactly what is sent to bazi = the true determinant) so it is correct-by-construction.
const fortuneCache = new Map<string, CalendarDay[]>()
const FORTUNE_CACHE_MAX = 256

/** cache key = userId + a stable signature of the birth input + month (all determinants of the fortune). */
export function fortuneCacheKey(userId: string, rawInput: unknown, month: string): string {
  return `${userId}:${JSON.stringify(rawInput)}:${month}`
}

export function fortuneCacheGet(key: string): CalendarDay[] | undefined {
  return fortuneCache.get(key)
}

export function fortuneCacheSet(key: string, days: CalendarDay[]): void {
  if (fortuneCache.size >= FORTUNE_CACHE_MAX) fortuneCache.clear()
  fortuneCache.set(key, days)
}

export function _clearFortuneCache(): void {
  fortuneCache.clear() // test hook only
}
