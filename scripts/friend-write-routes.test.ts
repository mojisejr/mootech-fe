// CIEL mumate-be-retirement-001 slice 1e — the two friend WRITE routes: who they write for, and what they
// answer. The store is mocked; the real-database half is scripts/friend-write-db.test.ts.
//
//   POST /api/member-with-friend           (pages/api/member-with-friend/index.ts, POST branch)
//   PUT  /api/member-with-friend/profile   (pages/api/member-with-friend/profile.ts)
//
// Bug-class this owns: a write that takes its OWNER from the request. The BE took `user_id` from the create
// body and had no owner at all on update, so any caller could fill or edit any member's friend list.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MR1  POST reads user_id from the body again              → ① reddens
//   MR2  the `if (!who.ok)` gate is dropped on either route    → ② reddens (the store is reached)
//   MR3  the quota refusal is answered as 200 or reshaped      → ③ reddens
//   MR4  PUT stops passing the session user to the store       → ④ reddens
//   MR5  the cookie-mismatch refusal is dropped                → ⑤ reddens
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  who: { ok: true, userId: 'CALLER-A' } as { ok: true; userId: string } | { ok: false; status: 401 | 404 | 409; error: string },
  mismatch: false,
}))
vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSessionUserId: vi.fn(async () => h.who),
  memberCookieMismatch: vi.fn(() => h.mismatch),
}))

const store = vi.hoisted(() => ({ createFriend: vi.fn(), updateFriendProfile: vi.fn() }))
vi.mock('@/lib/v2/friend-store', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  // parseFriendFields stays REAL: the request-shape rules are part of what these routes own.
  return { ...actual, createFriend: store.createFriend, updateFriendProfile: store.updateFriendProfile }
})
// The GET/DELETE branches of index.ts import the db and usage modules; nothing here reaches them.
vi.mock('@/lib/db', () => ({ db: {} }))

import friendsHandler from '../pages/api/member-with-friend/index'
import profileHandler from '../pages/api/member-with-friend/profile'

function makeRes() {
  const res: { statusCode: number; body: any; status: any; json: any; setHeader: any } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
    setHeader: vi.fn(),
  }
  return res
}
const req = (method: string, body: unknown) => ({ method, body, cookies: {}, headers: {}, query: {} }) as never

// The exact body v2's buildCreateFriendArgs → MemberWithFriendCreateApi sends (compatibility-api.ts).
const V2_CREATE = {
  user_id: 'VICTIM-9999',
  dob: '1995-05-05',
  time: '07:30',
  gender: 'FEMALE',
  is_remember_time: true,
  name: 'Mali',
  surname: '',
  picture_url: 'https://p.supabase.co/storage/v1/object/public/mootech/mumate/profile/x.jpg',
}
// The exact body buildEditFriendArgs → MemberWithFriendUpdateProfileWithStatusApi sends.
const V2_EDIT = { friend_id: 'F-1', dob: '2000-01-02', time: '', gender: 'MALE', is_remember_time: false, name: 'N', surname: 'S' }

const ROW = { id: 'F-NEW', user_id: 'CALLER-A', name: 'Mali' }

