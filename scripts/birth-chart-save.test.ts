// mumate-be-retirement-001 slice 1 — the register / edit-birth writer that replaces mootech-be's
// POST /chinese-horoscope for v2 (lib/chart/save-birth-chart.ts, pages/api/v2/birth-chart.ts).
//
// 🔴 MUTANT CONTRACT:
//   BC1 the `user` columns BE wrote: dob, time, is_remember_time, gender, result_code, is_refresh=false,
//       name, surname, picture_url, account_name, place_name — and a field NOT sent is left alone
//   BC2 time is '' when unknown — never NULL (user.time is NOT NULL)
//   BC3 identity is the SESSION: a body user_id is never read; a session/cookie disagreement is refused
//   BC4 result_code: BE's 12-char format, the same code on the user row and the log row
//   BC5 log_calculate: ONE minimal row (user_id, createAt Bangkok, name '', inputs, small JSON)
//   BC6 the engine is best-effort: down → still registered, the JSON says so
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/v2/resolve-user', async () => {
  const actual = await vi.importActual<typeof import('@/lib/v2/resolve-user')>('@/lib/v2/resolve-user')
  return { ...actual, resolveSessionUserId: vi.fn() }
})
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))

import {
  parseBirthChartBody,
  buildBirthChartWrite,
  saveBirthChart,
  type BirthChartStore,
  type BirthChartWrite,
} from '@/lib/chart/save-birth-chart'
import { buildChartPayload, deriveChartCore, RESULT_CODE_RE, type ChartPayload } from '@/lib/chart/engine-chart'
import { createBirthChartHandler } from '@/pages/api/v2/birth-chart'

const SESSION_USER = '11111111-1111-4111-8111-111111111111'
const OTHER_USER = '22222222-2222-4222-8222-222222222222'

const CHART: ChartPayload = buildChartPayload(
  { dob: '1990-05-15', time: '08:30', gender: 'MALE' },
  deriveChartCore({ pillars: { year: { branch: '午' }, day: { stem: '庚' } } })!,
  null,
)

function fakeStore(member: { gender: string | null; placeName: string | null } | null = { gender: 'FEMALE', placeName: '' }) {
  const saved: BirthChartWrite[] = []
  const store: BirthChartStore = {
    readMember: vi.fn(async () => member),
    save: vi.fn(async (w: BirthChartWrite) => {
      if (!member) return false
      saved.push(w)
      return true
    }),
  }
  return { store, saved }
}

describe('parseBirthChartBody', () => {
  it('register body (what useV2ProfileForm sends)', () => {
    expect(
      parseBirthChartBody({ dob: '1995-06-15', time: '14:30', gender: 'female', name: 'A', surname: '', picture_url: 'p', account_name: 'A' }),
    ).toEqual({ dob: '1995-06-15', time: '14:30', gender: 'FEMALE', name: 'A', surname: '', pictureUrl: 'p', accountName: 'A' })
  })

  it('BC2 — time missing / null / "" all mean unknown → ""', () => {
    expect(parseBirthChartBody({ dob: '1995-06-15' })?.time).toBe('')
    expect(parseBirthChartBody({ dob: '1995-06-15', time: null })?.time).toBe('')
    expect(parseBirthChartBody({ dob: '1995-06-15', time: '' })?.time).toBe('')
  })

  it('edit-birth body: only dob/time → nothing else is set', () => {
    expect(parseBirthChartBody({ dob: '1995-06-15', time: '' })).toEqual({ dob: '1995-06-15', time: '' })
  })

  it('BC3 — user_id / userId in the body are not part of the input', () => {
    const r = parseBirthChartBody({ dob: '1995-06-15', user_id: OTHER_USER, userId: OTHER_USER })
    expect(r).toEqual({ dob: '1995-06-15', time: '' })
  })

  it.each([
    ['no body', undefined],
    ['no dob', { time: '10:00' }],
    ['bad dob', { dob: '19950615' }],
    ['impossible date', { dob: '2026-02-31' }],
    ['bad time', { dob: '1995-06-15', time: '25:00' }],
    ['time not a string', { dob: '1995-06-15', time: 1030 }],
    ['unknown gender', { dob: '1995-06-15', gender: 'OTHER' }],
    ['over-long name', { dob: '1995-06-15', name: 'x'.repeat(256) }],
    ['name not a string', { dob: '1995-06-15', name: 5 }],
  ])('%s → null', (_l, body) => {
    expect(parseBirthChartBody(body)).toBeNull()
  })
})

