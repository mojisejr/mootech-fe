// #358 Phase 3 — how far each level may scroll, enforced at the SERVER on both calendar routes.
//
// ANCHOR: scripts/calendar-span-gate.test.tsx#the-span-is-enforced-at-both-routes
// Bug-class this owns: a paid span that only the UI honours. The ticket says it in as many words — prove
// it with curl at the route, not by checking the screen hid an arrow. #226 closed this exact shape once
// already for the paid FIELDS: everything shipped and the screen did the hiding.
//
// 🔴 BOTH ROUTES IN ONE FILE ON PURPOSE. Blocking only the month grid leaves pages/api/v2/day-detail.ts
// answering for any date the blocked person asks for, one day at a time. A month gate whose neighbour is
// open is not a gate, and a test that only drove the month route would call it one.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`; fired for real, results in the PR):
//   MS1  PLUS and PRO get the same span in lib/v2/entitlement.ts  → ③ and ④ redden (the levels stop differing)
//   MS2  isMonthReachable uses `<= span` instead of `<= span - 1` → ② reddens (FREE reaches next month)
//   MS3  the span check is deleted from calendar-month.ts          → ② and ③ redden
//   MS4  the span check is deleted from day-detail.ts              → ⑤ reddens — the walk-around case
//   MS5  entitlementTierOf maps a paid-but-unnamed verdict to FREE → ⑥ reddens (a legacy member loses it)
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  who: { ok: true, userId: 'U' } as { ok: true; userId: string } | { ok: false; status: 401; error: string },
  verdict: { isPaid: true, tier: 'PRO', source: 'v2', expireAt: null } as { isPaid: boolean | null; tier: string | null; source: string; expireAt: string | null },
}))

vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.who) }))
vi.mock('@/lib/v2/subscription', () => ({ resolveSubscription: vi.fn(async () => h.verdict) }))
// "now" is pinned so the span has a fixed origin. lib/v2/clock is the smallest surface that does it —
// freezing the global clock would leak across vitest's shared worker pool (mootech-fe#523).
vi.mock('@/lib/v2/clock', () => ({ currentMonthBkk: () => '2026-08' }))
// lib/v2-calendar/gate is NOT mocked: this exercises the switch that actually ships, the same choice
// scripts/calendar-month-gate-closed.test.tsx makes and for the same reason.
vi.mock('@/lib/v2-calendar/month', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchFortuneDays: vi.fn(async (_r: unknown, month: string) => [
      { date: `${month}-05`, dayOfMonth: 5, dayGanzhi: '甲子', overallPercent: 70, grade: 'B+' },
    ]),
    fetchAlmanacDays: vi.fn(async () => []),
  }
})
vi.mock('@/lib/v2-calendar/day-detail', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual, // pickFreeDayDetail stays REAL
    mapDayDetail: vi.fn(() => ({
      date: '2026-08-05', dayGanzhi: '甲子', overallPercent: 71, grade: 'B+', verdict: 'ดี', summary: 'ส',
      suitable: [], avoid: [], insight: 'PAID', compatAreas: [], advice: [], yams: [],
      dithi: { officer: 'o', officerDesc: 'PAID', jianchu: 'PAID' }, luckyDirection: 'N', dayDeity: 'เทพ',
      spirits: [], wanPhra: { isWanPhra: false, label: '' },
      dayPillars: { day: null, month: null, year: null }, ownerPillars: {}, gates: [], colors: [],
    })),
  }
})
global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch

import monthHandler from '@/pages/api/v2/calendar-month'
import dayHandler from '@/pages/api/v2/day-detail'

const PERSON = { dob: '1990-01-01', time: '08:00', gender: 'male', isRememberTime: true }
const AS = {
  free: { isPaid: false, tier: null, source: 'none', expireAt: null },
  plus: { isPaid: true, tier: 'PLUS', source: 'v2', expireAt: null },
  pro: { isPaid: true, tier: 'PRO', source: 'v2', expireAt: null },
  /** paid through member_payment with no level we can prove — the legacy member #358 Phase 1 named. */
  paidUnnamed: { isPaid: true, tier: null, source: 'legacy', expireAt: null },
} as const