describe('POST /api/member-with-friend + PUT /api/member-with-friend/profile — the session owns the row', () => {
  beforeEach(() => {
    h.who = { ok: true, userId: 'CALLER-A' }
    h.mismatch = false
    store.createFriend.mockReset().mockResolvedValue({ ok: true, row: ROW })
    store.updateFriendProfile.mockReset().mockResolvedValue({ ok: true, row: { ...ROW, id: 'F-1' } })
  })

  it('🔴 ① POST: the owner is the session; the body\'s user_id is never passed on', async () => {
    const res = makeRes()
    await friendsHandler(req('POST', V2_CREATE), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(ROW)
    const arg = store.createFriend.mock.calls[0][0]
    expect(arg.userId).toBe('CALLER-A')
    expect(JSON.stringify(arg)).not.toContain('VICTIM-9999')
    expect(arg).toMatchObject({
      dob: '1995-05-05', time: '07:30', gender: 'FEMALE', isRememberTime: true, name: 'Mali', surname: '',
      pictureUrl: V2_CREATE.picture_url,
    })
  })

  it('🔴 ② no session → the resolver\'s status, and neither store is reached', async () => {
    for (const refusal of [
      { ok: false as const, status: 401 as const, error: 'not signed in' },
      { ok: false as const, status: 409 as const, error: 'identity is ambiguous' },
    ]) {
      h.who = refusal
      const a = makeRes()
      await friendsHandler(req('POST', V2_CREATE), a as never)
      const b = makeRes()
      await profileHandler(req('PUT', V2_EDIT), b as never)
      expect(a.statusCode).toBe(refusal.status)
      expect(b.statusCode).toBe(refusal.status)
      expect(a.body.error).toBe(refusal.error) // `error` present → v2 createFriend reports a failure
    }
    expect(store.createFriend).not.toHaveBeenCalled()
    expect(store.updateFriendProfile).not.toHaveBeenCalled()
  })

  it('🔴 ③ quota refused → 410 with the BE\'s HttpException body verbatim', async () => {
    const body = { code: 404, message: 'เกิน Limit การใช้งาน', error: 'Error' as const }
    store.createFriend.mockResolvedValueOnce({ ok: false, reason: 'quota', body })
    const res = makeRes()
    await friendsHandler(req('POST', V2_CREATE), res as never)
    expect(res.statusCode).toBe(410)
    expect(res.body).toEqual(body)
  })

  it('🔴 ④ PUT: the store is asked for the SESSION\'s row; not found (or someone else\'s) → 404', async () => {
    const ok = makeRes()
    await profileHandler(req('PUT', V2_EDIT), ok as never)
    expect(ok.statusCode).toBe(200)
    expect(store.updateFriendProfile.mock.calls[0][0]).toMatchObject({
      userId: 'CALLER-A', friendId: 'F-1', dob: '2000-01-02', time: '', gender: 'MALE', isRememberTime: false, name: 'N', surname: 'S',
    })
    store.updateFriendProfile.mockResolvedValueOnce({ ok: false, reason: 'not-found' })
    const nf = makeRes()
    await profileHandler(req('PUT', V2_EDIT), nf as never)
    expect(nf.statusCode).toBe(404)
    expect(nf.body).toEqual({ error: 'friend not found' })
  })

  it('🔴 ⑤ the MEMBER_ID cookie names a different account than the session → 409, nothing written', async () => {
    h.mismatch = true
    const a = makeRes()
    await friendsHandler(req('POST', V2_CREATE), a as never)
    const b = makeRes()
    await profileHandler(req('PUT', V2_EDIT), b as never)
    expect(a.statusCode).toBe(409)
    expect(b.statusCode).toBe(409)
    expect(store.createFriend).not.toHaveBeenCalled()
    expect(store.updateFriendProfile).not.toHaveBeenCalled()
  })

  it('⑥ malformed input → 400 before any write (the BE let the database refuse it as a 500)', async () => {
    const cases: Array<[typeof friendsHandler, string, Record<string, unknown>]> = [
      [friendsHandler, 'POST', { ...V2_CREATE, dob: undefined }],
      [friendsHandler, 'POST', { ...V2_CREATE, dob: '' }],
      [friendsHandler, 'POST', { ...V2_CREATE, time: undefined }],
      [friendsHandler, 'POST', { ...V2_CREATE, is_remember_time: 'yes' }],
      [friendsHandler, 'POST', { ...V2_CREATE, name: 42 }],
      [friendsHandler, 'POST', { ...V2_CREATE, picture_url: { x: 1 } }],
      [profileHandler, 'PUT', { ...V2_EDIT, friend_id: '' }],
      [profileHandler, 'PUT', { ...V2_EDIT, gender: ['MALE'] }],
    ]
    for (const [handler, method, body] of cases) {
      const res = makeRes()
      await handler(req(method, body), res as never)
      expect(res.statusCode, JSON.stringify(body)).toBe(400)
    }
    expect(store.createFriend).not.toHaveBeenCalled()
    expect(store.updateFriendProfile).not.toHaveBeenCalled()
  })

  it('⑦ time may be \'\' (birth time unknown) on create — v2 sends that when is_remember_time is false', async () => {
    const res = makeRes()
    await friendsHandler(req('POST', { ...V2_CREATE, time: '', is_remember_time: false }), res as never)
    expect(res.statusCode).toBe(200)
  })

  it('⑧ a store failure is a 500 that does not relay the driver text', async () => {
    store.createFriend.mockRejectedValueOnce(new Error('duplicate key SECRET-DETAIL'))
    const res = makeRes()
    await friendsHandler(req('POST', V2_CREATE), res as never)
    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('SECRET-DETAIL')
  })

  it('⑨ PUT /profile refuses other methods; PUT /member-with-friend (v1 picture update) is not served here', async () => {
    const a = makeRes()
    await profileHandler(req('POST', V2_EDIT), a as never)
    expect(a.statusCode).toBe(405)
    const b = makeRes()
    await friendsHandler(req('PUT', { friend_id: 'F-1', image: 'x' }), b as never)
    expect(b.statusCode).toBe(405)
  })
})
