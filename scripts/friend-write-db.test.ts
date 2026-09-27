// CIEL mumate-be-retirement-001 slice 1e — the friend writes against a REAL postgres.
//
// `describe.skipIf(!TEST_DATABASE_URL)`. Run it against the testenv pg for the PR proof:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/friend-write-db.test.ts
//
// What only a real database can show: the row the BE would have written (every column, the defaults the
// DB fills), the quota read from a real member_payment row, a burst that cannot slip past the ceiling, and
// an update that cannot reach another member's row. The route-level identity rules have their own spec
// (scripts/friend-write-routes.test.ts); the handler is still driven here once per route so the session →
// row path is proven end to end on real rows.
//
// 🔴 THE POOL SIZE IS SWITCHABLE ON PURPOSE. Production runs ONE connection (lib/db/index.ts, max: 1). A
//    `db.` call slipped inside the create transaction would self-deadlock there — and pass silently on a
//    bigger pool. So every case runs on a max:1 pool EXCEPT the burst, which needs a real 10-connection pool
//    or the race cannot occur (the compat-quota-concurrency-db.test.ts lesson).
//
// 🔴 MUTANT CONTRACT (each reddens this file against the testenv pg):
//   MF1  drop the advisory lock in createFriend                → ⑤ writes more than 20 rows
//   MF2  count outside the transaction (pre-check only)         → ⑤ writes more than 20 rows
//   MF3  resolveMembership moved INSIDE the transaction          → ① times out on the max:1 pool
//   MF4  drop `user_id = <session>` from the update's WHERE      → ⑦ reddens (someone else's row changes)
//   MF5  write `undefined` fields as NULL on update              → ⑧ reddens
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const TEST_URL = process.env.TEST_DATABASE_URL

const pool = vi.hoisted(() => ({ current: null as unknown, one: null as unknown, ten: null as unknown }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  if (process.env.TEST_DATABASE_URL) {
    pool.one = drizzle(postgres(process.env.TEST_DATABASE_URL, { prepare: false, max: 1 }), { schema })
    pool.ten = drizzle(postgres(process.env.TEST_DATABASE_URL, { prepare: false, max: 10 }), { schema })
    pool.current = pool.one
  }
  return {
    get db() {
      return pool.current
    },
    schema,
  }
})

const who = vi.hoisted(() => ({ value: { ok: true, userId: '' } as { ok: true; userId: string } | { ok: false; status: 401; error: string } }))
vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSessionUserId: vi.fn(async () => who.value),
  memberCookieMismatch: vi.fn(() => false),
}))

import { createFriend, updateFriendProfile } from '@/lib/v2/friend-store'
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

