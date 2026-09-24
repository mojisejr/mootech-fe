// Real-Postgres proof for provider linking (mumate-login-identity-001 slice 3).
// The default lane skips this file; run it against the local testenv database:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/link-account-db.test.ts
//
// WHY THIS FILE EXISTS. Everything else in slice 3 is proven against a fake
// store, which cannot tell us whether the SQL is even valid — whether those
// columns exist, whether the insert satisfies the table's NOT NULLs, whether the
// advisory-lock expression parses. None of that SQL had ever been executed before
// this file ran.
//
// WHAT IT PROVES THAT NOTHING ELSE DOES: the unique-violation recovery path runs
// against a REAL Postgres unique index on the real expression. That path — a
// 23505 caught by walking Drizzle's cause chain, then one re-read — is the code
// this workstream has flagged since 2026-09-24 as "the path that matters and has
// never executed against an index". Here it executes.
//
// §THE INDEX IS CREATED PARTIAL, AND THAT IS A REAL LIMIT. Production's index is
//   CREATE UNIQUE INDEX user_provider_identity_unique ON user_provider (lower(provider), id_token)
// over every row. The arena cannot carry that: testenv/scripts/anonymize.sql sets
// id_token = '' on all 5,872 rows, so the full index cannot build — the same
// obstacle that made PLAN.md's original DoD 2 unachievable. So this file builds
// the SAME EXPRESSION restricted to its own rows and drops it afterwards. That is
// enough to make Postgres raise a genuine 23505 through the genuine driver and
// Drizzle wrapper, which is what the recovery path needs to be exercised. It is
// NOT evidence about production's index over production's data.
//
// §ALSO NOT PROVEN: this is a direct connection. Production reaches Supabase
// through the transaction pooler.
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { linkProvider, unlinkProvider, type LinkStore } from '@/lib/auth/link-account'
import { createPostgresLinkStore } from '@/lib/auth/link-account-store'

const TEST_URL = process.env.TEST_DATABASE_URL
const PREFIX = 'slice3-proof-'
// THE NAME MATTERS, AND THE FIRST VERSION OF THIS FILE GOT IT WRONG.
// isProviderIdentityConflict treats a 23505 as recoverable only when the
// constraint name is empty or CONTAINS 'user_provider_identity'. Built under any
// other name the index still rejects the duplicate, but the recovery does not
// fire and the member receives a 500 — which is precisely what this file produced
// until the name was matched to production's. Two things follow: the test index
// must carry production's name to be evidence at all, and RENAMING THE PRODUCTION
// INDEX WOULD SILENTLY DISABLE THE RECOVERY. Nothing else in the tree says that.
const INDEX = 'user_provider_identity_unique'

