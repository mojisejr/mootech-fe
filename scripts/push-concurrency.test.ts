// #288 phase 4 — claimAndMark on a REAL postgres (goo). This is the gate for the two findings ตู๋
// raised on pg 17: F1 (a send inside a txn double-sends on rollback → we mark+commit atomically BEFORE
// any send, at-most-once) and F2 (an unbounded claim pile → lower bound + LIMIT bound the window).
//
// ⚠️ F3: this file is `describe.skipIf(!TEST_DATABASE_URL)` and nothing in the repo sets it, so it does
// NOT run in the pre-push lane — the strongest gate of this ticket. Tracked in mootech-fe#334 (who runs
// it, when). RUN it against a throwaway pg for the PR proof:
//   TEST_DATABASE_URL=postgres://…  DATABASE_URL=postgres://…  npx vitest run scripts/push-concurrency.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@/lib/db/schema'
import type { PushRepo } from '@/lib/push/run'
import { CLAIM_BATCH_LIMIT } from '@/lib/push/due'

const TEST_URL = process.env.TEST_DATABASE_URL

const DDL = `
CREATE TABLE IF NOT EXISTS reminder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar(36) NOT NULL,
  reminder_date varchar(10) NOT NULL, yam_id varchar(8) NOT NULL, yam_label text NOT NULL,
  yam_window varchar(16) NOT NULL, destinations json NOT NULL, fire_at_utc timestamptz NOT NULL,
  sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_user_date_yam ON reminder (user_id, reminder_date, yam_id);
CREATE INDEX IF NOT EXISTS idx_reminder_due ON reminder (fire_at_utc) WHERE sent_at IS NULL;`

describe.skipIf(!TEST_URL)('claimAndMark · real pg · at-most-once + bounded (F1/F2)', () => {
  let client: ReturnType<typeof postgres>
  let repo: PushRepo
  const NOW = new Date('2026-08-19T10:00:00.000Z')
  const minAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()
  const minAhead = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString()

  beforeAll(async () => {
    client = postgres(TEST_URL as string, { max: 8, ssl: false })
    const testDb = drizzle(client, { schema })
    await client.unsafe(DDL)
    const { createDbRepo } = (await import('@/lib/push/repo')) as unknown as {
      createDbRepo: (exec: unknown) => PushRepo
    }
    repo = createDbRepo(testDb)
  })

  afterAll(async () => {
    if (client) {
      await client.unsafe('DROP TABLE IF EXISTS reminder;')
      await client.end()
    }
  })

  beforeEach(async () => {
    await client.unsafe('DELETE FROM reminder;')
  })

  async function seedDue(count: number, fireIso = minAgo(2), destinations = '["mumate"]') {
    for (let i = 0; i < count; i++) {
      await client`INSERT INTO reminder (user_id, reminder_date, yam_id, yam_label, yam_window, destinations, fire_at_utc)
        VALUES (${'u' + i}, '2026-08-19', ${'y' + i}, 'ยาม', '06:00-07:00', ${destinations}::json, ${fireIso})`
    }
  }

  it('F1 · at-most-once: after claim, sent_at is committed → a re-claim returns NOTHING (no double-send)', async () => {
    await seedDue(1)
    const first = await repo.claimAndMark(NOW)
    expect(first).toHaveLength(1)
    // Even if delivery then fails/crashes, the mark already committed → the reminder is never re-claimed.
    const second = await repo.claimAndMark(NOW)
    expect(second).toHaveLength(0)
  })

  // NOTE (ตู๋ N1): the no-double guarantee comes from the atomic UPDATE + the `sent_at IS NULL`
  // predicate — under READ COMMITTED a blocked writer re-evaluates and sees the row already marked, so
  // it cannot re-claim. SKIP LOCKED is NOT what makes this correct; it only lets concurrent claimers
  // run WITHOUT blocking each other (throughput). No test guards that non-blocking property (4×20 is
  // too small to see it) — so do not read this case as protecting SKIP LOCKED.
  it('F1 · overlap: concurrent claimers → every row claimed EXACTLY once (atomic UPDATE + sent_at-IS-NULL recheck)', async () => {
    await seedDue(20)
    const results = await Promise.all([
      repo.claimAndMark(NOW),
      repo.claimAndMark(NOW),
      repo.claimAndMark(NOW),
      repo.claimAndMark(NOW),
    ])
    const ids = results.flat().map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length) // no id claimed twice
    expect(new Set(ids).size).toBe(20) // and every due row was claimed
  })

  it('F2 · lower bound: 14m late → claimed · 16m late → NOT claimed (aged out of the window)', async () => {
    await seedDue(1, minAgo(14))
    expect(await repo.claimAndMark(NOW)).toHaveLength(1)
    await client.unsafe('DELETE FROM reminder;')
    await seedDue(1, minAgo(16))
    expect(await repo.claimAndMark(NOW)).toHaveLength(0)
  })

  it('F2 · LIMIT: more due rows than CLAIM_BATCH_LIMIT → one tick claims exactly the cap, rest next tick', async () => {
    await seedDue(CLAIM_BATCH_LIMIT + 5)
    expect(await repo.claimAndMark(NOW)).toHaveLength(CLAIM_BATCH_LIMIT)
    expect(await repo.claimAndMark(NOW)).toHaveLength(5)
  })

  it('a not-yet-due reminder is never claimed', async () => {
    await seedDue(1, minAhead(5))
    expect(await repo.claimAndMark(NOW)).toHaveLength(0)
  })

  it('a Google-only reminder (no "mumate" destination) is never claimed for push', async () => {
    await seedDue(1, minAgo(2), '["google"]')
    expect(await repo.claimAndMark(NOW)).toHaveLength(0)
  })
})