let seat = 0
function makeRes() {
  const res: { statusCode: number; body: any; status: any; json: any } = {
    statusCode: 0, body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
  }
  return res
}

/** the MONTH route's answer. A fresh user per call so the per-(user, month) server cache never answers. */
async function monthAllowed(month: string) {
  h.who = { ok: true, userId: `U-${seat++}` }
  const res = makeRes()
  await monthHandler({ method: 'POST', body: { person: PERSON, month } } as never, res as never)
  return res.body?.allowed === true
}

/** the DAY route's answer for a date. `false` = refused for being out of span, not merely trimmed. */
async function dayInSpan(date: string) {
  h.who = { ok: true, userId: `U-${seat++}` }
  const res = makeRes()
  await dayHandler({ method: 'POST', body: { person: PERSON, date } } as never, res as never)
  return res.body?.outOfSpan !== true
}

describe('#358 Phase 3 — the calendar span is enforced at the server, on BOTH routes', () => {
  beforeEach(() => { h.verdict = { ...AS.pro }; vi.clearAllMocks() })

  // ① ฟีมเคาะ 2026-08-29 ทาง A — the route now honours what the shop card sells. This case was written
  // as a FAILING target while the cost question was open; it is the target reached.
  it('🔴 ① FREE gets the current month, because that is what the shop card sells', async () => {
    h.verdict = { ...AS.free }
    expect(await monthAllowed('2026-08')).toBe(true)
  })

  it('🔴 ② FREE is refused the NEXT month and the PREVIOUS one, at the route', async () => {
    h.verdict = { ...AS.free }
    expect(await monthAllowed('2026-09'), 'next month').toBe(false)
    expect(await monthAllowed('2026-07'), 'last month').toBe(false)
  })

  it('🔴 ③ PLUS reaches month 12 and is refused month 13, in both directions', async () => {
    h.verdict = { ...AS.plus }
    expect(await monthAllowed('2027-07'), 'the 12th month forward').toBe(true)
    expect(await monthAllowed('2027-08'), 'the 13th month forward').toBe(false)
    expect(await monthAllowed('2025-09'), 'the 12th month back').toBe(true)
    expect(await monthAllowed('2025-08'), 'the 13th month back').toBe(false)
  })

  it('④ PRO has no wall — five years either way', async () => {
    h.verdict = { ...AS.pro }
    expect(await monthAllowed('2031-08')).toBe(true)
    expect(await monthAllowed('2021-08')).toBe(true)
  })

  it('🔴 ⑤ the DAY route cannot be used to walk around the month wall', async () => {
    h.verdict = { ...AS.free }
    // the same person, the same out-of-span month, asked one day at a time instead of as a grid
    expect(await monthAllowed('2026-09'), 'the grid is refused').toBe(false)
    expect(await dayInSpan('2026-09-14'), 'so a single day inside it must be too').toBe(false)
    // CONTROL — a day inside the span still answers, so ⑤ is not "the day route refuses everything"
    expect(await dayInSpan('2026-08-14'), 'a day in the current month still answers').toBe(true)
  })

  it('🔴 ⑥ a paid member with no level we can prove keeps the calendar — never downgraded to FREE', async () => {
    h.verdict = { ...AS.paidUnnamed }
    expect(await monthAllowed('2027-07'), 'a legacy member is not walled at the current month').toBe(true)
  })

  it('⑦ CONTROL — the levels really do differ, in the same run', async () => {
    const month = '2027-08' // month 13 for PLUS, ordinary for PRO
    h.verdict = { ...AS.plus }
    const plus = await monthAllowed(month)
    h.verdict = { ...AS.pro }
    const pro = await monthAllowed(month)
    expect(plus, 'PLUS is walled at month 13').toBe(false)
    expect(pro, 'PRO is not').toBe(true)
    // Without this pair, ② and ③ would both pass on a build that refuses everyone. It compares the two
    // PAID levels because FREE is currently walled by the membership gate, not by the span — see ①.
  })
})
