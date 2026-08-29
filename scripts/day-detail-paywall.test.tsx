// #226 — the paid sections must never reach a free browser. Hiding is layout; this is access.
//
// ANCHOR: scripts/day-detail-paywall.test.tsx#day-detail-trims-paid-fields-server-side
// Bug-class this owns: an API that ships everything and lets the SCREEN hide it. Before this, the whole
// DayDetail was in the browser before `{paid && …}` was evaluated — Network tab, curl, a saved HAR, all of
// it readable without paying. The screen kept working exactly the same either way, which is precisely why
// nothing caught it.
//
// 🔴 THE ASSERTIONS ARE ABOUT WHAT THE RESPONSE *CONTAINS*, NOT ABOUT STATUS CODES. A 200 with the paid
// fields attached is the bug; a 200 without them is the fix. Absence is checked with `in`, not falsiness —
// `insight: ''` would pass a truthiness check and still be a leak of shape.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MP1  the trim is dropped for the fresh path      → ① reddens
//   MP2  the trim is dropped for the CACHED path     → ② reddens (the sneaky half: first viewer pays the
//                                                      upstream, everyone after reads the cache)
//   MP3  the allow-list becomes a deny-list          → ④ reddens (an unknown upstream field ships to free)
//   MP4  `isPaid` is read loosely (truthy / !== false) instead of `=== true` → ⑤ reddens
//   MP5  the identity is taken from the body again   → ⑥ reddens
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  who: { ok: true, userId: 'SESSION-FREE' } as
    | { ok: true; userId: string }
    | { ok: false; status: 401 | 404 | 409; error: string },
  // 🔴 membership is answered PER USER ID — not a constant. A mock that ignores its argument cannot tell
  // "whose tier was checked", and that is exactly what MP5 exploits: with the body's userId back in play
  // every assertion still passed, because the stub returned the same verdict no matter who was asked.
  // (Found by running MP5 and verifying the mutation actually landed — a mutant that fails to apply looks
  // identical to one that survives.)
  paidUsers: new Set<string>(),
  subOverride: null as { isPaid: boolean | null; tier: string | null; source: string } | null,
  subThrows: false,
  mvdCalls: 0,
  extraUpstreamField: false,
}))

vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.who) }))
// #358 Phase 3 — this suite is about the paid-field TRIM, not the span, and its dates are 2027-01-xx
// (chosen so the module-level cache never collides). Pinning "now" to that month keeps every case
// in span so the span gate never fires here and these assertions keep measuring what they name.
vi.mock('@/lib/v2/clock', () => ({ currentMonthBkk: () => '2027-01' }))
vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: vi.fn(async (userId: string) => {
    if (h.subThrows) throw new Error('membership store unreachable')
    if (h.subOverride) return h.subOverride
    return h.paidUsers.has(userId)
      ? { isPaid: true, tier: 'PRO', source: 'v2' }
      : { isPaid: false, tier: null, source: 'none' }
  }),
}))
// Stub only the two network calls + the mapper's raw input; parseDate / the cache / pickFreeDayDetail stay REAL.
vi.mock('@/lib/v2-calendar/month', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, fetchAlmanacDays: vi.fn(async () => []) }
})
vi.mock('@/lib/v2-calendar/day-detail', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    // A full DayDetail as the real mapper would produce it, plus (optionally) a field bazi might add later.
    mapDayDetail: vi.fn(() => ({
      date: '2027-01-05',
      dayGanzhi: '甲子',
      overallPercent: 71,
      grade: 'B+',
      verdict: 'ดี',
      summary: 'สรุปวัน',
      suitable: ['ก'],
      avoid: ['ข'],
      insight: 'PAID-insight',
      compatAreas: [{ key: 'love', label: 'ความรัก', percent: 80, grade: 'A', isStrength: true }],
      advice: ['PAID-advice'],
      yams: [{ id: 'y1', window: '06:00-07:36', label: 'ยาม' }],
      dithi: { officer: 'FREE-officer', officerDesc: 'PAID-officerDesc', jianchu: 'PAID-jianchu' },
      luckyDirection: 'FREE-direction', // free: the score-card chip (see the note above)
      dayDeity: 'เทพ',
      spirits: [{ name: 'PAID-spirit', keywords: [] }],
      wanPhra: { isWanPhra: false, label: '' },
      dayPillars: { day: null, month: null, year: null },
      ownerPillars: {},
      gates: [{ name: 'PAID-gate', direction: 'N', meaning: 'z' }],
      colors: [{ element: 'ไม้', colors: 'เขียว' }],
      ...(h.extraUpstreamField ? { futureFieldBaziAdded: 'PAID-future' } : {}),
    })),
  }
})

