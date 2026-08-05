// Unit gate for the v2 calendar month PIPE (goo · G-0a + G-1 pure). Plain tsx + node:assert (matches
// ci.yml `for f in scripts/*.test.ts`). Covers the three pure pieces that the real hook-wiring will
// consume (adapter · client-fetch · selection rule) — no React, no browser.
//
// ANCHOR: scripts/calendar-month-pipe.test.ts#g0-month-pipe-adapter
// Bug-classes this owns:
//  1. SCORELESS-DAY FABRICATION — the BFF returns overallPercent:null when bazi can't compute a day. The
//     grid renders percent as a number; mapping null→0 would paint a real "0%" on an unknown day. The
//     adapter must DROP such days (→ empty grid slot), never invent a score.
//  2. GRADE DROPPED (G-0c) — the BFF day carries a 13-level bazi grade, but the grid never renders grade
//     (dayCellTier(percent) does the colour) and the feature CalendarDay no longer HAS a grade field. The
//     adapter must simply drop it — no projection, no field. (The grade a user sees is DayDetail.grade.)
//  3. SELECTION never empty — a month must always resolve a selected day (today-in-view → today, else
//     day 1). The old silent "day 14" (month.days[13]) fallback is gone.
import assert from 'node:assert'
import { apiDayToFeatureDay, assembleFeatureMonth } from '../features/v2-calendar/hooks/month-adapter'
import { defaultSelectedDate, isSelectableDate } from '../features/v2-calendar/hooks/selection'
import { fetchCalendarMonth, toMonthParam } from '../features/v2-calendar/hooks/fetch-month'
import type { CalendarDay as ApiCalendarDay } from '../lib/v2-calendar/month'
import type { FeCalcInput } from '../lib/bazi-bridge/input'

let pass = 0
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

const apiDay = (over: Partial<ApiCalendarDay> = {}): ApiCalendarDay => ({
  date: '2026-08-05',
  dayOfMonth: 5,
  dayGanzhi: '甲子',
  overallPercent: 73,
  grade: 'B+',
  wanPhra: false,
  ...over,
})

// ── adapter: field map (no grade on the cell) ──
ok('apiDayToFeatureDay maps every field', (() => {
  const c = apiDayToFeatureDay(apiDay({ wanPhra: true }))
  return !!c && c.date === '2026-08-05' && c.day === 5 && c.ganzhi === '甲子'
    && c.percent === 73 && c.isBuddhistDay === true
})())
// grade is DROPPED — the feature cell has no such field (compile-enforced) and the raw bazi grade is ignored.
ok('adapter does not put grade on the cell', !('grade' in (apiDayToFeatureDay(apiDay({ grade: 'A+' })) as object)))

// ── adapter: scoreless day (bug-class 1) — null percent DROPS, never fabricates 0 ──
ok('null overallPercent → null (not a 0% cell)', apiDayToFeatureDay(apiDay({ overallPercent: null })) === null)
// a null grade with a real percent is STILL a valid scored cell now (grade is gone; only percent gates it)
ok('null grade + real percent → kept (grade no longer gates the cell)', apiDayToFeatureDay(apiDay({ grade: null, overallPercent: 50 }))?.percent === 50)

// ── adapter: month assembly drops scoreless days, keeps scored ──
const assembled = assembleFeatureMonth(2026, 8, [
  apiDay({ date: '2026-08-01', dayOfMonth: 1, overallPercent: 60 }),
  apiDay({ date: '2026-08-02', dayOfMonth: 2, overallPercent: null }), // scoreless → dropped
  apiDay({ date: '2026-08-05', dayOfMonth: 5, overallPercent: 73 }),
])
ok('assemble drops scoreless day (2 kept of 3)', assembled.days.length === 2)
ok('assemble keeps year/month', assembled.year === 2026 && assembled.month === 8)
ok('assemble weeks are length-7 rows', assembled.weeks.length > 0 && assembled.weeks.every((w) => w.length === 7))
ok('assemble places a scored day in the grid', assembled.weeks.flat().some((c) => c.date === '2026-08-05' && !c.isPadding))
// MUTANT sense: had null→0 been fabricated, days.length would be 3 and the 2nd would render "0%".
ok('scoreless day is NOT in the flat real-day list', !assembled.days.some((d) => d.date === '2026-08-02'))

// ── selection rule (bug-class 3) ──
ok('defaultSelectedDate → today when today is in view', defaultSelectedDate(assembled, '2026-08-05') === '2026-08-05')
ok('defaultSelectedDate → day 1 when today NOT in view', defaultSelectedDate(assembled, '2026-09-01') === '2026-08-01')
ok('defaultSelectedDate → day 1 when today is null (pre-mount fence)', defaultSelectedDate(assembled, null) === '2026-08-01')
ok('isSelectableDate true for a real day', isSelectableDate(assembled, '2026-08-05'))
ok('isSelectableDate false for a non-day (padding/other month)', !isSelectableDate(assembled, '2026-08-31'))

// ── client-fetch: param + total mapping (never throws) ──
ok('toMonthParam zero-pads', toMonthParam(2026, 8) === '2026-08' && toMonthParam(2026, 12) === '2026-12')

const person = { name: 'ทดสอบ', dob: '1990-01-01', gender: 'male' } as unknown as FeCalcInput
const realFetch = globalThis.fetch

async function run() {
  // success path — body is well-formed, response parsed
  let capturedBody: Record<string, unknown> = {}
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    capturedBody = JSON.parse(init.body)
    return { ok: true, json: async () => ({ allowed: true, year: 2026, month: 8, days: [apiDay()] }) }
  }) as unknown as typeof fetch
  const okRes = await fetchCalendarMonth(person, 'user-1', 2026, 8)
  ok('fetch success parses days', okRes.allowed === true && okRes.days.length === 1 && okRes.days[0].date === '2026-08-05')
  ok('fetch sends person+userId+month in body', capturedBody.userId === 'user-1' && capturedBody.month === '2026-08' && !!capturedBody.person)

  // !ok response → graceful degraded, empty (never throws)
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
  const badRes = await fetchCalendarMonth(person, 'user-1', 2026, 8)
  ok('fetch !ok → degraded empty, no throw', badRes.degraded === true && badRes.days.length === 0)

  // network throw → graceful degraded (never rejects to caller)
  globalThis.fetch = (async () => { throw new Error('network') }) as unknown as typeof fetch
  const throwRes = await fetchCalendarMonth(person, 'user-1', 2026, 8)
  ok('fetch throw → degraded empty, no throw', throwRes.degraded === true && throwRes.days.length === 0)

  globalThis.fetch = realFetch
  console.log(`✅ calendar-month-pipe.test.ts — ${pass} assertions passed`)
}

run().catch((e) => {
  globalThis.fetch = realFetch
  console.error(e)
  process.exit(1)
})
