// #383 — DB half: the /api/user `membership` composite against a REAL postgres. `describe.skipIf` like
// member-subscription-db.test.ts / push-concurrency.test.ts, so it does NOT run in the pre-push lane.
//
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/user-membership-db.test.ts --no-file-parallelism
//
// WHY this exists on top of the mocked route spec: that one injects the rows, so it proves the COMPOSITION
// and is blind to the SQL. A select that narrows on the wrong column, or a row shape toSubRows mis-maps
// (expire_at is a DATE, created_at a TIMESTAMP — both arrive as objects, not the strings the picker
// compares), stays green there and breaks in production. This file runs the real handler over real rows.
//
// 🔴 SAFETY — unlike the #354 suite, this one does NOT drop/recreate anything. It only INSERTs rows it
// owns (id prefixed `t383-`) and deletes exactly those in afterEach, inside a finally, so a failing
// assertion cannot leak a paid subscription into the next suite's view of the table (that leak class cost
// two red suites on 08-22). Existing member_payment / user rows are READ ONLY.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import postgres from 'postgres'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/user'

const TEST_URL = process.env.TEST_DATABASE_URL
const ID_PREFIX = 't383-'

function bkkToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function callUser(userId: string) {
  const req = { method: 'GET', query: { user_id: userId } } as unknown as NextApiRequest
  const out: { code?: number; body?: any } = {}
  const res = {
    status(code: number) {
      out.code = code
      return this
    },
    json(body: unknown) {
      out.body = body
      return this
    },
  } as unknown as NextApiResponse
  await handler(req, res)
  return out
}

describe.skipIf(!TEST_URL)('#383 /api/user membership · real pg', () => {
  let sql: ReturnType<typeof postgres>
  let liveMember: string // real member_payment MEMBER row, not expired, and present in "user"
  let freeUser: string // real "user" row with NO member_payment row

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 4, ssl: false })
    const today = bkkToday()
    const [m] = await sql`SELECT mp.user_id FROM member_payment mp
      JOIN "user" usr ON usr.user_id = mp.user_id
      WHERE mp.plan_code = 'MEMBER' AND mp.expire_at >= ${today} LIMIT 1`
    liveMember = m?.user_id
    const [f] = await sql`SELECT u.user_id FROM "user" u
      LEFT JOIN member_payment mp ON mp.user_id = u.user_id
      WHERE mp.user_id IS NULL LIMIT 1`
    freeUser = f?.user_id
    // A fixture the suite cannot fake its way past: without these two the assertions below would pass
    // vacuously against nobody.
    expect(liveMember, 'no live MEMBER row in the test DB — fixture missing, not a pass').toBeTruthy()
    expect(freeUser, 'no member_payment-free user in the test DB — fixture missing').toBeTruthy()
  })

  afterEach(async () => {
    try {
      await sql`DELETE FROM member_subscription WHERE id LIKE ${ID_PREFIX + '%'}`
    } finally {
      // nothing else to unwind — the suite never mutates anything it did not insert
    }
  })

  afterAll(async () => {
    await sql?.end({ timeout: 5 })
  })

  // ① The state EVERY paying member is in on the day this ships: a real, anonymized member_payment row and
  // no v2 row anywhere. If the snake_case→camelCase mapping in the route were wrong, this reads free.
  it('🔴 ① a REAL live member (member_payment only) → isPaid true · tier null · source "legacy"', async () => {
    const { code, body } = await callUser(liveMember)
    expect(code).toBe(200)
    expect(body.membership).toEqual({ isPaid: true, tier: null, source: 'legacy' })
    expect(body.payment.is_not_expired).toBe(true)
  })

  // ② The real column shapes: expire_at DATE and created_at TIMESTAMP come back as objects from postgres,
  // and the picker compares 'YYYY-MM-DD' strings. A mis-map here is invisible to the mocked spec.
  it('② a live v2 row for that same member → tier "PRO" · source "v2"', async () => {
    await sql`INSERT INTO member_subscription (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status)
      VALUES (${ID_PREFIX + 'pro'}, ${liveMember}, 'PRO', 'V2_PRO_YEARLY', 159000, ${bkkToday()}, ${'2099-12-31'}, 'ACTIVE')`
    const { body } = await callUser(liveMember)
    expect(body.membership).toEqual({ isPaid: true, tier: 'PRO', source: 'v2' })
  })

  // ③ Expiry is decided at READ time (no cron flips status), so a row that ended yesterday must not be
  // selectable — and the member must land on their legacy verdict, NEVER on free.
  it('🔴 ③ an EXPIRED v2 row → falls back to legacy (isPaid stays true), never to free', async () => {
    await sql`INSERT INTO member_subscription (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status)
      VALUES (${ID_PREFIX + 'old'}, ${liveMember}, 'PRO', 'V2_PRO_YEARLY', 159000, ${'2020-01-01'}, ${'2020-12-31'}, 'ACTIVE')`
    const { body } = await callUser(liveMember)
    expect(body.membership).toEqual({ isPaid: true, tier: null, source: 'legacy' })
  })

  // ④ afterEach really did unwind ② and ③ — otherwise every later assertion here (and in any suite that
  // reads this table afterwards) would be measuring my leftovers.
  it('④ the fixture rows are gone between tests (no leak into the next suite)', async () => {
    const rows = await sql`SELECT id FROM member_subscription WHERE id LIKE ${ID_PREFIX + '%'}`
    expect(rows.length).toBe(0)
    const { body } = await callUser(liveMember)
    expect(body.membership.source).toBe('legacy')
  })

  it('⑤ a real user with no payment row at all → isPaid false · tier null · source "none"', async () => {
    const { body } = await callUser(freeUser)
    expect(body.membership).toEqual({ isPaid: false, tier: null, source: 'none' })
    expect(body.payment.is_not_expired).toBe(false)
  })
})
