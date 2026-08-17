// MuMate v2 · reminder-adapter (goo · #287) — maps the backend's reminder rows → the `Reminder` +
// `ReminderList` shapes the UI already binds to, so มุน's screens need ZERO change at API-time.
//
// PURE (no React, no fetch) → unit-testable. The two things the backend deliberately does NOT send,
// because they rot / duplicate, are DERIVED here (goo's rule, from the #287 consult):
//   • group 'upcoming'|'past'  ← fireAtUtc vs now  (save-flow.ts's "state derived from data" principle)
//   • totalYams / totalDays    ← counted from the rows
// The backend sends `id` (server-authoritative) + `fireAtUtc` (the instant) + the display fields.

import type { Reminder, ReminderList, ReminderDestination } from '../types'

/** The wire shape from GET /api/v2/reminders — exactly what the server row carries, no group/totals. */
export interface ReminderDTO {
  id: string
  date: string
  yamId: string
  yamLabel: string
  window: string
  destinations: ReminderDestination[]
  fireAtUtc: string
}

/** One row → a `Reminder`, with `group` derived from the instant vs `now`. */
export function toReminder(dto: ReminderDTO, now: Date): Reminder {
  const fired = new Date(dto.fireAtUtc).getTime() <= now.getTime()
  return {
    id: dto.id,
    date: dto.date,
    yamId: dto.yamId,
    yamLabel: dto.yamLabel,
    window: dto.window,
    destinations: dto.destinations,
    fireAtUtc: dto.fireAtUtc,
    group: fired ? 'past' : 'upcoming',
  }
}

/**
 * Rows → the grouped `ReminderList`. De-dupes by id (mirrors useReminders' replay guard: a doubled row
 * from a retry/refetch can't become two list entries). Totals are counted, never trusted from the wire.
 */
export function toReminderList(dtos: ReminderDTO[], now: Date = new Date()): ReminderList {
  const seen = new Set<string>()
  const reminders: Reminder[] = []
  for (const dto of dtos) {
    if (seen.has(dto.id)) continue
    seen.add(dto.id)
    reminders.push(toReminder(dto, now))
  }
  return {
    upcoming: reminders.filter((r) => r.group === 'upcoming'),
    past: reminders.filter((r) => r.group === 'past'),
    totalYams: reminders.length,
    totalDays: new Set(reminders.map((r) => r.date)).size,
  }
}