global.fetch = vi.fn(async () => {
  h.mvdCalls += 1
  return { ok: true, json: async () => ({}) } as unknown as Response
}) as unknown as typeof fetch

import handler from '@/pages/api/v2/day-detail'

// 🔴 Corrected after sweeping the COMPONENT TREE, not just the page: <DayScoreCard/> renders for every
// tier and reads `luckyDirection` + `dithi.officer` for its chips, so cutting them would have removed
// something a free user sees today. `dithi` therefore splits INSIDE itself — the only field that does.
const PAID_FIELDS = ['insight', 'compatAreas', 'advice', 'gates', 'spirits']
const PAID_DITHI_KEYS = ['officerDesc', 'jianchu']
const FREE_FIELDS = ['date', 'dayGanzhi', 'overallPercent', 'grade', 'summary', 'suitable', 'avoid', 'yams', 'dayDeity', 'wanPhra', 'colors', 'luckyDirection', 'dithi']
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
// each test uses its own date so the module-level server cache never leaks between cases
let n = 0
const freshDate = () => `2027-01-${String(++n + 9).padStart(2, '0')}`

describe('#226 /api/v2/day-detail — the paid sections are cut at the source', () => {
  beforeEach(() => {
    h.who = { ok: true, userId: 'SESSION-FREE' }
    h.paidUsers = new Set(['PAID-MEMBER-1'])
    h.subOverride = null
    h.subThrows = false
    h.extraUpstreamField = false
    h.mvdCalls = 0
    vi.clearAllMocks()
  })

  // ① 🔴 THE TICKET.
  it('🔴 ① a free caller gets NONE of the paid fields, and keeps every free one', async () => {
    const res = await call({ person: PERSON, date: freshDate() })
    expect(res.statusCode).toBe(200)
    const d = res.body.detail
    for (const f of PAID_FIELDS) expect(Object.keys(d)).not.toContain(f)
    for (const f of FREE_FIELDS) expect(Object.keys(d)).toContain(f)
    // the split field: the chip's half survives, the paid section's halves do not
    expect(d.dithi).toEqual({ officer: 'FREE-officer' })
    for (const k of PAID_DITHI_KEYS) expect(Object.keys(d.dithi)).not.toContain(k)
    // Every fixture value that must never reach a free caller is prefixed 'PAID-', so this one line is a
    // sweep over the WHOLE serialised reply — it catches a leak through a field this test does not name.
    expect(JSON.stringify(res.body)).not.toContain('PAID-')
  })

  it('① b a paid caller still gets everything (the fix must not cost a payer anything)', async () => {
    h.who = { ok: true, userId: 'PAID-MEMBER-1' }
    const res = await call({ person: PERSON, date: freshDate() })
    const d = res.body.detail
    for (const f of [...PAID_FIELDS, ...FREE_FIELDS]) expect(Object.keys(d)).toContain(f)
    for (const k of PAID_DITHI_KEYS) expect(Object.keys(d.dithi)).toContain(k) // the split field, whole
  })

  // ② 🔴 MP2 — the half that is easy to miss. The server cache is keyed per (user, birth, date), so the
  // interesting case is NOT two different people: it is ONE person whose tier changes between two views —
  // which is the ordinary lifecycle (they subscribe, or their plan lapses). The cached branch must trim on
  // the way out just like the fresh one; a trim that only runs on the fresh path leaks on every re-open.
  it('🔴 ② the CACHED path is trimmed too — a plan that lapses stops serving the paid sections', async () => {
    const date = freshDate()
    h.paidUsers = new Set(['SESSION-FREE']) // same session id, currently paid
    const first = await call({ person: PERSON, date }) // fills the cache with the FULL day
    expect(Object.keys(first.body.detail)).toContain('insight')
    expect(h.mvdCalls).toBe(1)

    h.paidUsers = new Set() // the plan lapses; same user, same day, now served from cache
    const second = await call({ person: PERSON, date })
    expect(second.body.cached).toBe(true) // proves we really went through the cached branch
    expect(h.mvdCalls).toBe(1) // and did not recompute
    for (const f of PAID_FIELDS) expect(Object.keys(second.body.detail)).not.toContain(f)
  })

  // ③ The direction that costs a PAYING user: they viewed the day while free, then paid. The cache holds
  // the FULL day (never the trimmed view), so the upgrade is visible immediately without a recompute.
  it('③ a day cached while free is served in full the moment the same user pays', async () => {
    const date = freshDate()
    await call({ person: PERSON, date }) // free first
    expect(h.mvdCalls).toBe(1)
    h.paidUsers = new Set(['SESSION-FREE']) // they subscribe
    const paidRes = await call({ person: PERSON, date })
    expect(paidRes.body.cached).toBe(true)
    expect(h.mvdCalls).toBe(1)
    for (const f of PAID_FIELDS) expect(Object.keys(paidRes.body.detail)).toContain(f)
  })

  // ④ 🔴 MP3 — the allow-list, stated as a test. A field nobody has written a rule about must not ship.
  it('🔴 ④ a field bazi adds LATER is not sent to free by default (allow-list, not deny-list)', async () => {
    h.extraUpstreamField = true
    const res = await call({ person: PERSON, date: freshDate() })
    expect(Object.keys(res.body.detail)).not.toContain('futureFieldBaziAdded')
    // …and a paid caller does receive it, so this proves the ALLOW-LIST and not just a dropped field
    h.who = { ok: true, userId: 'PAID-MEMBER-1' }
    const paidRes = await call({ person: PERSON, date: freshDate() })
    expect(Object.keys(paidRes.body.detail)).toContain('futureFieldBaziAdded')
  })

  // ⑤ 🔴 MP4 — `isPaid` is boolean | null. null = "could not determine" and must serve FREE, never paid.
  it('🔴 ⑤ an undetermined tier (isPaid null) serves the FREE view, and so does a membership error', async () => {
    h.subOverride = { isPaid: null, tier: null, source: 'v2' }
    const nullRes = await call({ person: PERSON, date: freshDate() })
    for (const f of PAID_FIELDS) expect(Object.keys(nullRes.body.detail)).not.toContain(f)

    h.subThrows = true
    const errRes = await call({ person: PERSON, date: freshDate() })
    expect(errRes.statusCode).toBe(200)
    for (const f of PAID_FIELDS) expect(Object.keys(errRes.body.detail)).not.toContain(f)
  })

  // ⑥ 🔴 MP5 — this route would have been the third #252. The body cannot nominate whose tier is used.
  it('🔴 ⑥ a userId in the body cannot buy the paid view', async () => {
    // The session is a FREE account; the body names a real PAYING one. The membership stub answers per id,
    // so if the route ever asks about the body's id again this goes red (MP5).
    const res = await call({ person: PERSON, date: freshDate(), userId: 'PAID-MEMBER-1' })
    for (const f of PAID_FIELDS) expect(Object.keys(res.body.detail)).not.toContain(f)
    for (const k of PAID_DITHI_KEYS) expect(Object.keys(res.body.detail.dithi)).not.toContain(k)
  })

  it('⑥ b no session → refused by the resolver, and the upstream is never called', async () => {
    h.who = { ok: false, status: 401, error: 'not signed in' }
    const res = await call({ person: PERSON, date: freshDate() })
    expect(res.statusCode).toBe(401)
    expect(h.mvdCalls).toBe(0)
  })

  it('the pre-existing input guards still answer first (bad date / no person / GET)', async () => {
    expect((await call({ person: PERSON, date: 'nope' })).statusCode).toBe(400)
    expect((await call({ date: freshDate() })).statusCode).toBe(400)
    expect((await call({ person: PERSON, date: freshDate() }, 'GET')).statusCode).toBe(405)
  })
})

