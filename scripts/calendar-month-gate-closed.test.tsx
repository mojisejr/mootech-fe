// #293 — the SHIPPED value of the gate, not a mocked one.
//
// ANCHOR: scripts/calendar-month-gate-closed.test.tsx#calendar-month-gate-is-closed-in-the-build-we-ship
// Bug-class this owns: a gate that is closed in the tests and open in the build. scripts/calendar-month-
// identity.test.tsx proves the CLOSED path is safe — but it proves it by mocking lib/v2-calendar/gate, so
// every one of its cases would keep passing if someone set the real constant back to `true`. That is the
// hole this file exists to cover: it imports NOTHING of the gate and never mocks it, so what it exercises
// is whatever value ships.
//
// 🔴 THE CRITERION IS `fortuneCalls === 0`, NOT an empty response — the standard ตู๋ used to prove #391.
// A route that computes the paid month and then returns `days: []` has still paid for it, still warmed
// every cache underneath, and is one refactor away from returning it. "Refused" means the upstream was
// never asked.
//
// 🔴 BOTH POLES, ALWAYS (the ticket says so in as many words): a gate that refuses everyone passes any
// single-sided test. The paying member must still get their month in the same run.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MC1  CALENDAR_MONTH_GATE_OPEN goes back to `true`  → ① reddens (a free session gets a month again)
//   MC2  the membership refusal inside the gate is removed → ① reddens
//   MC3  the paid path breaks                          → ② reddens (the gate must not refuse everyone)
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  who: { ok: true, userId: 'FREE-USER' } as { ok: true; userId: string } | { ok: false; status: 401; error: string },
  paidUsers: new Set<string>(['PAYING-MEMBER']),
  fortuneCalls: 0,
}))

vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.who) }))
// #358 Phase 3 — this suite is about the MEMBERSHIP gate, not the span, and freshMonth() walks 2028-xx.
// "now" is pinned to 2028-01 and every case is given PRO below, so the span is never what decides here.
vi.mock('@/lib/v2/clock', () => ({ currentMonthBkk: () => '2028-01' }))
// #358 Phase 2 — the route now asks resolveSubscription, so the stub moved with it. Left as a full module
// mock rather than a spread of the original: the original pulls @/lib/db, and a membership stub that can
// still reach a database is not a stub. `isPaid` (boolean | null) replaces `isFree` (boolean) because that
// is the field the gate now reads, and only a literal true unlocks.
vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: vi.fn(async (userId: string) => ({
    isPaid: h.paidUsers.has(userId),
    tier: h.paidUsers.has(userId) ? 'PRO' : null,
    source: h.paidUsers.has(userId) ? 'v2' : 'none',
    expireAt: null,
  })),
}))
// Only the upstream network calls are stubbed. lib/v2-calendar/gate is deliberately NOT mocked.
vi.mock('@/lib/v2-calendar/month', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchFortuneDays: vi.fn(async (_raw: unknown, month: string) => {
      h.fortuneCalls += 1
      return [{ date: `${month}-05`, dayOfMonth: 5, dayGanzhi: '甲子', overallPercent: 70, grade: 'B+' }]
    }),
    fetchAlmanacDays: vi.fn(async () => []),
  }
})

import handler from '@/pages/api/v2/calendar-month'

const PERSON = { dob: '1990-01-01', time: '08:00', gender: 'male', isRememberTime: true }
let n = 0
const freshMonth = () => `2028-${String((n++ % 12) + 1).padStart(2, '0')}`

async function call(userId: string, month?: string) {
  const res: { statusCode: number; body: any; status: any; json: any } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
  }
  h.who = { ok: true, userId }
  await handler({ method: 'POST', body: { person: PERSON, month: month ?? freshMonth() } } as never, res as never)
  return res
}

describe('#293 calendar-month — the gate we actually ship is CLOSED', () => {
  beforeEach(() => {
    h.paidUsers = new Set(['PAYING-MEMBER'])
    h.fortuneCalls = 0
    vi.clearAllMocks()
  })

  // ① 🔴 MC1/MC2 — the ticket, against the real constant.
  // 🔴 ① CHANGED BY #358 Phase 3 (ฟีมเคาะ 2026-08-29, ทาง A) — and the CRITERION is untouched.
  // This case used to read "a free member is refused" full stop, because the route was paid-only. The shop
  // card has always sold FREE one month of ปฏิทินดวง, so ฟีม decided the route should honour the card. A
  // free member is therefore no longer refused everywhere — they are refused BEYOND their span.
  // What this file owns is unchanged and is the reason it exists: a refusal must cost us NOTHING upstream.
  // `fortuneCalls === 0` is still the criterion, still measured, and still the thing MC2 would break.
  it('🔴 ① a free member is refused BEYOND their span, and the paid upstream is NEVER called (fortuneCalls === 0)', async () => {
    const res = await call('FREE-USER', '2028-06') // "now" is pinned to 2028-01, so this is out of span
    expect(res.statusCode).toBe(200)
    expect(res.body.allowed).toBe(false)
    expect(res.body.days).toEqual([])
    expect(h.fortuneCalls).toBe(0) // ← the criterion. An empty reply we PAID for is not a refusal.
  })

  // ① b — the other half of ทาง A, and the half that costs money. Written next to ① so nobody reads this
  // file as "free gets nothing" ever again.
  it('🔴 ① b a free member DOES get the current month, and we DO pay the upstream for it', async () => {
    const res = await call('FREE-USER', '2028-01') // the pinned current month
    expect(res.body.allowed).toBe(true)
    expect(h.fortuneCalls).toBe(1) // the ~6.8s first-view cost ฟีม accepted, asserted rather than implied
  })

  // ② 🔴 MC3 — the other pole, in the same run. Without it, a gate that refuses everybody looks perfect.
  it('🔴 ② a paying member still gets their month (a gate that refuses everyone is not a gate)', async () => {
    const res = await call('PAYING-MEMBER')
    expect(res.body.allowed).toBe(true)
    expect(res.body.days.length).toBeGreaterThan(0)
    expect(h.fortuneCalls).toBe(1)
  })

  // A member whose plan lapsed is refused on the very next request — the verdict is read per request, not
  // cached in the session, so "paid once" never means "paid forever".
  it('③ a lapsed member is refused immediately, with no upstream call', async () => {
    await call('PAYING-MEMBER')
    expect(h.fortuneCalls).toBe(1)
    h.paidUsers = new Set() // plan expires
    const after = await call('PAYING-MEMBER')
    expect(after.body.allowed).toBe(false)
    expect(h.fortuneCalls).toBe(1) // unchanged: nothing was computed for them
  })
})
