// mojisejr/mootech-fe#530 + #529 — ONE behaviour, two routes: a refusal has to arrive at the screen
// SAYING WHY, or the screen cannot tell a paid wall from a crash.
//
// ฟีมเคาะ 2026-08-24: pressing past your span should INVITE AN UPGRADE. Everything here exists because a
// state indistinguishable from breakage cannot invite anything — and the person it reads as breakage to is
// the FREE user we are trying to sell to.
//
// Why one file for two tickets: they are the same behaviour split across two routes, and #530's body says
// doing them separately is how the two calendar gates drifted apart before #358 Phase 2. Splitting the
// SPEC the same way would rebuild that seam in the test layer.
//
// 🔴 EVERY case here is paired with a control that proves the signal is not just "always say upgrade".
// That pairing is the DoD line both tickets share, in the wording they both used.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// ── route harness (#530) — same shape as scripts/calendar-month-identity.test.tsx ────────────────────
const h = vi.hoisted(() => ({
  who: { ok: true, userId: 'FREE-USER' } as
    | { ok: true; userId: string }
    | { ok: false; status: 401 | 404 | 409; error: string },
  tier: 'FREE' as 'FREE' | 'PLUS' | 'PRO',
  fortuneCalls: [] as string[],
}))
vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.who) }))
vi.mock('@/lib/v2/clock', () => ({ currentMonthBkk: () => '2028-01' }))
vi.mock('@/lib/v2-calendar/gate', () => ({ CALENDAR_MONTH_GATE_OPEN: false }))
vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: vi.fn(async () => ({
    isPaid: h.tier !== 'FREE',
    tier: h.tier,
    source: 'v2',
    expireAt: null,
  })),
}))
vi.mock('@/lib/v2-calendar/month', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchFortuneDays: vi.fn(async (raw: unknown, month: string) => {
      h.fortuneCalls.push(month)
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
async function call(month: string) {
  const res = makeRes()
  await handler({ method: 'POST', body: { person: PERSON, month } } as never, res as never)
  return res
}

describe('#530 — the month route says WHICH refusal it is', () => {
  beforeEach(() => {
    h.who = { ok: true, userId: 'FREE-USER' }
    h.tier = 'FREE'
    h.fortuneCalls = []
  })

  // The two refusals used to be byte-identical objects. "Different" is the whole assertion, so it is
  // asserted directly rather than inferred from two separate shape checks.
  it('🔴 the two refusals are DISTINGUISHABLE — no-identity vs out-of-span', async () => {
    h.who = { ok: false, status: 401, error: 'not signed in' }
    const noIdentity = await call('2028-01') // the CURRENT month, so span is not what refuses here
    expect(noIdentity.body).toEqual({ allowed: false, reason: 'no-identity', year: 2028, month: 1, days: [] })

    h.who = { ok: true, userId: 'FREE-USER' }
    const outOfSpan = await call('2028-06') // FREE reaches only the current month
    expect(outOfSpan.body).toEqual({ allowed: false, reason: 'out-of-span', year: 2028, month: 6, days: [] })

    // the point, stated as an assertion so it cannot pass by both being the same string
    expect(noIdentity.body.reason).not.toBe(outOfSpan.body.reason)
    // and neither refusal pays for an upstream fortune call
    expect(h.fortuneCalls).toHaveLength(0)
  })

  // 🔴 CONTROL — without this, `reason: 'out-of-span'` above could be a constant the route always emits.
  it('🔴 CONTROL — a month the tier CAN reach is allowed and carries no reason at all', async () => {
    const res = await call('2028-01')
    expect(res.body.allowed).toBe(true)
    expect(res.body.reason).toBeUndefined()
    expect(h.fortuneCalls).toHaveLength(1)
  })

  // 🔴 CONTROL — and the refusal must follow the TIER, not the month string. Same month, PLUS instead of
  // FREE, must stop being refused; otherwise 'out-of-span' would just mean "a month far from today".
  it('🔴 CONTROL — the same month is served for PLUS, so the reason tracks the package', async () => {
    h.tier = 'PLUS' // 12 months of span → 2028-06 is inside it
    const res = await call('2028-06')
    expect(res.body.allowed).toBe(true)
    expect(res.body.reason).toBeUndefined()
  })
})

// ── the wire (#530) — a field the route emits and the client drops is exactly how #529 happened ───────
import { fetchCalendarMonth } from '@/features/v2-calendar/hooks/fetch-month'

describe('#530 — the reason survives the client rebuild', () => {
  const okJson = (body: unknown) =>
    vi.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch

  it('carries out-of-span through to the caller', async () => {
    vi.stubGlobal('fetch', okJson({ allowed: false, reason: 'out-of-span', year: 2028, month: 6, days: [] }))
    expect(await fetchCalendarMonth(PERSON as never, 2028, 6)).toMatchObject({ allowed: false, reason: 'out-of-span' })
  })

  it('carries no-identity through to the caller', async () => {
    vi.stubGlobal('fetch', okJson({ allowed: false, reason: 'no-identity', year: 2028, month: 1, days: [] }))
    expect(await fetchCalendarMonth(PERSON as never, 2028, 1)).toMatchObject({ allowed: false, reason: 'no-identity' })
  })

  // 🔴 TEETH — an unknown reason must NOT reach the screen. A screen switching on this field would fall
  // through to its neutral branch, and inventing an upsell for a value we do not recognise is the failure
  // this whole pair of tickets is about, pointed the other way.
  it('🔴 an UNRECOGNISED reason is dropped, not passed through', async () => {
    vi.stubGlobal('fetch', okJson({ allowed: false, reason: 'because-i-said-so', year: 2028, month: 6, days: [] }))
    const r = await fetchCalendarMonth(PERSON as never, 2028, 6)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBeUndefined()
  })

  // 🔴 CONTROL — a reason must never ride alongside an ALLOWED month; that would be a contradiction the
  // screen has to arbitrate.
  it('🔴 CONTROL — an allowed month never carries a reason, even if the server sends one', async () => {
    vi.stubGlobal('fetch', okJson({ allowed: true, reason: 'out-of-span', year: 2028, month: 1, days: [] }))
    const r = await fetchCalendarMonth(PERSON as never, 2028, 1)
    expect(r.allowed).toBe(true)
    expect(r.reason).toBeUndefined()
  })
})

// ── the day hook (#529) — THE THREE STATES ────────────────────────────────────────────────────────────
import { useDayDetail } from '@/features/v2-calendar/hooks/useDayDetail'
import { clearDayDetailCache } from '@/features/v2-calendar/hooks/day-detail-cache'
import * as fetchDay from '@/features/v2-calendar/hooks/fetch-day-detail'

const USER = {
  user_id: 'U1',
  dob: '1990-01-01',
  time: '08:00',
  gender: 'male',
  is_remember_time: true,
  payment: { is_not_expired: false },
}
vi.mock('@/features/auth/hooks/useV2User', () => ({
  useV2User: () => ({ userId: 'U1', user: USER, done: true, errored: false }),
}))

describe('#529 — useDayDetail resolves THREE states, not two', () => {
  beforeEach(() => {
    clearDayDetailCache()
    vi.restoreAllMocks()
  })

  it('🔴 out-of-span reaches the hook — the state ฟีม wants to sell into', async () => {
    vi.spyOn(fetchDay, 'fetchDayDetail').mockResolvedValue({ detail: null, outOfSpan: true })
    const { result } = renderHook(() => useDayDetail('2028-06-15'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.outOfSpan).toBe(true)
    expect(result.current.detail).toBeNull()
  })

  // 🔴 THE CONTROL BOTH TICKETS ASK FOR BY NAME: a genuine failure must still read as a failure. Same
  // `detail: null`, same settled state — and it must NOT become an upsell.
  it('🔴 CONTROL — a genuine failure is NOT out-of-span (same detail:null, opposite meaning)', async () => {
    vi.spyOn(fetchDay, 'fetchDayDetail').mockResolvedValue({ detail: null, degraded: true })
    const { result } = renderHook(() => useDayDetail('2028-06-16'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.detail).toBeNull()
    expect(result.current.outOfSpan).toBe(false)
  })

  // 🔴 THE TOOTH μุน ASKED FOR BY NAME, and the one neither of her instruments can grow: her page tests
  // mock useDayDetail wholesale, so the cache cannot affect them, and her Eye Truth frames open a fresh
  // context each time, so no cache hit ever occurs. Without this assertion her PR and mine go green
  // together while the screen is broken.
  //
  // The sentence under test is hers verbatim: OPEN A WALLED DAY A SECOND TIME AND outOfSpan IS STILL TRUE.
  // Deliberately NOT "and it did not re-fetch" — after ตู๋ B1 a walled day is never stored
  // (day-detail-cache.ts isCacheableDay), so a second fetch is the mechanism, not a regression.
  it('🔴 opening a WALLED day a SECOND time still reads out-of-span (μุน B1 / ตู๋ B1)', async () => {
    const spy = vi.spyOn(fetchDay, 'fetchDayDetail').mockResolvedValue({ detail: null, outOfSpan: true })
    const first = renderHook(() => useDayDetail('2028-07-01'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(first.result.current.outOfSpan).toBe(true)

    const callsAfterFirst = spy.mock.calls.length
    const second = renderHook(() => useDayDetail('2028-07-01'))
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(second.result.current.outOfSpan).toBe(true) // ← the assertion that matters
    // and it asked the server again, which is WHY it cannot go stale: a walled day is never remembered,
    // so a PLUS member who upgrades to PRO gets a fresh answer instead of the wall they saw before.
    expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  // 🔴 ตู๋ B1, the scenario itself: PLUS hits the wall, buys PRO, returns by soft navigation. Before this
  // the shared key (…:paid) held outOfSpan:true for both levels and re-sold them what they had just bought.
  it('🔴 a walled day STOPS being walled once the server changes its mind (the PLUS→PRO upgrade)', async () => {
    const spy = vi
      .spyOn(fetchDay, 'fetchDayDetail')
      .mockResolvedValueOnce({ detail: null, outOfSpan: true }) // as PLUS
      .mockResolvedValue({ detail: null, degraded: true }) // as PRO the wall is gone
    const asPlus = renderHook(() => useDayDetail('2028-12-01'))
    await waitFor(() => expect(asPlus.result.current.loading).toBe(false))
    expect(asPlus.result.current.outOfSpan).toBe(true)

    const asPro = renderHook(() => useDayDetail('2028-12-01')) // same key — dayKey ends in a boolean
    await waitFor(() => expect(asPro.result.current.loading).toBe(false))
    expect(asPro.result.current.outOfSpan).toBe(false)
    expect(spy.mock.calls.length).toBeGreaterThan(1)
  })

  // 🔴 ตู๋'s find on μุน's clean head — the OTHER door to this pair of tickets' own defect. Tapping from a
  // walled day to a reachable one showed the upgrade card ON THE REACHABLE DAY in 1 of 3 renders after the
  // tap, because `date` is a prop and the answer was prop-less state. Asserted at the render immediately
  // after the change, with NO waitFor, because waiting for the effect is precisely what hides it.
  //
  // ⚠️ EVERY RENDER IS RECORDED, not just the settled one. My first version of this test read
  // `result.current` right after `rerender` and passed WITH THE FIX REMOVED — @testing-library wraps
  // `rerender` in `act()`, which flushes the effect before control comes back, so the intermediate render
  // is over by the time you can look at it. The bug lives in exactly that render. Recording each call of
  // the hook is what makes it observable; asserting on `result.current` cannot see it at all.
  it('🔴 changing the date never shows the PREVIOUS day\'s wall on the new day (ตู๋)', async () => {
    vi.spyOn(fetchDay, 'fetchDayDetail').mockImplementation(async (_p: never, d: string) =>
      d === '2029-01-01' ? { detail: null, outOfSpan: true } : { detail: null, degraded: true },
    )
    const seen: Array<{ date: string; outOfSpan: boolean }> = []
    const { result, rerender } = renderHook(
      ({ d }) => {
        const r = useDayDetail(d)
        seen.push({ date: d, outOfSpan: r.outOfSpan })
        return r
      },
      { initialProps: { d: '2029-01-01' } },
    )
    await waitFor(() => expect(result.current.outOfSpan).toBe(true)) // the walled day, settled

    seen.length = 0
    rerender({ d: '2029-01-02' }) // the reachable day
    await waitFor(() => expect(result.current.loading).toBe(false))

    // THE ASSERTION: no render — not one, not the first — ever paired the new date with the old wall.
    const stale = seen.filter((f) => f.date === '2029-01-02' && f.outOfSpan)
    expect(stale).toEqual([])
    expect(seen.length).toBeGreaterThan(0) // the recorder actually ran, so [] means clean, not empty
    expect(result.current.outOfSpan).toBe(false)
  })

  // 🔴 CONTROL — the stamp must not make the hook answer `loading` forever. A day that settles must still
  // settle, otherwise "never show a stale wall" is satisfied by never showing anything at all.
  it('🔴 CONTROL — the date stamp still lets a day settle (not a permanent loading)', async () => {
    vi.spyOn(fetchDay, 'fetchDayDetail').mockResolvedValue({ detail: null, outOfSpan: true })
    const { result, rerender } = renderHook(({ d }) => useDayDetail(d), { initialProps: { d: '2029-03-01' } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ d: '2029-03-02' })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.outOfSpan).toBe(true) // the NEW day's own answer, not the old one's
  })

  // 🔴 CONTROL for both of the above — "never cache anything" would satisfy them and quietly delete the
  // whole point of this cache. A NORMAL day must still be served from memory without a second request.
  it('🔴 CONTROL — a normal day IS still cached: the second view does not re-fetch', async () => {
    // the full lib shape — the adapter reads it field by field, and a partial stub makes the promise
    // reject, which leaves the hook stuck on loading and the failure looks like a cache miss instead
    const detail = {
      date: '2028-08-08', dayGanzhi: '甲子', overallPercent: 70, grade: 'B', summary: 'ok',
      suitable: [], avoid: [], yams: [], compatAreas: [], advice: [], insight: '', dayDeity: '',
      spirits: [], wanPhra: { isWanPhra: false, label: '' }, colors: [], gates: [],
      dithi: { officer: '', officerDesc: '', jianchu: '' }, luckyDirection: '',
    }
    const spy = vi.spyOn(fetchDay, 'fetchDayDetail').mockResolvedValue({ detail: detail as never })
    const first = renderHook(() => useDayDetail('2028-08-08'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    const callsAfterFirst = spy.mock.calls.length
    const second = renderHook(() => useDayDetail('2028-08-08'))
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(second.result.current.detail).not.toBeNull()
    expect(spy.mock.calls.length).toBe(callsAfterFirst) // a real cache hit
  })

  // 🔴 CONTROL for the cache path — a cached FAILURE must not come back as a wall either.
  it('🔴 CONTROL — a cached failure re-reads as a failure, never as an upsell', async () => {
    vi.spyOn(fetchDay, 'fetchDayDetail').mockResolvedValue({ detail: null, degraded: true })
    const first = renderHook(() => useDayDetail('2028-07-02'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    const second = renderHook(() => useDayDetail('2028-07-02'))
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(second.result.current.outOfSpan).toBe(false)
  })
})
