// mojisejr/mootech-fe#358 Phase 6 — DB half: after the grant, a legacy member is PRO and has LOST NOTHING.
//
// `describe.skipIf(!TEST_DATABASE_URL)`. Run against the testenv pg for the PR proof:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/legacy-grant-db.test.ts
//
// 🔴 WHAT IS ACTUALLY UNDER TEST is lib/db/0014_legacy_members_pro.sql — the FILE, read off disk and
// executed, not a re-typed copy of its statement. A test that restates the migration proves the test
// agrees with itself. This one goes red if the file changes and stops doing what it says.
//
// 🔴 THE ASSERTION THAT MATTERS IS "NOTHING GOT SMALLER". #352's closing criterion is that legacy members
// must not lose access, so every case measures the ceiling BEFORE and AFTER and compares the two, rather
// than asserting a number the test author chose.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const TEST_URL = process.env.TEST_DATABASE_URL
const MIGRATION = readFileSync(resolve('lib/db/0014_legacy_members_pro.sql'), 'utf8')

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  const client = postgres(process.env.TEST_DATABASE_URL as string, { prepare: false, max: 5 })
  return { db: drizzle(client, { schema }), schema }
})

import { resolveSubscription } from '@/lib/v2/subscription'
// 🔴 The ceiling is read straight from the entitlement TABLE, not from Phase 6's gate wrapper. This file
// must not depend on mojisejr/mootech-fe#548: the grant is about a membership's NAME and is correct
// whether or not the compatibility gate has shipped, and a dependency here would force a merge ORDER on
// ฟีม — the #534 shape, where a PR based on a branch merged into that branch instead of main.
import { entitlementTierOf, monthlyQuotaFor } from '@/lib/v2/entitlement'

const compatibilityCeilingFor = (v: { isPaid: boolean | null; tier: string | null }) =>
  monthlyQuotaFor(entitlementTierOf(v), 'compatibility')

