// MuMate v2 · the SQL half of the push cron (goo · #288 phase 4). The ONLY file with database queries;
// the send logic (run.ts) never sees drizzle.
//
// claimAndMark is the whole concurrency + at-most-once story in ONE atomic statement:
//   UPDATE … SET sent_at = now WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING …
// - It MARKS sent_at and RETURNS the claimed rows in the same statement, which auto-commits. The send
//   then happens OUTSIDE any transaction (route.ts). So a crash/rollback can only make a reminder
//   miss, never double-send — at-most-once, which is what the ticket's own rule ("ส่งช้าแย่กว่าไม่ส่ง")
//   asks for (ตู๋ F1: a send inside the txn double-sends when the txn rolls back after delivery).
// - FOR UPDATE SKIP LOCKED → two overlapping cron runs claim DISJOINT rows (Vercel documents overlap).
// - The lower bound (fire_at_utc >= now - LATE_CEILING_MINUTES) + LIMIT bound the working set to the
//   15-minute window: an undelivered row ages out and is never scanned/locked again, so the cron hot
//   path cannot grow with history (ตู๋ F2). ORDER BY fire_at_utc drains the most-urgent first.

import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pushSubscription } from '@/lib/db/schema'
import type { PushRepo, SubscriptionRow } from './run'
import type { ClaimedReminder } from './due'
import { LATE_CEILING_MINUTES, CLAIM_BATCH_LIMIT } from './due'

// A query executor — either the pooled db (autocommit, used here) or a transaction.
type Executor = typeof db

export function createDbRepo(exec: Executor): PushRepo {
  return {
    async claimAndMark(now: Date): Promise<ClaimedReminder[]> {
      // Bind `now` as an ISO string cast to timestamptz — the drizzle/postgres-js version here cannot
      // serialize a raw Date inside a sql`` template.
      const nowIso = now.toISOString()
      const rows = await exec.execute(sql`
        UPDATE reminder SET sent_at = ${nowIso}::timestamptz
        WHERE id IN (
          SELECT id FROM reminder
          WHERE sent_at IS NULL
            AND fire_at_utc <= ${nowIso}::timestamptz
            AND fire_at_utc >= ${nowIso}::timestamptz - (interval '1 minute' * ${LATE_CEILING_MINUTES})
            AND destinations::jsonb @> '["mumate"]'::jsonb
          ORDER BY fire_at_utc
          LIMIT ${CLAIM_BATCH_LIMIT}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id,
                  user_id       AS "userId",
                  reminder_date AS "reminderDate",
                  yam_label     AS "yamLabel",
                  yam_window    AS "window",
                  fire_at_utc   AS "fireAtUtc"
      `)
      return rows as unknown as ClaimedReminder[]
    },

    async loadSubscriptions(userId: string): Promise<SubscriptionRow[]> {
      return exec
        .select({
          id: pushSubscription.id,
          endpoint: pushSubscription.endpoint,
          p256dh: pushSubscription.p256dh,
          auth: pushSubscription.auth,
        })
        .from(pushSubscription)
        .where(eq(pushSubscription.userId, userId))
    },

    async deleteSubscription(subscriptionId: string): Promise<void> {
      await exec.delete(pushSubscription).where(eq(pushSubscription.id, subscriptionId))
    },
  }
}
