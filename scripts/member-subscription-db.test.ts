// #354 — DB half: proves the v2 membership seam against a REAL postgres. Like push-concurrency.test.ts it
// is `describe.skipIf(!TEST_DATABASE_URL)` and does NOT run in the pre-push lane; run it against the testenv
// pg (which carries the 24 anonymized member_payment rows) for the PR proof:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/member-subscription-db.test.ts
//
// resolveSubscription reads the app singleton @/lib/db (DATABASE_URL); this file also opens a raw client on
// TEST_DATABASE_URL for DDL/seed/cleanup. Both point at the SAME testenv DB. It only ever WRITES the new
// member_subscription table (dropped+recreated in beforeAll, cleaned per test) and READS member_payment/user
// — never mutates existing data. Seeded rows use REAL user_ids/payment (member_subscription now has FKs).
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { resolveSubscription } from '@/lib/v2/subscription'
import { resolveMembership } from '@/lib/usage'

const TEST_URL = process.env.TEST_DATABASE_URL
const MIGRATION = readFileSync(resolve('lib/db/0006_member_subscription.sql'), 'utf8')
// #355 added member_subscription.v2_payment_id via 0007's ALTER; the drizzle schema (and so
// resolveSubscription's select) now includes it, so the table must be set up with 0007 too or the read
// fails on a missing column. Apply both.
const MIGRATION7 = readFileSync(resolve('lib/db/0007_v2_payment.sql'), 'utf8')
// #361's 0008 ALTERs v2_payment (code_id/discount_satang/quote_id) and those columns are in the drizzle
// schema, so every suite that rebuilds v2_payment must apply 0008 too — otherwise the NEXT suite's reads
// fail on a missing column (this bit the payment suite once already).
const MIGRATION8 = readFileSync(resolve('lib/db/0008_discount_code.sql'), 'utf8')
// #437's 0010 ALTERs v2_payment (failure_code/failure_message) and those columns are in the drizzle schema,
// so every suite that rebuilds v2_payment must apply 0010 too — same trap as 0008 above, one migration on.
const MIGRATION10 = readFileSync(resolve('lib/db/0010_v2_payment_failure.sql'), 'utf8')
const NOW = new Date()

