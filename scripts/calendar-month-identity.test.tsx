// #391 — the paid-month gate must judge the SESSION's membership, not a membership the sender nominates.
//
// ANCHOR: scripts/calendar-month-identity.test.tsx#calendar-month-gate-subject-is-the-session
// Bug-class this owns: a gate whose SUBJECT comes from the request. calendar-month took `userId` from the
// body and fed it to resolveMembership, so "is this person allowed" was answered about whoever the caller
// named. It never fired only because CALENDAR_MONTH_GATE_OPEN is true and the whole branch is skipped —
// safe by a switch, not by design, with mootech-fe#293 scheduled to throw that switch.
//
// 🔴 THE POINT OF THIS FILE: almost every case below runs with the gate CLOSED — the world AFTER #293.
// That branch previously had no test at all (the flag was a const inside the handler, unreachable from a
// test), so "flipping it is safe" was a promise. Now it is a fixture.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MG1  the route reads userId from the body again          → ① reddens (a free session + a paid id = paid month)
//   MG2  the identity refusal is dropped (a failed resolve becomes some anonymous id) → ⑤ reddens
//        ⚠️ ③ does NOT redden for MG2, and that is why ⑤ exists: with the gate closed the membership
//        check refuses the anonymous id anyway, so ③ was proving the GATE works, not the identity check.
//        Found by running the mutant, not by reading the code (it survived the first version of this file).
//   MG3  the fortune cache key stops following the session    → ④ reddens (two accounts share one month)
//   MG4  the membership refusal is removed while the gate is closed → ① reddens
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  gateOpen: false, // most cases run in the post-#293 world
  who: { ok: true, userId: 'SESSION-FREE' } as
    | { ok: true; userId: string }
    | { ok: false; status: 401 | 404 | 409; error: string },
  // membership by user id — the PAID member is the account an attacker would want to borrow
  paidUsers: new Set<string>(['PAID-MEMBER-1']),
  fortuneCalls: [] as string[],
}))

vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.who) }))
vi.mock('@/lib/v2-calendar/gate', () => ({
  get CALENDAR_MONTH_GATE_OPEN() {
    return h.gateOpen
  },
}))
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
// Only the two network calls are stubbed; parseMonth / mergeCalendarMonth / the cache stay REAL, because
// the cache-key behaviour is one of the things under test.
vi.mock('@/lib/v2-calendar/month', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchFortuneDays: vi.fn(async (rawInput: unknown, month: string) => {
      h.fortuneCalls.push(`${JSON.stringify(rawInput)}|${month}`)
      // grade must be one of the 13 API grades — parseApiGrade THROWS on anything else (by design), and
      // the route's catch would turn that into a degraded empty month, quietly making every assertion
      // below pass for the wrong reason.
      return [{ date: `${month}-05`, dayOfMonth: 5, dayGanzhi: '甲子', overallPercent: 70, grade: 'B+' }]
    }),
    fetchAlmanacDays: vi.fn(async () => []),
  }
})

import handler from '@/pages/api/v2/calendar-month'

const PERSON = { dob: '1990-01-01', time: '08:00', gender: 'male', isRememberTime: true }

function makeRes() {
  const res: { statusCode: number; body: any; status: any; json: any } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
  }
  return res
}
async function call(body: unknown, method = 'POST') {
  const res = makeRes()
  await handler({ method, body } as never, res as never)
  return res
}

