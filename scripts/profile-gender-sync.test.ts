// scripts/profile-gender-sync.test.ts — /api/profile: เพศต้องถึงตารางที่ตัวคำนวณอ่านจริง (ประชุม 24 พ.ย. ข้อ 5).
//
// THE BUG, in the meeting's words: "เคสใส่เพศผิดแล้วดวงกลับด้าน" and the customer could not find where to fix it.
// They did fix it — on /v2/settings/edit-profile. That PATCH wrote engine `bazi_user_profile.gender`, but every
// calculator reads legacy `user.gender` (lib/bazi-bridge/input.ts userRowToFeCalcInput; mergeEngineBirth overlays
// only the birth). The save succeeded, the screen showed the new value, and the reading never changed.
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here:
//   G1  the PATCH no longer mirrors gender into legacy `user`            → "1 · PATCH mirrors" RED
//   G2  the destiny cache survives a gender change (it keys on the birth) → "1 · PATCH mirrors" RED
//   G3  a refused engine save is mirrored anyway (engine said 409)       → "4 · a refused save" RED
//   G4  GET stops healing a legacy row that never got the chosen gender  → "5 · GET heals" RED
//   G5  GET shows no gender when only legacy has one (the form then starts blank, and a blank save guesses) → "6 · GET falls back" RED
//   G6  gender is sent on a birth-only save / an unknown value is written → "3 · unknown value" RED
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ execute: vi.fn(), baziFetch: vi.fn(), resolve: vi.fn() }))

vi.mock('@/lib/db', () => ({ db: { execute: h.execute } }))
vi.mock('@/lib/bazi/fetch', () => ({ baziFetch: h.baziFetch }))
vi.mock('@/lib/v2/resolve-user', () => ({ resolveRouteMember: h.resolve }))

import handler from '@/pages/api/profile'

const ME = 'u-1'
type Res = { statusCode: number; body: any; status: (c: number) => Res; json: (b: unknown) => Res }
function mockRes(): Res {
  const res = { statusCode: 0, body: undefined } as Res
  res.status = (c) => ((res.statusCode = c), res)
  res.json = (b) => ((res.body = b), res)
  return res
}
const call = (method: 'GET' | 'PATCH', body: unknown = {}) => ({ method, body, headers: {}, cookies: {} }) as never

