// #354 — DB half: proves the v2 membership seam against a REAL postgres. Like push-concurrency.test.ts it
// is `describe.skipIf(!TEST_DATABASE_URL)` and does NOT run in the pre-push lane; run it against the testenv
// pg (which carries the 24 anonymized member_payment rows) for the PR proof:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/member-subscription-db.test.ts
//
// resolveSubscription reads the app singleton @/lib/db (DATABASE_URL); this file also opens a raw client on
// TEST_DATABASE_URL for DDL/seed/cleanup. Both point at the SAME testenv DB. It only ever WRITES the new
// member_subscription table (cleaned each test) and READS member_payment — never mutates existing data.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { resolveSubscription } from '@/lib/v2/subscription'
import { resolveMembership } from '@/lib/usage'

const TEST_URL = process.env.TEST_DATABASE_URL
const MIGRATION = readFileSync(resolve('lib/db/0006_member_subscription.sql'), 'utf8')
const NOW = new Date()

describe.skipIf(!TEST_URL)('member_subscription · real pg (#354)', () => {
  let sql: ReturnType<typeof postgres>

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 4, ssl: false })
    await sql.unsafe(MIGRATION) // apply once so the table exists for all tests
  })

  afterAll(async () => {
    if (sql) {
      await sql.unsafe('DELETE FROM member_subscription;')
      await sql.end()
    }
  })

  afterEach(async () => {
    await sql.unsafe("DELETE FROM member_subscription WHERE user_id LIKE 'test-354-%' OR user_id LIKE 'realseed-%';")
    // rows seeded onto a real member_payment user are tagged in id so they can be removed without a scan:
    await sql.unsafe("DELETE FROM member_subscription WHERE id LIKE 'sub-354-%';")
  })

  const seed = (r: {
    id: string
    userId: string
    tier: string
    status?: string
    startAt?: string
    expireAt: string
    createdAt?: string
    amountSatang?: number
  }) =>
    sql`INSERT INTO member_subscription
      (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, payment_id, status, created_at)
      VALUES (${r.id}, ${r.userId}, ${r.tier}, ${'PKG'}, ${r.amountSatang ?? 79000},
        ${r.startAt ?? '2026-01-01'}, ${r.expireAt}, ${null}, ${r.status ?? 'ACTIVE'},
        ${r.createdAt ?? '2026-08-01T00:00:00.000Z'})`

  it('migration is idempotent — applying 0006 a SECOND time does not throw', async () => {
    await expect(sql.unsafe(MIGRATION)).resolves.toBeDefined()
    // and the table + index are really there
    const [{ exists }] = await sql`SELECT to_regclass('public.member_subscription') IS NOT NULL AS exists`
    expect(exists).toBe(true)
  })

  it('the 24 existing member_payment users read EXACTLY as before (no v2 rows, no data moved)', async () => {
    const users = await sql`SELECT user_id FROM member_payment`
    expect(users.length).toBe(24)
    for (const { user_id } of users) {
      const legacy = await resolveMembership(user_id, NOW)
      const resolved = await resolveSubscription(user_id, NOW)
      // parity: paid iff the v1 classifier says member; the source is the legacy store, never v2/none-by-mistake
      expect(resolved.isPaid).toBe(!legacy.isFree)
      expect(resolved.tier).toBeNull()
      expect(resolved.source).toBe(legacy.isFree ? (legacy.reason === 'EXPIRED' ? 'legacy' : 'none') : 'legacy')
    }
  })

  it('3 read cases: v2 row → tier from v2 · legacy only → paid · neither → free', async () => {
    // ① has a v2 row
    await seed({ id: 'test-354-a', userId: 'test-354-v2', tier: 'PRO', expireAt: '2027-12-31' })
    expect(await resolveSubscription('test-354-v2', NOW)).toEqual({ isPaid: true, tier: 'PRO', source: 'v2' })

    // ② a REAL member_payment MEMBER user, no v2 row → legacy paid (tier unnamed)
    const [member] = await sql`SELECT user_id FROM member_payment
      WHERE plan_code = 'MEMBER' AND expire_at >= ${bkk(NOW)} LIMIT 1`
    const legacyResolved = await resolveSubscription(member.user_id, NOW)
    expect(legacyResolved).toEqual({ isPaid: true, tier: null, source: 'legacy' })

    // ③ nobody — no v2 row, no member_payment row → free
    expect(await resolveSubscription('test-354-none', NOW)).toEqual({ isPaid: false, tier: null, source: 'none' })
  })

  it('🔴 deterministic pick: 3 ACTIVE rows, identical expire_at+created_at → SAME tier on 10 reads', async () => {
    const same = { userId: 'test-354-det', expireAt: '2027-06-30', createdAt: '2026-08-15T00:00:00.000Z' }
    await seed({ ...same, id: 'test-354-d1', tier: 'FREE' })
    await seed({ ...same, id: 'test-354-d3', tier: 'PRO' })
    await seed({ ...same, id: 'test-354-d2', tier: 'PLUS' })
    const reads = []
    for (let i = 0; i < 10; i++) reads.push((await resolveSubscription('test-354-det', NOW)).tier)
    expect(new Set(reads).size).toBe(1) // one answer, every time
    expect(reads[0]).toBe('PRO') // id 'test-354-d3' wins the DESC id tiebreak
  })

  it('🔴 TEETH — delete the v2 row and a member falls back to member_payment, NOT to free', async () => {
    const [member] = await sql`SELECT user_id FROM member_payment
      WHERE plan_code = 'MEMBER' AND expire_at >= ${bkk(NOW)} LIMIT 1`
    await seed({ id: 'sub-354-teeth', userId: member.user_id, tier: 'PLUS', expireAt: '2027-12-31' })
    // with the v2 row → v2 tier
    expect(await resolveSubscription(member.user_id, NOW)).toEqual({ isPaid: true, tier: 'PLUS', source: 'v2' })
    // remove it → still a paying member via the legacy store (would be a regression if this went free)
    await sql`DELETE FROM member_subscription WHERE id = ${'sub-354-teeth'}`
    expect(await resolveSubscription(member.user_id, NOW)).toEqual({ isPaid: true, tier: null, source: 'legacy' })
  })
})

// civil YYYY-MM-DD in Asia/Bangkok — matches lib/usage-core.bkkDateStr, inlined so the query filter agrees.
function bkk(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