describe('#391 /api/v2/calendar-month — the gate judges the session, with the gate CLOSED', () => {
  beforeEach(() => {
    h.gateOpen = false
    h.who = { ok: true, userId: 'SESSION-FREE' }
    h.paidUsers = new Set(['PAID-MEMBER-1'])
    h.fortuneCalls = []
    // a fresh month each run so the module-level fortune cache never hands one case another's result
    vi.clearAllMocks()
  })

  // ① 🔴 THE TICKET, IN ONE CASE. A free account naming a paying member in the body.
  it('🔴 ① a free session cannot borrow a paying member\'s access by naming them in the body', async () => {
    const res = await call({ person: PERSON, month: '2027-01', userId: 'PAID-MEMBER-1' })
    expect(res.statusCode).toBe(200)
    expect(res.body.allowed).toBe(false)
    expect(res.body.days).toEqual([])
    expect(h.fortuneCalls).toHaveLength(0) // and the paid upstream was never even asked
  })

  // ② CONTROL — the same request from the paying member's own session DOES work. Without this, ① could
  // pass for the boring reason that nothing works at all (a probe that cannot flip proves nothing).
  it('② control: the paying member\'s OWN session gets the month (the probe can flip)', async () => {
    h.who = { ok: true, userId: 'PAID-MEMBER-1' }
    const res = await call({ person: PERSON, month: '2027-02' })
    expect(res.body.allowed).toBe(true)
    expect(res.body.days.length).toBeGreaterThan(0)
  })

  // ③ MG2 — no session at all. Same shape the screen already handles, and nothing upstream is touched.
  it('🔴 ③ no session → allowed:false in the SHAPE the screen already knows, and no upstream call', async () => {
    h.who = { ok: false, status: 401, error: 'not signed in' }
    const res = await call({ person: PERSON, month: '2027-03', userId: 'PAID-MEMBER-1' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ allowed: false, year: 2027, month: 3, days: [] })
    expect(h.fortuneCalls).toHaveLength(0)
  })

  it('③b an ambiguous (409) or not-yet-registered (404) identity is also refused, never served', async () => {
    for (const refusal of [
      { ok: false as const, status: 409 as const, error: 'identity is ambiguous' },
      { ok: false as const, status: 404 as const, error: 'no account for this login yet' },
    ]) {
      h.who = refusal
      const res = await call({ person: PERSON, month: '2027-04' })
      expect(res.body.allowed).toBe(false)
      expect(h.fortuneCalls).toHaveLength(0)
    }
  })

  // The body's claim is inert in every shape — there is no encoding of it that steers the gate.
  it('① b every shape of body.userId is inert (string / empty / number / array / object)', async () => {
    for (const forged of ['PAID-MEMBER-1', '', 12345, ['PAID-MEMBER-1'], { toString: () => 'PAID-MEMBER-1' }]) {
      const res = await call({ person: PERSON, month: '2027-05', userId: forged })
      expect(res.body.allowed).toBe(false)
    }
    expect(h.fortuneCalls).toHaveLength(0)
  })
})

describe('#391 the server fortune cache follows the session, not the request', () => {
  beforeEach(() => {
    h.gateOpen = true // cache behaviour is visible in the open-gate world too
    h.paidUsers = new Set(['PAID-MEMBER-1'])
    h.fortuneCalls = []
    vi.clearAllMocks()
  })

  // ④ MG3 — two different accounts asking for the same month with the same birth data must NOT share a
  // cache entry. If the key ever goes back to a request-supplied id, one sender can seed and read another
  // account's slot at will.
  it('🔴 ④ two sessions with identical bodies do not share a cached month', async () => {
    h.who = { ok: true, userId: 'SESSION-A' }
    await call({ person: PERSON, month: '2027-06' })
    expect(h.fortuneCalls).toHaveLength(1)

    h.who = { ok: true, userId: 'SESSION-A' } // same account again → served from cache, no new upstream call
    await call({ person: PERSON, month: '2027-06' })
    expect(h.fortuneCalls).toHaveLength(1)

    h.who = { ok: true, userId: 'SESSION-B' } // different account, identical request body
    const res = await call({ person: PERSON, month: '2027-06' })
    expect(res.body.allowed).toBe(true)
    expect(h.fortuneCalls).toHaveLength(2) // ← recomputed for B; B never read A's slot
  })

  // Today's behaviour must not move: with the gate OPEN a free session still gets its month.
  it('gate OPEN (today) → a free session still gets the personalised month', async () => {
    h.who = { ok: true, userId: 'SESSION-FREE' }
    const res = await call({ person: PERSON, month: '2027-07' })
    expect(res.body.allowed).toBe(true)
  })

  // ⑤ 🔴 ADDED BECAUSE A MUTANT SURVIVED. MG2 (treat a failed resolve as some anonymous user instead of
  // refusing) reddened NOTHING: with the gate CLOSED, case ③ was caught by the MEMBERSHIP check, not by
  // the identity refusal — the gate was doing the identity gate's job and hiding its absence.
  // Here the gate is OPEN, which is the world we are actually in TODAY, and the refusal is the only thing
  // standing between an unauthenticated caller and a personalised month computed upstream.
  it('🔴 ⑤ gate OPEN + no session → still refused, and the upstream is never called', async () => {
    h.who = { ok: false, status: 401, error: 'not signed in' }
    const res = await call({ person: PERSON, month: '2027-09', userId: 'PAID-MEMBER-1' })
    expect(res.body.allowed).toBe(false)
    expect(res.body.days).toEqual([])
    expect(h.fortuneCalls).toHaveLength(0)
  })

  it('the pre-existing input guards still answer first (bad month → 400, no person → 400)', async () => {
    h.who = { ok: true, userId: 'SESSION-FREE' }
    expect((await call({ person: PERSON, month: 'nope' })).statusCode).toBe(400)
    expect((await call({ month: '2027-08' })).statusCode).toBe(400)
    expect((await call({ person: PERSON, month: '2027-08' }, 'GET')).statusCode).toBe(405)
  })
})
