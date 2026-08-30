// mojisejr/mootech-fe#358 Phase 6 — DB half: the ceiling holds under a burst, on a REAL postgres.
//
// `describe.skipIf(!TEST_DATABASE_URL)`. Run it against the testenv pg for the PR proof:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/compat-quota-concurrency-db.test.ts
//
// 🔴 WHY THIS CANNOT BE A UNIT TEST. The defect is a gap between two statements — count, then insert —
// and a mock has no notion of two callers being inside that gap at once. mootech-be#21 measured 454 users
// past their ceiling on prod through exactly this shape. What is under test is `pg_advisory_xact_lock`
// plus the re-count inside the write transaction (lib/v2/compat-quota.ts, lib/matching/calculate-flow.ts).
//
// 🔴 WHY THE POOL IS BUILT HERE AND NOT IMPORTED. lib/db/index.ts opens the pool with `max: 1`, so inside
// ONE node process every transaction queues on a single connection and the race cannot occur — a suite
// using that pool would pass whether or not the lock exists, which is the `signal-passes-without-the-real-
// thing` class exactly. Production is serverless: many instances, many connections. This file therefore
// mocks @/lib/db with a pool of 10, so the burst below is a real one.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const TEST_URL = process.env.TEST_DATABASE_URL

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  const client = postgres(process.env.TEST_DATABASE_URL as string, { prepare: false, max: 10 })
  return { db: drizzle(client, { schema }), schema }
})

// The engine is the only thing stubbed. Every quota decision, every write and the lock itself are real.
vi.mock('@/lib/matching/bazi-client', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchBaziPairMatch: vi.fn(async () => ({
      love_score: 70, work_score: 70, description: 'stub', summary: 'stub', score: 70,
    })),
  }
})

// Membership is stubbed per test so a level can be chosen without seeding a purchase.
const membership = { isPaid: false as boolean | null, tier: null as string | null }
vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: vi.fn(async () => ({ ...membership, source: 'v2', expireAt: null })),
}))

// A pair-match answer the mapper accepts; if the shape ever stops mapping, `mapped.result.score` is null
// and the flow returns engine-down — which would look like a passing quota test. ① below guards that.
vi.mock('@/lib/matching/bazi-pair-match.mapper', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    mapPairMatchToComputeResult: vi.fn(() => ({ result: { score: 70, description: 'stub' } })),
  }
})

import { runCalculateMatching } from '@/lib/matching/calculate-flow'