// what the legacy row holds right now — the test moves it, the way a real UPDATE would
let legacyGender: string | null
let failUpdate = false
const sqlText = (q: unknown) => JSON.stringify((q as { queryChunks?: unknown })?.queryChunks ?? q)
// JSON.stringify escapes the quotes inside an SQL fragment ("user" → \"user\") — match either spelling
const has = (text: string, needle: string) => text.includes(needle) || text.includes(needle.replace(/"/g, '\\"'))

beforeEach(() => {
  legacyGender = 'MALE'
  failUpdate = false
  h.execute.mockReset()
  h.baziFetch.mockReset()
  h.resolve.mockReset()
  h.resolve.mockResolvedValue({ ok: true, userId: ME })
  h.execute.mockImplementation(async (q: unknown) => {
    const t = sqlText(q)
    if (t.includes('SELECT gender FROM')) return [{ gender: legacyGender }]
    if (has(t, 'UPDATE "user" SET gender')) {
      if (failUpdate) throw new Error('db down')
      legacyGender = t.includes('FEMALE') ? 'FEMALE' : 'MALE'
      return []
    }
    return []
  })
})
const engine = (profile: Record<string, unknown> | null, status = 200) =>
  h.baziFetch.mockResolvedValue({ ok: status < 400, status, json: async () => (status < 400 ? { profile } : { error: 'nope' }) })
const ran = () => h.execute.mock.calls.map((c) => sqlText(c[0]))
const updates = () => ran().filter((t) => has(t, 'UPDATE "user" SET gender'))
const cacheClears = () => ran().filter((t) => has(t, 'DELETE FROM "bazi_destiny_cache"'))

describe('/api/profile — เพศถึงตารางที่ตัวคำนวณอ่าน', () => {
  it('1 · PATCH with a gender mirrors it into legacy `user` and drops the cached destiny', async () => {
    engine({ gender: 'FEMALE' })
    const res = mockRes()
    await handler(call('PATCH', { gender: 'FEMALE' }), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body.profile.gender).toBe('FEMALE')
    expect(updates()).toHaveLength(1)
    expect(updates()[0]).toContain('FEMALE')
    expect(cacheClears()).toHaveLength(1)
    expect(legacyGender).toBe('FEMALE')
  })

  it('2 · the same gender as legacy = nothing to write, nothing to clear', async () => {
    engine({ gender: 'MALE' })
    const res = mockRes()
    await handler(call('PATCH', { gender: 'MALE' }), res as never)
    expect(res.statusCode).toBe(200)
    expect(updates()).toHaveLength(0)
    expect(cacheClears()).toHaveLength(0)
  })

  it('3 · an unknown value is never written, and a birth-only save sends no gender of its own', async () => {
    engine({ gender: 'FEMALE' })
    await handler(call('PATCH', { gender: 'banana' }), mockRes() as never)
    expect(updates()).toHaveLength(0)
    await handler(call('PATCH', { birth: '1995-06-15', birthTime: null, timeUnknown: true }), mockRes() as never)
    expect(updates()).toHaveLength(0)
    // the engine call carries the member's id and nothing the caller did not send
    const sent = JSON.parse(String((h.baziFetch.mock.calls[1] as any)[1].body))
    expect(sent).toEqual({ birth: '1995-06-15', birthTime: null, timeUnknown: true, anonId: ME })
  })

  it('4 · a refused save is not mirrored: engine 409 → nothing reaches legacy `user`', async () => {
    engine(null, 409)
    const res = mockRes()
    await handler(call('PATCH', { gender: 'FEMALE' }), res as never)
    expect(res.statusCode).toBe(409)
    expect(updates()).toHaveLength(0)
    expect(cacheClears()).toHaveLength(0)
  })

  it('5 · GET heals a legacy row that never got the gender the member chose', async () => {
    // the customer who already fixed it on the old screen: engine FEMALE, legacy still MALE
    legacyGender = 'MALE'
    engine({ gender: 'FEMALE', birthDate: '1995-06-15' })
    const res = mockRes()
    await handler(call('GET'), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body.profile.gender).toBe('FEMALE')
    expect(updates()).toHaveLength(1)
    expect(cacheClears()).toHaveLength(1)
    expect(legacyGender).toBe('FEMALE')
  })

  it('6 · GET with no engine gender shows the legacy one — the form must not start blank', async () => {
    legacyGender = 'FEMALE'
    engine({ birthDate: '1995-06-15' })
    const res = mockRes()
    await handler(call('GET'), res as never)
    expect(res.body.profile.gender).toBe('FEMALE')
    expect(updates()).toHaveLength(0)
    // engine row not created yet (profile null) → still the legacy gender, never a guess
    engine(null)
    const res2 = mockRes()
    await handler(call('GET'), res2 as never)
    expect(res2.body.profile?.gender).toBe('FEMALE')
  })

  it('7 · legacy sync is best-effort: a failing UPDATE never fails the save (the engine is the record)', async () => {
    failUpdate = true
    engine({ gender: 'FEMALE' })
    const res = mockRes()
    await handler(call('PATCH', { gender: 'FEMALE' }), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body.profile.gender).toBe('FEMALE')
  })

  it('8 · a member who is not signed in is refused before anything is read or written', async () => {
    h.resolve.mockResolvedValue({ ok: false, status: 401, body: { error: 'not signed in' } })
    const res = mockRes()
    await handler(call('PATCH', { gender: 'FEMALE' }), res as never)
    expect(res.statusCode).toBe(401)
    expect(h.execute).not.toHaveBeenCalled()
    expect(h.baziFetch).not.toHaveBeenCalled()
  })
})
