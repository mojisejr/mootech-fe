// #354 — DB half: proves the v2 membership seam against a REAL postgres. Like push-concurrency.test.ts it
// is `describe.skipIf(!TEST_DATABASE_URL)` and does NOT run in the pre-push lane; run it against the testenv
// pg (which carries the anonymized member_payment rows) for the PR proof:
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
// 🔴 0011 and 0012 are ALTERs on v2_payment too, and 0011 was already missing here before #484: the
// drizzle schema has carried charge_expires_at since #455, so every schema-wide select in this suite has
// been asking for a column this fixture never created. It stayed invisible because these suites are
// skipIf(!TEST_DATABASE_URL) and the pre-push lane does not run them. An ALTER that lands in schema.ts
// has to land in every hand-built fixture, and nothing enforces that — running them is the only check.
const MIGRATION11 = readFileSync(resolve('lib/db/0011_v2_payment_qr_expiry.sql'), 'utf8')
const MIGRATION12 = readFileSync(resolve('lib/db/0012_v2_payment_prev_member_expire.sql'), 'utf8')
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
  let liveMemberExpireAt: string // #358 — that row's member_payment.expire_at, as 'YYYY-MM-DD'
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
    await sql.unsafe(MIGRATION11)
    await sql.unsafe(MIGRATION12)
    const today = bkk(NOW)
    const [m] = await sql`SELECT mp.user_id, mp.expire_at FROM member_payment mp
      JOIN "user" usr ON usr.user_id = mp.user_id
      WHERE mp.plan_code = 'MEMBER' AND mp.expire_at >= ${today} LIMIT 1`
    liveMember = m.user_id
    // #358 Phase 1 — read the expected date off the FIXTURE, never hard-code it: these rows are the real
    // anonymized member_payment data and their dates differ per dump.
    liveMemberExpireAt = String(m.expire_at).slice(0, 10)
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

  // ⚠️ The title used to be "reads EXACTLY as before". #358 Phase 1 broke that half: a VALID legacy member
  // now reads tier 'PRO' + their own expire_at (lib/v2/subscription.ts:26), which is what the loop asserts.
  // The paid/not-paid verdict and the source ARE still exactly as before, and no data moved.
  it('every existing member_payment user keeps the SAME paid verdict and source — and a valid one now also reads tier PRO with their own expiry (no data moved)', async () => {
    const users = await sql`SELECT user_id FROM member_payment`
    // 🔴 #442 — this used to read `toBe(24)`, a snapshot of however many rows the dump happened to carry
    // the day #354 was written. The number MOVES on its own: settling a v2 payment writes a shadow
    // member_payment row, so every payment test run on testenv bumps it (it reached 25 and went red on
    // `main` itself, which is worse than useless — the next person cannot tell whether they broke it).
    // The count never guarded anything; the LOOP below is the whole point of this test.
    //
    // 🔴 WHY NOT DROP THE ASSERTION ENTIRELY. With an empty table the loop runs zero times and this test
    // goes green having proven nothing — a pass that survives the disappearance of the thing it checks.
    // Reading the floor off the database keeps the test tied to behaviour instead of to a snapshot.
    expect(users.length).toBeGreaterThan(0)
    for (const { user_id } of users) {
      const legacy = await resolveMembership(user_id, NOW)
      const resolved = await resolveSubscription(user_id, NOW)
      expect(resolved.isPaid).toBe(!legacy.isFree)
      // #358 Phase 1 — a VALID legacy member is PRO; everyone else still has no tier.
      expect(resolved.tier).toBe(legacy.isFree ? null : 'PRO')
      expect(resolved.source).toBe(legacy.isFree ? (legacy.reason === 'EXPIRED' ? 'legacy' : 'none') : 'legacy')
      // and only a PAID legacy verdict reports a date (an expired row decided "not paid" → no date)
      if (!legacy.isFree) {
        expect(resolved.expireAt).toBe(String(legacy.memberPayment?.expireAt).slice(0, 10))
      } else {
        expect(resolved.expireAt).toBeNull()
      }
    }
  })

  it('3 read cases: v2 row → tier from v2 · legacy only → paid · neither → free', async () => {
    await seed({ id: 'test-354-a', userId: u[0], tier: 'PRO', expireAt: '2027-12-31' })
    // #365 — the DATE comes back too, and it is the seeded row's, straight from postgres.
    expect(await resolveSubscription(u[0], NOW)).toEqual({ isPaid: true, tier: 'PRO', source: 'v2', expireAt: '2027-12-31' })

    const legacyResolved = await resolveSubscription(liveMember, NOW)
    // #358 Phase 1 — PRO, and the date IS this member's member_payment.expire_at (read from the fixture).
    expect(legacyResolved).toEqual({ isPaid: true, tier: 'PRO', source: 'legacy', expireAt: liveMemberExpireAt })

    // a user_id with no v2 row and no member_payment row → free (a READ needs no FK)
    expect(await resolveSubscription('nobody-354', NOW)).toEqual({ isPaid: false, tier: null, source: 'none', expireAt: null })
  })

  it('B2 — the picker (not SQL) applies the whole filter: past-expire + REPLACED siblings are ignored', async () => {
    await seed({ id: 'test-354-old', userId: u[1], tier: 'PRO', expireAt: '2026-08-01' }) // past-expire
    await seed({ id: 'test-354-repl', userId: u[1], tier: 'PRO', status: 'REPLACED', expireAt: '2099-01-01' })
    await seed({ id: 'test-354-live', userId: u[1], tier: 'PLUS', expireAt: '2027-01-01' }) // the live one
    // #365 — and the date follows the row the picker chose, NOT the REPLACED sibling's 2099-01-01, which is
    // the furthest date in the table. A picker that ordered by expire_at before filtering would say 2099.
    expect(await resolveSubscription(u[1], NOW)).toEqual({ isPaid: true, tier: 'PLUS', source: 'v2', expireAt: '2027-01-01' })
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

  // ── #365 · THE TWO-ROW PROBE the ticket asks for, against real postgres ────────────────────────────
  //
  // 🔑 WHY TWO ROWS AND NOT ONE (ตู๋ F1/F2, restated in the ticket): a one-row probe proves the screen reads
  // A value from the DB. It does NOT prove it reads the RIGHT row — a screen that picks arbitrarily passes
  // whenever the row it happened to grab is the one the test edited. The two halves below only both hold if
  // the selection rule is actually being applied.
  //
  // ⚠️ The third case is not decoration. "editing the loser changes nothing" is ALSO what you would see if
  // the code ignored the database entirely, so it is only evidence once the same instrument is shown to
  // MOVE — case ③ promotes the loser and the answer must follow it.
  it('🔴 #365 two live rows: editing the WINNER moves the date · editing the LOSER does not', async () => {
    const user = u[0]
    await seed({ id: 'sub-365-lose', userId: user, tier: 'PRO', expireAt: '2027-01-01' })
    await seed({ id: 'sub-365-win', userId: user, tier: 'PRO', expireAt: '2030-06-30' })

    // baseline — the furthest ACTIVE expire_at wins (lib/v2/subscription.ts pickActiveSubscriptionRow)
    expect((await resolveSubscription(user, NOW)).expireAt).toBe('2030-06-30')

    // ① edit the WINNER → the answer must follow it (still the furthest)
    await sql`UPDATE member_subscription SET expire_at = ${'2031-12-25'} WHERE id = ${'sub-365-win'}`
    expect((await resolveSubscription(user, NOW)).expireAt).toBe('2031-12-25')

    // ② edit the LOSER, keeping it a loser → the answer must NOT move
    await sql`UPDATE member_subscription SET expire_at = ${'2028-02-29'} WHERE id = ${'sub-365-lose'}`
    expect((await resolveSubscription(user, NOW)).expireAt).toBe('2031-12-25')

    // ③ NEGATIVE CONTROL for ② — promote the loser past the winner. If the instrument cannot see this, then
    // ②'s "did not move" measured nothing. The tier travels with the row, so assert both: a picker that
    // returned the right DATE off the wrong ROW would still be wrong.
    await sql`UPDATE member_subscription SET expire_at = ${'2099-01-01'}, tier_code = ${'PLUS'} WHERE id = ${'sub-365-lose'}`
    const promoted = await resolveSubscription(user, NOW)
    expect(promoted.expireAt).toBe('2099-01-01')
    expect(promoted.tier).toBe('PLUS')

    await sql`DELETE FROM member_subscription WHERE id IN (${'sub-365-win'}, ${'sub-365-lose'})`
  })

  it('🔴 TEETH — delete the v2 row and a member falls back to member_payment, NOT to free', async () => {
    await seed({ id: 'sub-354-teeth', userId: liveMember, tier: 'PLUS', expireAt: '2027-12-31' })
    expect(await resolveSubscription(liveMember, NOW)).toEqual({ isPaid: true, tier: 'PLUS', source: 'v2', expireAt: '2027-12-31' })
    await sql`DELETE FROM member_subscription WHERE id = ${'sub-354-teeth'}`
    expect(await resolveSubscription(liveMember, NOW)).toEqual({ isPaid: true, tier: 'PRO', source: 'legacy', expireAt: liveMemberExpireAt })
  })
})