describe.skipIf(!TEST_URL)('#358 Phase 6 · ดวงสมพงษ์ quota under a burst · real pg', () => {
  let sql: ReturnType<typeof postgres>
  let userId: string
  let friendId: string
  const NOW = new Date()
  const stamp = () => new Date().toISOString()

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { prepare: false, max: 5 })
  })

  afterAll(async () => {
    await sql`DELETE FROM log_activity WHERE user_id LIKE 'p6t-%'`
    await sql`DELETE FROM log_matching WHERE user_id LIKE 'p6t-%'`
    await sql`DELETE FROM log_love_mate WHERE user_id LIKE 'p6t-%'`
    await sql`DELETE FROM log_work_vibe WHERE user_id LIKE 'p6t-%'`
    await sql`DELETE FROM user_matching WHERE user_id LIKE 'p6t-%'`
    await sql`DELETE FROM member_with_friend WHERE user_id LIKE 'p6t-%'`
    await sql`DELETE FROM "user" WHERE user_id LIKE 'p6t-%'`
    await sql.end()
  })

  beforeEach(async () => {
    // 🔴 exactly 36 characters: "user".user_id is varchar(36) (measured on testenv, not assumed), so a
    // longer id fails the INSERT and every ceiling assertion below would then pass on an empty table.
    userId = `p6t-${randomUUID().replace(/-/g, '')}`
    friendId = randomUUID()
    membership.isPaid = false
    membership.tier = null
    await sql`INSERT INTO "user" (user_id, create_at, update_at, login_at, name, dob, time, is_remember_time,
                                  gender, result_code, place_name, used_point, total_point, is_refresh,
                                  share_img_profile_url)
              VALUES (${userId}, ${stamp()}, ${stamp()}, ${stamp()}, 'Tester', '1990-01-01', '08:00', true,
                      'male', '0000', 'Bangkok', 0, 100, false, '')`
    await sql`INSERT INTO member_with_friend (id, user_id, create_at, update_at, name, dob, time,
                                              is_remember_time, gender, place_name, is_member, member_id, is_notify)
              VALUES (${friendId}, ${userId}, ${stamp()}, ${stamp()}, 'Friend', '1992-02-02', '09:00',
                      true, 'female', 'Bangkok', false, '', false)`
  })

  async function rowsThisMonth(): Promise<number> {
    const [r] = await sql`SELECT count(*)::int AS n FROM user_matching
                          WHERE user_id = ${userId}
                            AND create_at >= to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-01 00:00:00')`
    return Number(r.n)
  }

  // ① The control that every case below depends on: the fixture can actually WRITE a row. Without this,
  // an engine stub that silently stopped mapping would make every ceiling assertion pass by writing
  // nothing at all — the shape where "0 ≤ 2" reads as a working gate.
  it('🔴 ① CONTROL — one ordinary press succeeds and writes exactly one row', async () => {
    const out = await runCalculateMatching({ userId, friendId, matchingType: 'LOVE', now: NOW })
    expect(out.ok, JSON.stringify(out)).toBe(true)
    expect(await rowsThisMonth()).toBe(1)
  })

  it('🔴 ② a FREE user stops at 2 — the third press is refused, and refused as QUOTA', async () => {
    for (let i = 0; i < 2; i++) {
      expect((await runCalculateMatching({ userId, friendId, matchingType: 'LOVE', now: NOW })).ok).toBe(true)
    }
    const third = await runCalculateMatching({ userId, friendId, matchingType: 'LOVE', now: NOW })
    expect(third.ok).toBe(false)
    expect(third.ok === false && third.kind).toBe('quota')
    expect(await rowsThisMonth()).toBe(2)
  })

  it('🔴 ③ love and colleague draw on ONE allowance, not two', async () => {
    expect((await runCalculateMatching({ userId, friendId, matchingType: 'LOVE', now: NOW })).ok).toBe(true)
    expect((await runCalculateMatching({ userId, friendId, matchingType: 'FRIEND', now: NOW })).ok).toBe(true)
    const third = await runCalculateMatching({ userId, friendId, matchingType: 'FRIEND', now: NOW })
    expect(third.ok, 'a separate colleague pool would have let this through').toBe(false)
    expect(await rowsThisMonth()).toBe(2)
  })

  it('🔴 ④ PLUS reaches 20 and stops there', async () => {
    membership.isPaid = true
    membership.tier = 'PLUS'
    const runs = await Promise.all(
      Array.from({ length: 25 }, () => runCalculateMatching({ userId, friendId, matchingType: 'LOVE', now: NOW })),
    )
    expect(runs.filter((r) => r.ok)).toHaveLength(20)
    expect(await rowsThisMonth()).toBe(20)
  })

  it('🔴 ⑤ PRO is not capped', async () => {
    membership.isPaid = true
    membership.tier = 'PRO'
    const runs = await Promise.all(
      Array.from({ length: 25 }, () => runCalculateMatching({ userId, friendId, matchingType: 'LOVE', now: NOW })),
    )
    expect(runs.every((r) => r.ok)).toBe(true)
    expect(await rowsThisMonth()).toBe(25)
  })

  // 🔴 ⑥ THE ONE THIS FILE EXISTS FOR. 20 presses land at once on a FREE account. Every one of them passes
  // the cheap pre-check, because at that moment the table really is empty. Only the re-count under the
  // advisory lock inside the write transaction can stop the 3rd through 20th.
  it('🔴 ⑥ 20 simultaneous presses on a FREE account charge exactly 2, never 20', async () => {
    const runs = await Promise.all(
      Array.from({ length: 20 }, () => runCalculateMatching({ userId, friendId, matchingType: 'LOVE', now: NOW })),
    )
    const ok = runs.filter((r) => r.ok).length
    const quota = runs.filter((r) => !r.ok && r.kind === 'quota').length
    expect(await rowsThisMonth(), 'rows written must never exceed the ceiling').toBe(2)
    expect(ok, 'exactly as many successes as rows').toBe(2)
    expect(ok + quota, 'every refusal is a quota refusal, not a crash').toBe(20)
  })

  // ⑦ The quota that was NOT spent. An engine failure must leave the user exactly where they were — the
  // #263 rule, restated at the row level rather than at the status code.
  it('🔴 ⑦ an engine failure writes nothing and spends nothing', async () => {
    const { fetchBaziPairMatch } = await import('@/lib/matching/bazi-client')
    vi.mocked(fetchBaziPairMatch).mockRejectedValueOnce(new Error('boom'))
    const out = await runCalculateMatching({ userId, friendId, matchingType: 'LOVE', now: NOW })
    expect(out.ok).toBe(false)
    expect(out.ok === false && out.kind).toBe('engine-down')
    expect(await rowsThisMonth()).toBe(0)
  })
})