describe.skipIf(!TEST_URL)('#358 Phase 6 · legacy members keep everything, and gain a NAME · real pg', () => {
  let sql: ReturnType<typeof postgres>
  const stamp = () => new Date().toISOString()
  const day = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)

  async function seedMember(expireAt: string): Promise<string> {
    // "user".user_id is varchar(36) — measured, not assumed.
    const userId = `lg-${randomUUID().replace(/-/g, '')}`.slice(0, 36)
    await sql`INSERT INTO "user" (user_id, create_at, update_at, login_at, name, dob, time, is_remember_time,
                                  gender, result_code, place_name, used_point, total_point, is_refresh,
                                  share_img_profile_url)
              VALUES (${userId}, ${stamp()}, ${stamp()}, ${stamp()}, 'Legacy', '1985-05-05', '07:00', true,
                      'male', '0000', 'Bangkok', 0, 100, false, '')`
    // columns read off the live table, not from the drizzle model: member_payment has no update_at.
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
              VALUES (${userId}, 'MEMBER', 'LEGACY', ${stamp()}, ${day(-30)}, ${expireAt})`
    return userId
  }

  async function ceilingOf(userId: string): Promise<number | null> {
    const v = await resolveSubscription(userId)
    return compatibilityCeilingFor({ isPaid: v.isPaid, tier: v.tier })
  }

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { prepare: false, max: 5 })
  })

  // 🔴 CLEAN BY package_code, NOT ONLY BY THE FIXTURE PREFIX. `sql.unsafe(MIGRATION)` runs the REAL
  // migration against the whole database, so every live legacy member already in testenv (30 of them when
  // this was written) is granted a row too — not just the `lg-` fixtures. The first version of this file
  // cleaned only the prefix and left those 30 rows behind, which would have made the next reader's testenv
  // disagree with prod for reasons nothing recorded. 'LEGACY_GRANT' is the migration's own rollback key.
  afterAll(async () => {
    await sql`DELETE FROM member_subscription WHERE package_code = 'LEGACY_GRANT'`
    await sql`DELETE FROM member_subscription WHERE user_id LIKE 'lg-%'`
    await sql`DELETE FROM member_payment WHERE user_id LIKE 'lg-%'`
    await sql`DELETE FROM "user" WHERE user_id LIKE 'lg-%'`
    await sql.end()
  })

  beforeEach(async () => {
    await sql`DELETE FROM member_subscription WHERE package_code = 'LEGACY_GRANT'`
    await sql`DELETE FROM member_subscription WHERE user_id LIKE 'lg-%'`
    await sql`DELETE FROM member_payment WHERE user_id LIKE 'lg-%'`
    await sql`DELETE FROM "user" WHERE user_id LIKE 'lg-%'`
  })

  // 🔴 ① THIS CASE IS THE FINDING, and it does not assert what the ticket predicted.
  //
  // #358's body says a legacy member resolves with `tier: null` and that a level table therefore has no
  // row for them — the premise the whole ทาง A / ทาง B question was built on. That stopped being true when
  // Phase 1 merged (76449e1): lib/v2/subscription.ts:26 declares LEGACY_TIER = 'PRO' and :163 returns it.
  // So a live legacy member is ALREADY named PRO, before any migration runs. Measured here rather than
  // argued, and the assertions below are written to go red if that ever changes back.
  it('🔴 ① a live legacy member is ALREADY PRO before the grant — and the grant changes nothing they see', async () => {
    const userId = await seedMember(day(90))

    const before = await resolveSubscription(userId)
    expect(before.isPaid, 'the fixture must be a paying member, or nothing below proves anything').toBe(true)
    expect(before.tier, 'the ticket predicted null; Phase 1 already names them').toBe('PRO')
    const ceilingBefore = await ceilingOf(userId)
    expect(ceilingBefore, 'PRO is uncapped for ดวงสมพงษ์').toBe(null)

    await sql.unsafe(MIGRATION)

    const after = await resolveSubscription(userId)
    expect(after.tier).toBe('PRO')
    expect(await ceilingOf(userId), 'a legacy member must not lose access').toBe(ceilingBefore)
  })

  it('🔴 ② their OWN expiry is carried over — the grant neither extends nor shortens what they bought', async () => {
    const expiry = day(45)
    const userId = await seedMember(expiry)
    await sql.unsafe(MIGRATION)
    const [row] = await sql`SELECT expire_at::text, start_at::text, amount_satang, payment_id, status
                            FROM member_subscription WHERE user_id = ${userId}`
    expect(row.expire_at).toBe(expiry)
    expect(row.amount_satang, 'no money moved through this row').toBe(0)
    expect(row.payment_id).toBe(null)
    expect(row.status).toBe('ACTIVE')
  })

  it('🔴 ③ CONTROL — an EXPIRED legacy member is not granted anything, and stays FREE', async () => {
    const userId = await seedMember(day(-10))
    const ceilingBefore = await ceilingOf(userId)
    expect(ceilingBefore, 'an expired member is free: 2 per month').toBe(2)

    await sql.unsafe(MIGRATION)

    const [[row]] = [await sql`SELECT count(*)::int AS n FROM member_subscription WHERE user_id = ${userId}`]
    expect(row.n, 'expiry is the whole predicate; granting here would be granting everyone').toBe(0)
    expect(await ceilingOf(userId)).toBe(ceilingBefore)
  })

  it('🔴 ④ running it twice grants once', async () => {
    const userId = await seedMember(day(30))
    await sql.unsafe(MIGRATION)
    await sql.unsafe(MIGRATION)
    const [row] = await sql`SELECT count(*)::int AS n FROM member_subscription WHERE user_id = ${userId}`
    expect(row.n).toBe(1)
  })

  it('🔴 ⑤ someone who ALREADY has a v2 row is left alone — the newer store wins', async () => {
    const userId = await seedMember(day(30))
    await sql`INSERT INTO member_subscription
                (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status)
              VALUES (${randomUUID()}, ${userId}, 'PLUS', 'V2_PLUS_YEARLY', 79000,
                      ${day(0)}, ${day(200)}, 'ACTIVE')`
    await sql.unsafe(MIGRATION)
    const rows = await sql`SELECT tier_code FROM member_subscription WHERE user_id = ${userId}`
    expect(rows.map((r) => r.tier_code)).toEqual(['PLUS'])
  })
})

// 🔴 MUTANT CONTRACT — measured 2026-08-30, counts copied from the runs; see the PR body.
