// MuMate v2 · due-reminder shapes + the lateness ceiling (goo · #288 phase 4).
//
// The ยาม reminder is time-critical: firing LATE is worse than not firing (the ยาม has already begun).
// So a reminder whose fire instant slipped more than LATE_CEILING_MINUTES into the past is DROPPED,
// never sent behind time. The SQL claim (repo.ts) selects unsent + due rows; this pure predicate is
// the second half — kept in TS on purpose so the "14m → send · 16m → drop · 15m boundary" rule is
// unit-provable without a database (and a mutant that disables it fails a specific test line).

export const LATE_CEILING_MINUTES = 15

export interface ClaimableReminder {
  id: string
  userId: string
  reminderDate: string // "YYYY-MM-DD"
  yamLabel: string
  window: string // "HH:MM-HH:MM"
  fireAtUtc: Date
}

/**
 * Is `fireAt` due-and-fresh at `now`? True only when the fire instant is in the past (it is time to
 * send) AND no more than LATE_CEILING_MINUTES late. `fireAt` in the future → false (not yet due);
 * more than 15 min late → false (drop, do not send behind time).
 */
export function withinCeiling(fireAt: Date, now: Date): boolean {
  const lateMs = now.getTime() - fireAt.getTime()
  if (lateMs < 0) return false // not due yet
  return lateMs <= LATE_CEILING_MINUTES * 60 * 1000
}
