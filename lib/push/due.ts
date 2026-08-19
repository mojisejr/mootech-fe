// MuMate v2 · claim shapes + bounds (goo · #288 phase 4).
//
// The ยาม reminder is time-critical: firing LATE is worse than not firing (the ยาม has begun). So the
// claim (repo.ts) never reaches back past LATE_CEILING_MINUTES — a slipped reminder is simply never
// claimed, so it is never sent behind time AND the cron's working set can never grow past that window
// no matter how much unsent history piles up (F2). CLAIM_BATCH_LIMIT caps one tick's batch so a burst
// (or a one-time backlog) drains at a bounded rate instead of one unbounded transaction.

export const LATE_CEILING_MINUTES = 15
export const CLAIM_BATCH_LIMIT = 200

export interface ClaimedReminder {
  id: string
  userId: string
  reminderDate: string // "YYYY-MM-DD"
  yamLabel: string
  window: string // "HH:MM-HH:MM"
  fireAtUtc: Date
}
