// CIEL mumate-be-retirement-001 slice 1d — the first-run consent write against a REAL postgres.
//
// `describe.skipIf(!TEST_DATABASE_URL)`. Run it against the testenv pg for the PR proof:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/consent-store-db.test.ts
//
// What only a real database shows: that the consent row and the user stamp land TOGETHER or not at all, in
// the BE's formats, through the route with NODE_ENV=production (the path that used to call the BE), and on a
// ONE-connection pool — production's shape (lib/db/index.ts, max: 1), where a stray `db.` call inside the
// transaction would hang instead of passing.
//
// 🔴 MUTANT CONTRACT (each reddens this file against the testenv pg):
//   MS1  split the two writes out of the transaction             → ③ reddens (a consent row survives the failure)
//   MS2  write the consent row before checking the user exists  → ④ reddens (an orphan consent row)
//   MS3  any `db.` call inside the transaction callback          → times out on the max:1 pool
//   MS4  upsert instead of append                                → ② reddens
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const TEST_URL = process.env.TEST_DATABASE_URL

vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  // max: 1 ON PURPOSE — production's pool size (see the header).
  const client = postgres(process.env.TEST_DATABASE_URL as string, { prepare: false, max: 1 })
  return { db: drizzle(client, { schema }), schema }
})

const who = vi.hoisted(() => ({ value: { ok: true, userId: '' } as { ok: true; userId: string } }))
vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => who.value) }))

import { recordOnboardingConsent } from '@/lib/v2/consent-store'
import handler from '../pages/api/v2/onboarding'

function makeRes() {
  const res: { statusCode: number; body: any; status: any; json: any } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
  }
  return res
}

describe.skipIf(!TEST_URL)('be-retirement 1d · consent + onboarded_at · real pg, one connection', () => {
  let sql: ReturnType<typeof postgres>
  let userId: string
  const stamp = '2026-09-27 09:00:00'

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { prepare: false, max: 2 })
  })
  afterAll(async () => {
    await sql`DELETE FROM consent WHERE user_id LIKE 'bx2-%'`
    await sql`DELETE FROM member_subscription WHERE user_id LIKE 'bx2-%'`
    await sql`DELETE FROM member_payment WHERE user_id LIKE 'bx2-%'`
    await sql`DELETE FROM "user" WHERE user_id LIKE 'bx2-%'`
    await sql.end()
  })
  beforeEach(async () => {
    userId = `bx2-${randomUUID().replace(/-/g, '')}` // exactly 36 = "user".user_id varchar(36)
    await sql`INSERT INTO "user" (user_id, create_at, update_at, login_at, name, dob, time, is_remember_time,
                                  gender, result_code, place_name, used_point, total_point, is_refresh,
                                  share_img_profile_url)
              VALUES (${userId}, ${stamp}, ${stamp}, ${stamp}, 'Tester', '1990-01-01', '08:00', true,
                      'MALE', '0000', '', 0, 20, false, '')`
    who.value = { ok: true, userId }
  })

  const consentRows = (id: string) =>
    sql`SELECT user_id, accepted_at, policy_version FROM consent WHERE user_id = ${id} ORDER BY accepted_at`
  const userStamp = async (id: string) =>
    (await sql`SELECT onboarded_at, onboarding_goal FROM "user" WHERE user_id = ${id}`)[0]

  it('🔴 ① NODE_ENV=production through the route: 200, one consent row, the user stamped — same instant, BE format', async () => {
    const prev = process.env.NODE_ENV
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const res = makeRes()
      await handler({ method: 'POST', body: { goal: 'health', user_id: 'VICTIM' } } as never, res as never)
      expect(res.statusCode).toBe(200)
      expect(fetchSpy).not.toHaveBeenCalled() // no BE, no network

      const rows = await consentRows(userId)
      expect(rows.length).toBe(1)
      expect(rows[0].policy_version).toBe('v1')
      expect(rows[0].accepted_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/) // MomentService 'YYYY-MM-DD HH:mm:ss'
      const u = await userStamp(userId)
      expect(u).toEqual({ onboarded_at: rows[0].accepted_at, onboarding_goal: 'health' })
      expect(res.body).toEqual({ ok: true, onboarded_at: rows[0].accepted_at, onboarding_goal: 'health' })
      expect((await consentRows('VICTIM')).length).toBe(0)
    } finally {
      vi.unstubAllGlobals()
      ;(process.env as Record<string, string | undefined>).NODE_ENV = prev
    }
  })

  it('② a second first-run APPENDS a consent row (history) and refreshes the goal and the stamp', async () => {
    await recordOnboardingConsent({ userId, goal: 'finance', policyVersion: 'v1', now: new Date('2026-09-27T01:00:00Z') })
    await recordOnboardingConsent({ userId, goal: 'work', policyVersion: 'v1', now: new Date('2026-09-27T02:00:00Z') })
    const rows = await consentRows(userId)
    expect(rows.map((r) => r.accepted_at)).toEqual(['2026-09-27 08:00:00', '2026-09-27 09:00:00']) // Bangkok
    expect(await userStamp(userId)).toEqual({ onboarded_at: '2026-09-27 09:00:00', onboarding_goal: 'work' })
  })

  it('🔴 ③ if the consent insert fails, the user stamp rolls back with it — one transaction', async () => {
    await expect(
      // policy_version is NOT NULL: a null forces the second write to fail after the first has run.
      recordOnboardingConsent({ userId, goal: 'love', policyVersion: null as unknown as string }),
    ).rejects.toThrow()
    expect(await userStamp(userId)).toEqual({ onboarded_at: null, onboarding_goal: null })
    expect((await consentRows(userId)).length).toBe(0)
  })

  it('🔴 ④ a user_id with no "user" row → user-not-found, and NO consent row is written', async () => {
    const ghost = `bx2-${randomUUID().replace(/-/g, '')}`
    expect(await recordOnboardingConsent({ userId: ghost, goal: 'love', policyVersion: 'v1' })).toEqual({
      ok: false,
      reason: 'user-not-found',
    })
    expect((await consentRows(ghost)).length).toBe(0)
    // and the pool is still usable afterwards (the rollback released the one connection)
    expect((await recordOnboardingConsent({ userId, goal: 'love', policyVersion: 'v1' })).ok).toBe(true)
  })
})
