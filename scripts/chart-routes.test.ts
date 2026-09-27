// mumate-be-retirement-001 slice 1 — the two chart READ routes no longer reach mootech-be.
//
// 🔴 MUTANT CONTRACT:
//   CR1 GET /api/chinese-horoscope: identity from the session (query userId ignored), engine chart for
//       that member, {data:null} when no birth, 502 when the engine fails, 409 on session≠cookie
//   CR2 computeMemberChart: the engine profile's birth wins over the legacy user row (mergeEngineBirth),
//       unknown time → 12:00 for the engine, stored gender picks the element_cycle row
//   CR3 /api/calculator/compute (element finder): animal from the engine's year branch; the ONLY outbound
//       call is the engine; engine down → 502 (no BE fallback)
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => {
  process.env.BAZI_BASE_URL = 'http://engine.test'
  process.env.NEXT_PUBLIC_BACKEND_URL = 'http://be.test'
  process.env.CALC_NONCE_SECRET = 'test-secret'
  return {
    execute: vi.fn(),
    insertValues: vi.fn(async () => undefined),
    computeMemberChart: vi.fn(),
    resolveSessionUserId: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({
  db: { execute: h.execute, insert: () => ({ values: h.insertValues }) },
}))
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))
vi.mock('@/lib/v2/resolve-user', async () => {
  const actual = await vi.importActual<typeof import('@/lib/v2/resolve-user')>('@/lib/v2/resolve-user')
  return { ...actual, resolveSessionUserId: h.resolveSessionUserId }
})
vi.mock('@/lib/chart/engine-chart-server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/chart/engine-chart-server')>('@/lib/chart/engine-chart-server')
  return { ...actual, computeMemberChart: h.computeMemberChart, __actual: actual }
})

import chartHandler from '@/pages/api/chinese-horoscope'
import computeHandler, { toElementFinderData } from '@/pages/api/calculator/compute'
import * as serverMod from '@/lib/chart/engine-chart-server'
import { EngineChartError, buildChartPayload, deriveChartCore } from '@/lib/chart/engine-chart'
import { issueNonce } from '@/lib/calculator/nonce'
import { resolveMascotFromCompute } from '@/lib/personalization/mascot'

const actualServer = (serverMod as unknown as { __actual: typeof serverMod }).__actual

const ME = '11111111-1111-4111-8111-111111111111'
const SOMEONE = '22222222-2222-4222-8222-222222222222'

type Res = { statusCode: number; body: any; headers: Record<string, string>; status: (c: number) => Res; json: (b: unknown) => Res; setHeader: (k: string, v: string) => void }
function mockRes(): Res {
  const res = { statusCode: 0, body: undefined, headers: {} } as Res
  res.status = (c) => ((res.statusCode = c), res)
  res.json = (b) => ((res.body = b), res)
  res.setHeader = (k, v) => void (res.headers[k] = v)
  return res
}

// Real public-calc glyphs for 1990-05-15 08:30 (bazi-sft-dataset tests/bazi-public-calc-pillars.test.ts).
const ENGINE_ANSWER = {
  dayMaster: '庚',
  dayMasterElement: 'ทอง',
  strengthScore: 7.5,
  pillars: { day: { stem: '庚', branch: '辰', stemElement: 'ทอง', branchElement: 'ดิน' }, year: { stem: '庚', branch: '午', stemElement: 'ทอง', branchElement: 'ไฟ' } },
  daYun: [],
  liuNian: [],
  badges: [],
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  h.execute.mockReset()
  h.computeMemberChart.mockReset()
  h.resolveSessionUserId.mockReset()
  h.insertValues.mockClear()
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ENGINE_ANSWER }))
  vi.stubGlobal('fetch', fetchMock)
  actualServer._resetElementCycleCache()
})
afterEach(() => vi.unstubAllGlobals())