// ── #226 · ตู๋ B1 — the client must not re-derive "paid", and the adapter must not hide the answer ────
//
// B1 in one sentence: the SCREEN decided what to render with `isPaidMember` (the v1 flag) while the SERVER
// decided what to SEND with resolveSubscription (the v2 seam). Two holders of one rule, and the cheapest
// way to make them disagree was the `catch { paid = false }` this very PR added — one DB hiccup and the
// screen would pass `undefined` into .map()/.find()/.length. There is no error boundary anywhere in the
// repo, so that is a blank page, and it lands on the person who PAID.
//
// The fix is in pages/v2/calendar/[date].tsx: every paid section now renders on the presence of ITS OWN
// data. That file has no unit test (its own comment says so), so what is pinned here is the invariant the
// page's guards depend on: **the adapter must pass a missing paid field through as missing.**
// The day someone writes `compatAreas: lib.compatAreas ?? []` to "be safe", every guard on the page turns
// true again, free users get empty paid sections, and the crash comes back the moment a field is read
// deeper. That default is the mutant this block exists to catch.
import { libDayDetailToFeature } from '@/features/v2-calendar/hooks/day-detail-adapter'

describe('#226 ตู๋ B1 — a trimmed day survives the adapter as TRIMMED, not as empty shells', () => {
  it('🔴 paid fields absent in → absent out (never [] / "" / a default)', () => {
    const free = {
      date: '2027-01-05',
      dayGanzhi: '甲子',
      overallPercent: 71,
      grade: 'B+',
      summary: 'สรุปวัน',
      suitable: ['ก'],
      avoid: ['ข'],
      yams: [{ id: 'y1', window: '06:00-07:36', label: 'ยาม' }],
      dayDeity: 'เทพ',
      wanPhra: { isWanPhra: false, label: '' },
      colors: [{ element: 'ไม้', colors: 'เขียว' }],
      luckyDirection: 'ทิศเหนือ',
      dithi: { officer: 'FREE-officer' },
    }
    const view = libDayDetailToFeature(free as never)
    for (const f of ['compatAreas', 'advice', 'insight', 'gates', 'spirits'] as const) {
      expect(view[f]).toBeUndefined()
    }
    // the split field keeps its free half and only its free half
    expect(view.dithi).toEqual({ officer: 'FREE-officer' })
    // and the free half of the screen is fully intact — the guards must not cost a free user anything
    expect(view.percent).toBe(71)
    expect(view.yams).toHaveLength(1)
    expect(view.luckyColors).toHaveLength(1)
    expect(view.luckyDirection).toBe('ทิศเหนือ')
  })

  it('a paid day still adapts whole (the guards must not drop what a payer bought)', () => {
    const paidLib = {
      date: '2027-01-05', dayGanzhi: '甲子', overallPercent: 71, grade: 'B+', summary: 's',
      suitable: [], avoid: [], yams: [], dayDeity: '', wanPhra: { isWanPhra: false, label: '' },
      colors: [], luckyDirection: 'ทิศเหนือ',
      dithi: { officer: 'o', officerDesc: 'd', jianchu: 'j' },
      compatAreas: [{ key: 'love', label: 'ความรัก', percent: 80, grade: 'A', isStrength: true }],
      advice: ['a'], insight: 'i', gates: [{ name: 'g', direction: 'N', meaning: 'm' }],
      spirits: [{ name: 'sp', keywords: [] }],
    }
    const view = libDayDetailToFeature(paidLib as never)
    expect(view.compatAreas).toHaveLength(1)
    expect(view.advice).toEqual(['a'])
    expect(view.insight).toBe('i')
    expect(view.gates).toHaveLength(1)
    expect(view.spirits).toHaveLength(1)
    expect(view.dithi).toEqual({ officer: 'o', officerDesc: 'd', jianchu: 'j' })
  })
})
