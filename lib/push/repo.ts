// MuMate v2 · the SQL half of the push cron (goo · #288 phase 4). Binds a PushRepo to one open
// transaction. This is the ONLY file with database queries; the decision logic (run.ts) never sees
// drizzle. Swapping Vercel cron for a VPS later changes only the caller, not this.

import { and, eq, isNull, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reminder, pushSubscription } from '@/lib/db/schema'
import type { PushRepo, SubscriptionRow } from './run'
import type { ClaimableReminder } from './due'

// The exact transaction type db.transaction() hands its callback — carries the schema so queries stay
// typed without `any`.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export function createDbRepo(tx: Tx): PushRepo {
  return {
    async claimDue(now: Date): Promise<ClaimableReminder[]> {
      // Unsent + due (fire instant already passed) + destined for MuMate. FOR UPDATE SKIP LOCKED so a
      // second, overlapping cron run skips these rows rather than racing to send them again. The
      // partial index idx_reminder_due (fire_at_utc WHERE sent_at IS NULL) serves this scan directly.
      // destinations filter (บอง 2026-08-19): today every row is ['mumate'], but once Google Calendar
      // lands, a Google-only reminder must NOT get a push — filter from day one.
      const rows = await tx
        .select({
          id: reminder.id,
          userId: reminder.userId,
          reminderDate: reminder.reminderDate,
          yamLabel: reminder.yamLabel,
          window: reminder.window,
          fireAtUtc: reminder.fireAtUtc,
        })
        .from(reminder)
        .where(
          and(
            isNull(reminder.sentAt),
            lte(reminder.fireAtUtc, now),
            sql`${reminder.destinations}::jsonb @> '["mumate"]'::jsonb`,
          ),
        )
        .for('update', { skipLocked: true })
      return rows
    },

    async loadSubscriptions(userId: string): Promise<SubscriptionRow[]> {
      return tx
        .select({
          id: pushSubscription.id,
          endpoint: pushSubscription.endpoint,
          p256dh: pushSubscription.p256dh,
          auth: pushSubscription.auth,
        })
        .from(pushSubscription)
        .where(eq(pushSubscription.userId, userId))
    },

    async markSent(reminderId: string, at: Date): Promise<void> {
      await tx.update(reminder).set({ sentAt: at }).where(eq(reminder.id, reminderId))
    },

    async deleteSubscription(subscriptionId: string): Promise<void> {
      await tx.delete(pushSubscription).where(eq(pushSubscription.id, subscriptionId))
    },
  }
}
