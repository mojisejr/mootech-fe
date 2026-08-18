// #288 phase 4 — the DB-level overlap guard, on a REAL postgres (goo). บอง: Vercel documents that two
// cron instances can run at once ("can trigger a second instance while the first is still running"),
// so a "run twice, sequentially" test does NOT prove it — two claimers must race for the SAME rows AT
// ONCE, and FOR UPDATE SKIP LOCKED must hand each row to exactly one of them.
//
// GATED by TEST_DATABASE_URL: skipped in the normal pre-push run (no pg to talk to), RUN against a
// throwaway pg for the PR proof:
//   docker run -d --rm -p 5544:5432 -e POSTGRES_PASSWORD=x -e POSTGRES_DB=push_test postgres:17
//   TEST_DATABASE_URL=postgres://postgres:x@localhost:5544/push_test \
//   DATABASE_URL=postgres://postgres:x@localhost:5544/push_test \
//     npx vitest run scripts/push-concurrency.test.ts
// (DATABASE_URL is set only so lib/db constructs its lazy client at import; every query here runs on
//  the test client below, never on lib/db's.)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '@/lib/db/schema'
import type { PushRepo } from '@/lib/push/run'

const TEST_URL = process.env.TEST_DATABASE_URL

// Physical DDL mirrors lib/db/schema.ts (yam_window column name, partial index WHERE sent_at IS NULL).
const DDL = `
CREATE TABLE IF NOT EXISTS reminder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(36) NOT NULL,
  reminder_date varchar(10) NOT NULL,
  yam_id varchar(8) NOT NULL,
  yam_label text NOT NULL,
  yam_window varchar(16) NOT NULL,
  destinations json NOT NULL,
  fire_at_utc timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_user_date_yam ON reminder (user_id, reminder_date, yam_id);
CREATE INDEX IF NOT EXISTS idx_reminder_due ON reminder (fire_at_utc) WHERE sent_at IS NULL;
CREATE TABLE IF NOT EXISTS push_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(36) NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscription_endpoint ON push_subscription (endpoint);
`

describe.skipIf(!TEST_URL)('createDbRepo.claimDue · real pg · FOR UPDATE SKIP LOCKED', () => {
  let client: ReturnType<typeof postgres>
  let testDb: ReturnType<typeof drizzle<typeof schema>>
  let createDbRepo: (tx: never) => PushRepo
  const NOW = new Date('2026-08-19T10:00:00.000Z')

  beforeAll(async () => {
    // lock_timeout so that IF the guard regresses to a plain FOR UPDATE, the second claimer BLOCKS on
    // the first's row-lock and errors in 3s instead of hanging the run — the mutant fails fast and loud.
    client = postgres(TEST_URL as string, { max: 5, ssl: false, connection: { lock_timeout: '3000' } })
    testDb = drizzle(client, { schema })
    await client.unsafe(DDL)
    // repo.ts pulls in lib/db at import; DATABASE_URL is set so that lazy client constructs without
    // connecting (we only ever query through testDb). Dynamic import keeps it out of the skipped path.
    ;({ createDbRepo } = (await import('@/lib/push/repo')) as unknown as {
      createDbRepo: (tx: never) => PushRepo
    })
  })

  afterAll(async () => {
    if (client) {
      await client.unsafe('DROP TABLE IF EXISTS reminder; DROP TABLE IF EXISTS push_subscription;')
      await client.end()
    }
  })

  async function seedOneDueReminder() {
    await client.unsafe('DELETE FROM reminder; DELETE FROM push_subscription;')
    await client`INSERT INTO reminder (user_id, reminder_date, yam_id, yam_label, yam_window, destinations, fire_at_utc)
      VALUES ('u1', '2026-08-19', 'y1', 'ยามรุ่ง', '06:00-07:00', '["mumate"]'::json, ${new Date(NOW.getTime() - 2 * 60_000).toISOString()})`
  }

  it('two claimers overlapping: the row is handed to EXACTLY ONE (the other skips the locked row)', async () => {
    await seedOneDueReminder()
    // Transaction A claims and HOLDS the lock open until we release it.
    let releaseA!: () => void
    const gateA = new Promise<void>((r) => (releaseA = r))
    const pA = testDb.transaction(async (tx) => {
      const claimed = await createDbRepo(tx as never).claimDue(NOW)
      await gateA // keep the row-lock held while B tries
      return claimed
    })
    await new Promise((r) => setTimeout(r, 150)) // let A acquire the lock first
    // Transaction B runs while A still holds the lock → SKIP LOCKED means B sees zero. (A plain FOR
    // UPDATE would block here and hit lock_timeout — that is the mutant's fast failure.)
    let bClaimed: Awaited<ReturnType<PushRepo['claimDue']>>
    try {
      bClaimed = await testDb.transaction(async (tx) => createDbRepo(tx as never).claimDue(NOW))
    } finally {
      releaseA() // always release A so the held lock frees and teardown never blocks
      await pA
    }
    const aClaimed = await pA
    expect(aClaimed.length).toBe(1)
    expect(bClaimed.length).toBe(0)
  })

  it('due row past its fire time only; a NOT-yet-due row is never claimed', async () => {
    await client.unsafe('DELETE FROM reminder;')
    await client`INSERT INTO reminder (user_id, reminder_date, yam_id, yam_label, yam_window, destinations, fire_at_utc)
      VALUES ('u2', '2026-08-19', 'y2', 'ยามสาย', '10:00-11:00', '["mumate"]'::json, ${new Date(NOW.getTime() + 5 * 60_000).toISOString()})`
    const claimed = await testDb.transaction(async (tx) => createDbRepo(tx as never).claimDue(NOW))
    expect(claimed.length).toBe(0)
  })

  it('a Google-only reminder (no "mumate" destination) is never claimed for push', async () => {
    await client.unsafe('DELETE FROM reminder;')
    await client`INSERT INTO reminder (user_id, reminder_date, yam_id, yam_label, yam_window, destinations, fire_at_utc)
      VALUES ('u3', '2026-08-19', 'y3', 'ยามบ่าย', '13:00-14:00', '["google"]'::json, ${new Date(NOW.getTime() - 2 * 60_000).toISOString()})`
    const claimed = await testDb.transaction(async (tx) => createDbRepo(tx as never).claimDue(NOW))
    expect(claimed.length).toBe(0)
  })
})