describe.skipIf(!TEST_URL)('provider linking against real Postgres', () => {
  const client = postgres(TEST_URL as string, { prepare: false, max: 12 })
  const database = drizzle(client)
  const store = createPostgresLinkStore(database as never)

  // Same store with the advisory lock removed. Nothing under lib/ is modified to
  // run the control — the lock is dropped by wrapping the transaction.
  const unlockedStore: LinkStore = {
    transaction: (work) => store.transaction((tx) => work({ ...tx, lockIdentity: async () => {} })),
  }

  const members: string[] = []
  const subjects: string[] = []

  async function makeMember(): Promise<string> {
    const id = randomUUID()
    members.push(id)
    // Every NOT NULL column without a default has to be named. The live schema
    // demands more than the obvious ones — login_at, dob, time, result_code,
    // place_name, share_img_profile_url — which a fake store could never have
    // told us, and is a good part of why this file exists.
    const t = '2026-09-24 00:00:00'
    await client`
      INSERT INTO "user" (user_id, name, email, picture_url, refer_code,
                          create_at, update_at, login_at, dob, "time",
                          result_code, place_name, share_img_profile_url)
      VALUES (${id}, ${'slice3 proof'}, ${''}, ${''}, ${''},
              ${t}, ${t}, ${t}, ${''}, ${''},
              ${''}, ${''}, ${''})
    `
    return id
  }

  function subject(): string {
    const s = `${PREFIX}${randomUUID()}`
    subjects.push(s)
    return s
  }

  beforeAll(async () => {
    // The real expression, restricted to this file's rows so the arena's blanked
    // id_token values cannot collide with each other.
    await client.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX}
        ON user_provider (lower(provider), id_token)
        WHERE id_token LIKE '${PREFIX}%'
    `)
  })

  afterAll(async () => {
    if (subjects.length) await client`DELETE FROM user_provider WHERE id_token = ANY(${subjects})`
    if (members.length) {
      await client`DELETE FROM user_provider WHERE user_id = ANY(${members})`
      await client`DELETE FROM "user" WHERE user_id = ANY(${members})`
    }
    await client.unsafe(`DROP INDEX IF EXISTS ${INDEX}`)
    await client.end()
  })

  it('the SQL is valid and a link writes exactly one row with the legacy shapes', async () => {
    const user = await makeMember()
    const sub = subject()

    const r = await linkProvider(store, {
      userId: user,
      provider: 'line',
      subject: sub,
      name: 'ชื่อทดสอบ',
    })
    expect(r.status).toBe('linked')

    const rows = await client`
      SELECT provider, id_token, email, name, picture_url, create_at, update_at
      FROM user_provider WHERE user_id = ${user}
    `
    expect(rows).toHaveLength(1)
    expect(rows[0].provider).toBe('LINE') // stored upper-case, as the live writers do
    expect(rows[0].id_token).toBe(sub)
    expect(rows[0].email).toBe('') // never NULL — a null reaches a cookie as "null"
    expect(rows[0].picture_url).toBe('')
    // 'YYYY-MM-DD HH:mm:ss', not an ISO string: these columns are varchar and every
    // other row in the table sorts on this shape.
    expect(String(rows[0].create_at)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('google is stored lower-case', async () => {
    const user = await makeMember()
    await linkProvider(store, { userId: user, provider: 'google', subject: subject() })
    const rows = await client`SELECT provider FROM user_provider WHERE user_id = ${user}`
    expect(rows[0].provider).toBe('google')
  })

  it('a second member cannot take an identity that already belongs to someone', async () => {
    const owner = await makeMember()
    const other = await makeMember()
    const sub = subject()

    await linkProvider(store, { userId: owner, provider: 'line', subject: sub })
    const second = await linkProvider(store, { userId: other, provider: 'line', subject: sub })

    expect(second.status).toBe('owned-by-another')
    const rows = await client`SELECT user_id FROM user_provider WHERE id_token = ${sub}`
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe(owner)
  })

  it('THE UNIQUE-VIOLATION RECOVERY RUNS AGAINST A REAL INDEX', async () => {
    // With the lock removed, two members racing for one identity reach the insert
    // together; Postgres rejects the loser with 23505, Drizzle wraps it so the
    // top-level `code` is undefined, and the recovery has to walk the cause chain
    // and re-read. This is that path, executing.
    const a = await makeMember()
    const b = await makeMember()
    const sub = subject()

    const results = await Promise.all([
      linkProvider(unlockedStore, { userId: a, provider: 'line', subject: sub }),
      linkProvider(unlockedStore, { userId: b, provider: 'line', subject: sub }),
    ])

    const statuses = results.map((r) => r.status).sort()
    // Either the two serialised cleanly (linked + owned-by-another) or they
    // genuinely collided and the loser recovered into the same answer. Both are
    // correct; what must never happen is two rows or a thrown 500.
    expect(statuses).toEqual(['linked', 'owned-by-another'])

    const rows = await client`SELECT user_id FROM user_provider WHERE id_token = ${sub}`
    expect(rows).toHaveLength(1)
  })

  it('THE RECOVERY IS FORCED, not hoped for — a stale read must end in 23505 and re-read', async () => {
    // The racing test above can pass without the recovery ever firing: two callers
    // often simply do not interleave, and then it proves only that nothing broke.
    // That is the exact shape of proof this workstream has rejected five times.
    // So this one makes the collision DETERMINISTIC: a store whose first read lies
    // that the identity is free. The insert then MUST hit the real index, raise a
    // real 23505 through the real Drizzle wrapper, and the recovery MUST re-read
    // and report the truth. If the recovery is removed, this test throws.
    const owner = await makeMember()
    const late = await makeMember()
    const sub = subject()
    await linkProvider(store, { userId: owner, provider: 'line', subject: sub })

    let reads = 0
    const staleFirstRead: LinkStore = {
      transaction: (work) =>
        store.transaction((tx) =>
          work({
            ...tx,
            findIdentityOwner: async (provider, subject_) => {
              reads += 1
              return reads === 1 ? null : tx.findIdentityOwner(provider, subject_)
            },
          }),
        ),
    }

    const r = await linkProvider(staleFirstRead, { userId: late, provider: 'line', subject: sub })

    expect(r.status).toBe('owned-by-another')
    expect(reads).toBeGreaterThanOrEqual(2) // the retry really happened
    const rows = await client`SELECT user_id FROM user_provider WHERE id_token = ${sub}`
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe(owner)
  })

  it('the index really is enforcing — a raw duplicate insert is rejected', async () => {
    // Negative control for the test above: without this, "one row" could simply
    // mean the two calls never interleaved and the index was never consulted.
    const user = await makeMember()
    const sub = subject()
    await linkProvider(store, { userId: user, provider: 'line', subject: sub })

    await expect(
      client`
        INSERT INTO user_provider (id, user_id, provider, id_token, email, name, picture_url, create_at, update_at)
        VALUES (${randomUUID()}, ${user}, ${'line'}, ${sub}, ${''}, ${''}, ${''}, ${'2026-09-24 00:00:00'}, ${'2026-09-24 00:00:00'})
      `,
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('eight concurrent links of one identity leave exactly one row', async () => {
    const sub = subject()
    const users = await Promise.all(Array.from({ length: 8 }, () => makeMember()))

    const results = await Promise.all(
      users.map((u) => linkProvider(store, { userId: u, provider: 'google', subject: sub })),
    )

    expect(results.filter((r) => r.status === 'linked')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'owned-by-another')).toHaveLength(7)
    const rows = await client`SELECT user_id FROM user_provider WHERE id_token = ${sub}`
    expect(rows).toHaveLength(1)
  })

  it('linking twice is idempotent and writes no second row', async () => {
    const user = await makeMember()
    const sub = subject()
    await linkProvider(store, { userId: user, provider: 'google', subject: sub })
    const again = await linkProvider(store, { userId: user, provider: 'google', subject: sub })
    expect(again.status).toBe('already-linked')
    const rows = await client`SELECT id FROM user_provider WHERE id_token = ${sub}`
    expect(rows).toHaveLength(1)
  })

  it('unlink removes only the named provider, and only for that member', async () => {
    const mine = await makeMember()
    const theirs = await makeMember()
    const mySub = subject()
    const theirSub = subject()

    await linkProvider(store, { userId: mine, provider: 'line', subject: subject() })
    await linkProvider(store, { userId: mine, provider: 'google', subject: mySub })
    await linkProvider(store, { userId: theirs, provider: 'google', subject: theirSub })

    const r = await unlinkProvider(store, { userId: mine, provider: 'google' })
    expect(r).toMatchObject({ status: 'unlinked', removed: 1 })

    const left = await client`SELECT provider FROM user_provider WHERE user_id = ${mine}`
    expect(left.map((x) => x.provider)).toEqual(['LINE'])
    const untouched = await client`SELECT id FROM user_provider WHERE user_id = ${theirs}`
    expect(untouched).toHaveLength(1)
  })

  it('unlink REFUSES the last method and the row survives', async () => {
    const user = await makeMember()
    await linkProvider(store, { userId: user, provider: 'line', subject: subject() })

    const r = await unlinkProvider(store, { userId: user, provider: 'line' })
    expect(r).toEqual({ status: 'last-method' })

    const rows = await client`SELECT id FROM user_provider WHERE user_id = ${user}`
    expect(rows).toHaveLength(1)
  })

  it('a member whose row was deleted cannot acquire a credential', async () => {
    const ghost = randomUUID()
    const r = await linkProvider(store, { userId: ghost, provider: 'line', subject: subject() })
    expect(r.status).toBe('member-missing')
    const rows = await client`SELECT id FROM user_provider WHERE user_id = ${ghost}`
    expect(rows).toHaveLength(0)
  })

  it('leaves the arena as it found it', async () => {
    const stray = await client`SELECT count(*)::int AS n FROM user_provider WHERE id_token LIKE ${PREFIX + '%'} AND id_token <> ALL(${subjects})`
    expect(stray[0].n).toBe(0)
  })
})