describe('CR1 — GET /api/chinese-horoscope', () => {
  const payload = buildChartPayload({ dob: '1990-05-15', time: '08:30', gender: 'MALE' }, deriveChartCore(ENGINE_ANSWER)!, null)
  const get = (cookies: Record<string, string> = { 'cookie-mumate-id': ME }, query: Record<string, string> = {}) =>
    ({ method: 'GET', cookies, query, headers: {} }) as never

  it('charts the SESSION member; the userId/code query is ignored', async () => {
    h.resolveSessionUserId.mockResolvedValue({ ok: true, userId: ME })
    h.computeMemberChart.mockResolvedValue({ ok: true, chart: payload })
    const res = mockRes()
    await chartHandler(get({ 'cookie-mumate-id': ME }, { userId: SOMEONE, code: 'OTHERCODE123' }), res as never)
    expect(res.statusCode).toBe(200)
    expect(h.computeMemberChart).toHaveBeenCalledWith(ME)
    expect(res.body).toEqual({ data: payload })
  })

  it('no birth yet → 200 { data: null } (the "no chart" answer home already handles)', async () => {
    h.resolveSessionUserId.mockResolvedValue({ ok: true, userId: ME })
    h.computeMemberChart.mockResolvedValue({ ok: false, reason: 'no-birth' })
    const res = mockRes()
    await chartHandler(get(), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ data: null })
  })

  it('engine fails → 502 (home: default mascot; first-run: unavailable)', async () => {
    h.resolveSessionUserId.mockResolvedValue({ ok: true, userId: ME })
    h.computeMemberChart.mockRejectedValue(new EngineChartError('down'))
    const res = mockRes()
    await chartHandler(get(), res as never)
    expect(res.statusCode).toBe(502)
  })

  it('not signed in → 401; session ≠ member cookie → 409; neither computes', async () => {
    h.resolveSessionUserId.mockResolvedValue({ ok: false, status: 401, error: 'not signed in' })
    let res = mockRes()
    await chartHandler(get(), res as never)
    expect(res.statusCode).toBe(401)
    h.resolveSessionUserId.mockResolvedValue({ ok: true, userId: ME })
    res = mockRes()
    await chartHandler(get({ 'cookie-mumate-id': SOMEONE }), res as never)
    expect(res.statusCode).toBe(409)
    expect(h.computeMemberChart).not.toHaveBeenCalled()
  })

  it('makes no call to the backend', async () => {
    h.resolveSessionUserId.mockResolvedValue({ ok: true, userId: ME })
    h.computeMemberChart.mockResolvedValue({ ok: true, chart: payload })
    await chartHandler(get(), mockRes() as never)
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('be.test'))).toBe(false)
  })
})