describe('buildBirthChartWrite', () => {
  const now = new Date('2026-09-27T03:04:05Z') // 10:04:05 in Bangkok

  it('BC1/BC4/BC5 — register: every user column BE wrote, one code on both rows, minimal log row', () => {
    const input = parseBirthChartBody({ dob: '1995-06-15', time: '14:30', gender: 'MALE', name: 'A', surname: 'B', picture_url: 'p', account_name: 'A' })!
    const w = buildBirthChartWrite(SESSION_USER, input, 'MALE', CHART, { now, code: 'AbC123xyZ789' })
    expect(w.userId).toBe(SESSION_USER)
    expect(w.user).toEqual({
      dob: '1995-06-15',
      time: '14:30',
      isRememberTime: true,
      resultCode: 'AbC123xyZ789',
      isRefresh: false,
      gender: 'MALE',
      name: 'A',
      surname: 'B',
      pictureUrl: 'p',
      accountName: 'A',
    })
    expect(w.log).toEqual({
      userId: SESSION_USER,
      createat: '2026-09-27 10:04:05',
      name: '',
      dob: '1995-06-15',
      time: '14:30',
      gender: 'MALE',
      isRememberTime: true,
      placeName: null,
      code: 'AbC123xyZ789',
      result: JSON.stringify(CHART),
    })
    expect(JSON.parse(w.log.result)).toMatchObject({ detail: { yearBelow: { id: 7 }, dayAbove: { element: 'METAL' } } })
  })

  it('BC2 — unknown time: "" on both rows, is_remember_time false, never null', () => {
    const w = buildBirthChartWrite(SESSION_USER, { dob: '1995-06-15', time: '' }, 'FEMALE', null, { now })
    expect(w.user.time).toBe('')
    expect(w.user.isRememberTime).toBe(false)
    expect(w.log.time).toBe('')
    expect(w.log.isRememberTime).toBe(false)
  })

  it('BC1 — edit-birth: name/surname/picture/account/gender/place NOT in the update (left as stored)', () => {
    const w = buildBirthChartWrite(SESSION_USER, { dob: '1995-06-15', time: '' }, 'FEMALE', null, { now })
    expect(Object.keys(w.user).sort()).toEqual(['dob', 'isRefresh', 'isRememberTime', 'resultCode', 'time'])
    expect(w.log.gender).toBe('FEMALE') // the log row still records the gender the chart used
  })

  it('BC4 — a generated code has BE format', () => {
    const w = buildBirthChartWrite(SESSION_USER, { dob: '1995-06-15', time: '' }, null, null)
    expect(w.user.resultCode).toMatch(RESULT_CODE_RE)
    expect(w.log.code).toBe(w.user.resultCode)
  })

  it('BC6 — without the engine the JSON is the birth only, marked unavailable', () => {
    const w = buildBirthChartWrite(SESSION_USER, { dob: '1995-06-15', time: '' }, 'FEMALE', null, { now })
    expect(JSON.parse(w.log.result)).toEqual({ source: 'bazi-engine', engine: 'unavailable', dob: '1995-06-15', time: '', gender: 'FEMALE' })
  })
})