describe.skipIf(!TEST_URL)('be-retirement 1e · friend create / update-profile · real pg', () => {
  let sql: ReturnType<typeof postgres>
  let userId: string
  let otherId: string
  const stamp = '2026-09-27 09:00:00'
  // "user".user_id is varchar(36): the prefix plus 32 hex is exactly 36.
  const newId = () => `bx1-${randomUUID().replace(/-/g, '')}`

  async function seedUser(id: string) {
    await sql`INSERT INTO "user" (user_id, create_at, update_at, login_at, name, dob, time, is_remember_time,
                                  gender, result_code, place_name, used_point, total_point, is_refresh,
                                  share_img_profile_url)
              VALUES (${id}, ${stamp}, ${stamp}, ${stamp}, 'Tester', '1990-01-01', '08:00', true,
                      'MALE', '0000', '', 0, 20, false, '')`
  }
  async function seedFriends(id: string, n: number) {
    for (let i = 0; i < n; i++) {
      await sql`INSERT INTO member_with_friend (id, user_id, create_at, update_at, name, dob, time,
                                                is_remember_time, gender, place_name, is_member, member_id, is_notify)
                VALUES (${randomUUID()}, ${id}, ${stamp}, ${stamp}, ${'F' + i}, '1992-02-02', '09:00',
                        true, 'FEMALE', '', false, '', false)`
    }
  }
  async function friendCount(id: string): Promise<number> {
    const [r] = await sql`SELECT count(*)::int AS n FROM member_with_friend WHERE user_id = ${id}`
    return Number(r.n)
  }
  const form = { dob: '1995-05-05', time: '07:30', isRememberTime: true, gender: 'FEMALE', name: 'Mali', surname: '' }

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { prepare: false, max: 3 })
  })
  afterAll(async () => {
    await sql`DELETE FROM member_with_friend WHERE user_id LIKE 'bx1-%'`
    // Sibling suites adopt users with `SELECT user_id FROM "user" LIMIT n` and may write against them
    // (see compat-quota-concurrency-db.test.ts) — clean the tables they write too, by prefix.
    await sql`DELETE FROM member_subscription WHERE user_id LIKE 'bx1-%'`
    await sql`DELETE FROM member_payment WHERE user_id LIKE 'bx1-%'`
    await sql`DELETE FROM "user" WHERE user_id LIKE 'bx1-%'`
    await sql.end()
  })
  beforeEach(async () => {
    pool.current = pool.one
    userId = newId()
    otherId = newId()
    await seedUser(userId)
    await seedUser(otherId)
    who.value = { ok: true, userId }
  })

  it('🔴 ① create writes the row the BE wrote — every column, defaults included — and returns it (max:1 pool)', async () => {
    const out = await createFriend({ ...form, userId, pictureUrl: 'https://x.supabase.co/storage/v1/object/public/mootech/mumate/profile/a.jpg', now: new Date('2026-09-27T03:04:05Z') })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const [row] = await sql`SELECT * FROM member_with_friend WHERE id = ${out.row.id}`
    expect(row).toMatchObject({
      user_id: userId,
      name: 'Mali',
      surname: '',
      picture_url: 'https://x.supabase.co/storage/v1/object/public/mootech/mumate/profile/a.jpg',
      create_at: '2026-09-27 10:04:05', // Asia/Bangkok, the BE's MomentService format
      update_at: '2026-09-27 10:04:05',
      dob: '1995-05-05',
      time: '07:30',
      is_remember_time: true,
      gender: 'FEMALE',
      place_name: '',
      is_member: false,
      member_id: '',
      is_notify: false,
    })
    // The answer IS the row, snake_case, same 15 keys.
    expect(out.row).toEqual({ ...row })
  })

  it('② a free user at 19 friends can add the 20th; at 20 the next is refused with the BE body, and nothing is written', async () => {
    await seedFriends(userId, 19)
    expect((await createFriend({ ...form, userId })).ok).toBe(true)
    expect(await friendCount(userId)).toBe(20)
    const refused = await createFriend({ ...form, userId })
    expect(refused).toEqual({ ok: false, reason: 'quota', body: { code: 404, message: 'เกิน Limit การใช้งาน', error: 'Error' } })
    expect(await friendCount(userId)).toBe(20)
  })

  it('③ a paid MEMBER (member_payment, not expired) is held to the same 20 — the BE limited members too', async () => {
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
              VALUES (${userId}, 'MEMBER', 'P1', ${stamp}, '2026-01-01', '2099-12-31')`
    await seedFriends(userId, 19)
    expect((await createFriend({ ...form, userId })).ok).toBe(true)
    const refused = await createFriend({ ...form, userId })
    expect(refused.ok).toBe(false)
    expect(await friendCount(userId)).toBe(20)
  })

  it('④ the count is per user: someone else at the ceiling does not block this user', async () => {
    await seedFriends(otherId, 20)
    expect((await createFriend({ ...form, userId })).ok).toBe(true)
  })

  it('🔴 ⑤ a burst of 12 adds from 15 lands EXACTLY 20 rows (10-connection pool, advisory lock + in-tx count)', async () => {
    pool.current = pool.ten
    await seedFriends(userId, 15)
    const outs = await Promise.all(Array.from({ length: 12 }, () => createFriend({ ...form, userId })))
    expect(outs.filter((o) => o.ok).length).toBe(5)
    expect(outs.filter((o) => !o.ok).length).toBe(7)
    expect(await friendCount(userId)).toBe(20)
  })

  it('🔴 ⑥ POST through the handler: the row belongs to the SESSION even when the body names someone else', async () => {
    const res = makeRes()
    await friendsHandler(
      { method: 'POST', body: { user_id: otherId, dob: '1995-05-05', time: '', is_remember_time: false, gender: 'MALE', name: 'Somchai', surname: '', picture_url: '' }, cookies: {}, headers: {} } as never,
      res as never,
    )
    expect(res.statusCode).toBe(200)
    expect(res.body.user_id).toBe(userId)
    expect(await friendCount(userId)).toBe(1)
    expect(await friendCount(otherId)).toBe(0)
    // and over the ceiling the handler answers 410 with the BE body
    await seedFriends(userId, 19)
    const res2 = makeRes()
    await friendsHandler({ method: 'POST', body: { dob: '1995-05-05', time: '' }, cookies: {}, headers: {} } as never, res2 as never)
    expect(res2.statusCode).toBe(410)
    expect(res2.body).toEqual({ code: 404, message: 'เกิน Limit การใช้งาน', error: 'Error' })
  })

  it('🔴 ⑦ update-profile changes the caller\'s own row; someone else\'s row is 404 and untouched', async () => {
    const mine = await createFriend({ ...form, userId })
    who.value = { ok: true, userId: otherId }
    const theirs = await createFriend({ ...form, userId: otherId, name: 'Theirs' })
    who.value = { ok: true, userId }
    if (!mine.ok || !theirs.ok) throw new Error('fixture')

    const res = makeRes()
    await profileHandler(
      { method: 'PUT', body: { friend_id: mine.row.id, dob: '2000-01-02', time: '', is_remember_time: false, gender: 'MALE', name: 'Renamed', surname: 'S' }, cookies: {}, headers: {} } as never,
      res as never,
    )
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ id: mine.row.id, name: 'Renamed', surname: 'S', dob: '2000-01-02', time: '', is_remember_time: false, gender: 'MALE', place_name: '' })
    expect(res.body.create_at).toBe(mine.row.create_at) // create_at is not touched

    const res2 = makeRes()
    await profileHandler(
      { method: 'PUT', body: { friend_id: theirs.row.id, dob: '2000-01-02', time: '', name: 'Hijacked' }, cookies: {}, headers: {} } as never,
      res2 as never,
    )
    expect(res2.statusCode).toBe(404)
    const [still] = await sql`SELECT name, dob FROM member_with_friend WHERE id = ${theirs.row.id}`
    expect(still).toEqual({ name: 'Theirs', dob: '1995-05-05' })
  })

  it('⑧ a field the request omits is left as it was (TypeORM save skipped undefined); an explicit null writes NULL', async () => {
    const mine = await createFriend({ ...form, userId, surname: 'Keep' })
    if (!mine.ok) throw new Error('fixture')
    const out = await updateFriendProfile({ userId, friendId: mine.row.id, name: null, dob: '2001-01-01' })
    expect(out.ok).toBe(true)
    const [row] = await sql`SELECT name, surname, dob, time, gender, is_remember_time FROM member_with_friend WHERE id = ${mine.row.id}`
    expect(row).toEqual({ name: null, surname: 'Keep', dob: '2001-01-01', time: '07:30', gender: 'FEMALE', is_remember_time: true })
  })
})