function bkk(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

describe.skipIf(!TEST_URL)('member_subscription · real pg (#354)', () => {
  let sql: ReturnType<typeof postgres>
  let liveMember: string // a real MEMBER user_id that also exists in "user" (FK-safe)
  let u: string[] // generic real user_ids from "user" for FK-safe seeding

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 4, ssl: false })
    // Recreate the CURRENT schema so CHECK/FK and #355's v2_payment_id column are all present (IF NOT
    // EXISTS never reconciles an older shape). Drop both tables, then 0006 then 0007. Safe: these are our
    // own feature tables with no other data.
    await sql.unsafe('DROP TABLE IF EXISTS member_subscription CASCADE;')
    await sql.unsafe('DROP TABLE IF EXISTS v2_payment CASCADE;')
    await sql.unsafe(MIGRATION)
    await sql.unsafe(MIGRATION7)
    await sql.unsafe(MIGRATION8)
    await sql.unsafe(MIGRATION10) // #437 — failure_code/failure_message
    const today = bkk(NOW)
    const [m] = await sql`SELECT mp.user_id FROM member_payment mp
      JOIN "user" usr ON usr.user_id = mp.user_id
      WHERE mp.plan_code = 'MEMBER' AND mp.expire_at >= ${today} LIMIT 1`
    liveMember = m.user_id
    const gens = await sql`SELECT user_id FROM "user" LIMIT 4`
    u = gens.map((r) => r.user_id as string)
  })

  afterAll(async () => {
    if (sql) {
      await sql.unsafe('DELETE FROM member_subscription;')
      await sql.end()
    }
  })

  afterEach(async () => {
    await sql.unsafe('DELETE FROM member_subscription;')
  })

  const seed = (r: {
    id: string
    userId: string
    tier: string
    status?: string
    startAt?: string
    expireAt: string
    createdAt?: string
  }) =>
    sql`INSERT INTO member_subscription
      (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, payment_id, status, created_at)
      VALUES (${r.id}, ${r.userId}, ${r.tier}, ${'PKG'}, ${79000},
        ${r.startAt ?? '2026-01-01'}, ${r.expireAt}, ${null}, ${r.status ?? 'ACTIVE'},
        ${r.createdAt ?? '2026-08-01T00:00:00.000Z'})`

  it('migration is idempotent — applying 0006 a SECOND time does not throw', async () => {
    await expect(sql.unsafe(MIGRATION)).resolves.toBeDefined()
    const [{ exists }] = await sql`SELECT to_regclass('public.member_subscription') IS NOT NULL AS exists`
    expect(exists).toBe(true)
  })

  it('B1/T1 — the DB REFUSES an unknown tier_code and an unknown status (CHECK constraints)', async () => {
    await expect(seed({ id: 'test-354-bad', userId: liveMember, tier: 'GOLD', expireAt: '2027-12-31' }))
      .rejects.toThrow(/check|tier_code/i)
    await expect(
      seed({ id: 'test-354-bad2', userId: liveMember, tier: 'PLUS', status: 'LIVE', expireAt: '2027-12-31' }),
    ).rejects.toThrow(/check|status/i)
  })

  it('T1 — the DB REFUSES a user_id with no matching user row (foreign key)', async () => {
    await expect(
      seed({ id: 'test-354-fk', userId: 'no-such-user-xyz', tier: 'PLUS', expireAt: '2027-12-31' }),
    ).rejects.toThrow(/foreign key|violates/i)
  })

  it('the 24 existing member_payment users read EXACTLY as before (no v2 rows, no data moved)', async () => {
    const users = await sql`SELECT user_id FROM member_payment`
    expect(users.length).toBe(24)
    for (const { user_id } of users) {
      const legacy = await resolveMembership(user_id, NOW)
      const resolved = await resolveSubscription(user_id, NOW)
      expect(resolved.isPaid).toBe(!legacy.isFree)
      expect(resolved.tier).toBeNull()
      expect(resolved.source).toBe(legacy.isFree ? (legacy.reason === 'EXPIRED' ? 'legacy' : 'none') : 'legacy')
    }
  })

  it('3 read cases: v2 row → tier from v2 · legacy only → paid · neither → free', async () => {
    await seed({ id: 'test-354-a', userId: u[0], tier: 'PRO', expireAt: '2027-12-31' })
    expect(await resolveSubscription(u[0], NOW)).toEqual({ isPaid: true, tier: 'PRO', source: 'v2' })

    const legacyResolved = await resolveSubscription(liveMember, NOW)
    expect(legacyResolved).toEqual({ isPaid: true, tier: null, source: 'legacy' })

    // a user_id with no v2 row and no member_payment row → free (a READ needs no FK)
    expect(await resolveSubscription('nobody-354', NOW)).toEqual({ isPaid: false, tier: null, source: 'none' })
  })

  it('B2 — the picker (not SQL) applies the whole filter: past-expire + REPLACED siblings are ignored', async () => {
    await seed({ id: 'test-354-old', userId: u[1], tier: 'PRO', expireAt: '2026-08-01' }) // past-expire
    await seed({ id: 'test-354-repl', userId: u[1], tier: 'PRO', status: 'REPLACED', expireAt: '2099-01-01' })
    await seed({ id: 'test-354-live', userId: u[1], tier: 'PLUS', expireAt: '2027-01-01' }) // the live one
    expect(await resolveSubscription(u[1], NOW)).toEqual({ isPaid: true, tier: 'PLUS', source: 'v2' })
  })

  it('🔴 deterministic pick: 3 ACTIVE rows, identical expire_at+created_at → SAME tier on 10 reads', async () => {
    const same = { userId: u[2], expireAt: '2027-06-30', createdAt: '2026-08-15T00:00:00.000Z' }
    await seed({ ...same, id: 'test-354-d1', tier: 'FREE' })
    await seed({ ...same, id: 'test-354-d3', tier: 'PRO' })
    await seed({ ...same, id: 'test-354-d2', tier: 'PLUS' })
    const reads = []
    for (let i = 0; i < 10; i++) reads.push((await resolveSubscription(u[2], NOW)).tier)
    expect(new Set(reads).size).toBe(1)
    expect(reads[0]).toBe('PRO') // id 'test-354-d3' wins the DESC id tiebreak
  })

  it('🔴 TEETH — delete the v2 row and a member falls back to member_payment, NOT to free', async () => {
    await seed({ id: 'sub-354-teeth', userId: liveMember, tier: 'PLUS', expireAt: '2027-12-31' })
    expect(await resolveSubscription(liveMember, NOW)).toEqual({ isPaid: true, tier: 'PLUS', source: 'v2' })
    await sql`DELETE FROM member_subscription WHERE id = ${'sub-354-teeth'}`
    expect(await resolveSubscription(liveMember, NOW)).toEqual({ isPaid: true, tier: null, source: 'legacy' })
  })
})