describe('CR2 — computeMemberChart (the live source for home + first-run)', () => {
  const sqlText = (q: unknown) => JSON.stringify((q as { queryChunks?: unknown })?.queryChunks ?? q)
  const CYCLE = { id: '13', element: 'METAL', power: 'YANG', gender: 'MALE', element_friend: 'METAL', element_work: 'WATER', element_career: 'FIRE', element_fortune: 'WOOD', element_spouse: 'WOOD', element_supporter: 'EARTH' }

  function dbWith(user: Record<string, unknown> | null, profile: Record<string, unknown> | null) {
    h.execute.mockImplementation(async (q: unknown) => {
      const t = sqlText(q)
      if (t.includes('bazi_user_profile')) return profile ? [profile] : []
      if (t.includes('element_cycle')) return [CYCLE, { ...CYCLE, id: '14', gender: 'FEMALE' }]
      if (t.includes('user_id, name, dob')) return user ? [user] : []
      throw new Error(`unexpected query ${t}`)
    })
  }

  it('the engine profile birth wins; stored gender picks the cycle row; paths v2 reads are present', async () => {
    dbWith(
      { user_id: ME, name: 'x', dob: '1980-01-01', time: '', gender: 'MALE', place_name: '', is_remember_time: false },
      { birth_date: '1990-05-15', birth_time: '08:30', time_unknown: false },
    )
    const r = await actualServer.computeMemberChart(ME)
    expect(r.ok).toBe(true)
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body)
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://engine.test/api/bazi/public-calc')
    expect(body).toEqual({ birthDate: '1990-05-15', birthTime: '08:30', gender: 'male', province: 'Bangkok' })
    if (!r.ok) return
    expect(r.chart).toMatchObject({
      dob: '1990-05-15',
      time: '08:30',
      gender: 'MALE',
      detail: { yearBelow: { id: 7, constellation: 'HORSE' }, dayAbove: { element: 'METAL', power: 'YANG' } },
      elementCycle: { id: 13, gender: 'MALE' },
    })
  })

  it('time not remembered → the engine gets 12:00 and the chart says time ""', async () => {
    dbWith({ user_id: ME, dob: '1990-05-15', time: '09:00', gender: 'FEMALE', place_name: '', is_remember_time: false }, null)
    const r = await actualServer.computeMemberChart(ME)
    expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body).birthTime).toBe('12:00')
    expect(r.ok && r.chart.time).toBe('')
    expect(r.ok && r.chart.elementCycle?.gender).toBe('FEMALE')
  })

  it('no gender → chart without a cycle (first-run shows unavailable), not an error', async () => {
    dbWith({ user_id: ME, dob: '1990-05-15', time: '', gender: null, place_name: '', is_remember_time: false }, null)
    const r = await actualServer.computeMemberChart(ME)
    expect(r.ok && r.chart.elementCycle).toBeNull()
  })

  it('no dob (registered-but-empty row) → no-birth, no engine call; no row → no-user', async () => {
    dbWith({ user_id: ME, dob: '', time: '', gender: 'MALE', place_name: '', is_remember_time: false }, null)
    expect(await actualServer.computeMemberChart(ME)).toEqual({ ok: false, reason: 'no-birth' })
    expect(fetchMock).not.toHaveBeenCalled()
    dbWith(null, null)
    expect(await actualServer.computeMemberChart(ME)).toEqual({ ok: false, reason: 'no-user' })
  })

  it('engine glyphs we cannot map → EngineChartError (never a guessed chart)', async () => {
    dbWith({ user_id: ME, dob: '1990-05-15', time: '', gender: 'MALE', place_name: '', is_remember_time: false }, null)
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ pillars: { year: { branch: '?' } } }) })
    await expect(actualServer.computeMemberChart(ME)).rejects.toBeInstanceOf(EngineChartError)
  })
})

describe('CR3 — /api/calculator/compute (v2 element finder) without the backend', () => {
  const post = (body: unknown) =>
    ({
      method: 'POST',
      body,
      headers: { origin: 'http://app.test', host: 'app.test', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 200)}` },
      cookies: { calc_nonce: issueNonce() },
    }) as never

  it('toElementFinderData: the engine year branch → animal in the paths the page reads', () => {
    const d = toElementFinderData(ENGINE_ANSWER as never)!
    expect(d.detail.yearBelow).toEqual({ id: 7, constellation: 'HORSE', chinese_symbol: '午' })
    expect(d.yearOfZodiac.below).toBe('午')
    expect(resolveMascotFromCompute(d as never)?.filename).toBe('07_มะเมีย-ทอง')
    expect(toElementFinderData(null)).toBeNull()
    expect(toElementFinderData({ ...ENGINE_ANSWER, pillars: undefined } as never)).toBeNull()
  })

  it('200 with the mascot inputs; the only outbound call is the engine', async () => {
    const res = mockRes()
    await computeHandler(post({ dob: '1990-05-15', time: '08:30', gender: 'MALE' }), res as never)
    expect(res.statusCode).toBe(200)
    expect(resolveMascotFromCompute(res.body.data)?.filename).toBe('07_มะเมีย-ทอง')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://engine.test/api/bazi/public-calc')
    expect(h.insertValues).toHaveBeenCalledTimes(1) // usage counter still recorded
  })

  it('engine down → 502 and no usage recorded (there is no backend fallback any more)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    const res = mockRes()
    await computeHandler(post({ dob: '1990-05-15', time: '', gender: 'FEMALE' }), res as never)
    expect(res.statusCode).toBe(502)
    expect(h.insertValues).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes('be.test'))).toBe(true)
  })
})