describe('saveBirthChart', () => {
  it('uses the STORED gender for the chart when the caller sends none (edit-birth)', async () => {
    const { store, saved } = fakeStore({ gender: 'FEMALE', placeName: 'ตรัง' })
    const compute = vi.fn(async () => CHART)
    const r = await saveBirthChart(store, SESSION_USER, { dob: '1995-06-15', time: '' }, compute)
    expect(r.ok).toBe(true)
    expect(compute).toHaveBeenCalledWith({ dob: '1995-06-15', time: '', gender: 'FEMALE', place_name: 'ตรัง' })
    expect(saved[0].user.gender).toBeUndefined()
  })

  it('BC6 — engine throws → still saved, code returned, chart null', async () => {
    const { store, saved } = fakeStore()
    const onEngineError = vi.fn()
    const r = await saveBirthChart(store, SESSION_USER, { dob: '1995-06-15', time: '' }, async () => {
      throw new Error('engine down')
    }, { onEngineError })
    expect(r).toMatchObject({ ok: true, chart: null })
    expect(onEngineError).toHaveBeenCalled()
    expect(saved).toHaveLength(1)
  })

  it('no member row → 404, nothing computed or written', async () => {
    const { store, saved } = fakeStore(null)
    const compute = vi.fn(async () => CHART)
    expect(await saveBirthChart(store, SESSION_USER, { dob: '1995-06-15', time: '' }, compute)).toEqual({ ok: false, status: 404 })
    expect(compute).not.toHaveBeenCalled()
    expect(saved).toHaveLength(0)
  })
})

// ---- the route --------------------------------------------------------------------------------------

type Res = { statusCode: number; body: unknown; status: (c: number) => Res; json: (b: unknown) => Res }
function mockRes(): Res {
  const res = { statusCode: 0, body: undefined } as Res
  res.status = (c) => ((res.statusCode = c), res)
  res.json = (b) => ((res.body = b), res)
  return res
}
const req = (body: unknown, cookies: Record<string, string> = {}, method = 'POST') => ({ method, body, cookies, headers: {} }) as never

describe('POST /api/v2/birth-chart', () => {
  let resolve: ReturnType<typeof vi.fn>
  let fake: ReturnType<typeof fakeStore>
  let handler: ReturnType<typeof createBirthChartHandler>

  beforeEach(() => {
    resolve = vi.fn(async () => ({ ok: true, userId: SESSION_USER }))
    fake = fakeStore()
    handler = createBirthChartHandler({ resolve: resolve as never, store: () => fake.store, computeChart: async () => CHART })
  })

  it('BC3 — writes the SESSION member even when the body names someone else; answers { code }', async () => {
    const res = mockRes()
    await handler(req({ dob: '1995-06-15', time: '14:30', gender: 'MALE', user_id: OTHER_USER }, { 'cookie-mumate-id': SESSION_USER }), res as never)
    expect(res.statusCode).toBe(200)
    expect(fake.saved[0].userId).toBe(SESSION_USER)
    expect(fake.saved[0].log.userId).toBe(SESSION_USER)
    expect((res.body as { code: string }).code).toMatch(RESULT_CODE_RE)
    expect((res.body as { code: string }).code).toBe(fake.saved[0].user.resultCode)
  })

  it('BC3 — session and MEMBER_ID cookie disagree → 409, nothing written', async () => {
    const res = mockRes()
    await handler(req({ dob: '1995-06-15' }, { 'cookie-mumate-id': OTHER_USER }), res as never)
    expect(res.statusCode).toBe(409)
    expect(fake.saved).toHaveLength(0)
  })

  it('not signed in → the resolver status, nothing written', async () => {
    resolve.mockResolvedValueOnce({ ok: false, status: 401, error: 'not signed in' })
    const res = mockRes()
    await handler(req({ dob: '1995-06-15' }), res as never)
    expect(res.statusCode).toBe(401)
    expect(fake.saved).toHaveLength(0)
  })

  it('malformed body → 400 before identity is even resolved', async () => {
    const res = mockRes()
    await handler(req({ dob: 'nope' }), res as never)
    expect(res.statusCode).toBe(400)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('GET → 405', async () => {
    const res = mockRes()
    await handler(req(undefined, {}, 'GET'), res as never)
    expect(res.statusCode).toBe(405)
  })

  it('store failure → 500 (the caller shows "บันทึกไม่สำเร็จ")', async () => {
    fake.store.save = vi.fn(async () => {
      throw new Error('db down')
    })
    const res = mockRes()
    await handler(req({ dob: '1995-06-15' }), res as never)
    expect(res.statusCode).toBe(500)
  })
})
