// MuMate v2 — ปฏิทินดวง · useReminders (goo · CLIENT-TRUTH list state — the §list "แบบ ข" superset).
//
// ฟีม เคาะ §list = แบบ ข (จัดเต็ม). The state is a real list (2 groups: กำลังจะถึง / เตือนไปแล้ว), NOT a
// static 1-row picture — so ตั้ง 5 ยาม shows 5 rows. It's a SUPERSET: แบบ ก would just be this list with
// one fixed row, so the shape survives even if the design ever narrows. Add/cancel are client mutations
// now; at API-time they become requests, the shape unchanged.
import { useCallback, useMemo, useState } from 'react'
import type { Reminder, ReminderList } from '../types'
import { MOCK_REMINDERS } from '../fixtures'

export interface UseReminders {
  list: ReminderList
  /** does this date already have ≥1 reminder — drives the day's menu (Saved vs PrimaryAction). */
  hasReminderFor: (date: string) => boolean
  /** add reminders committed from the save sheet (one per selected ยาม). */
  add: (reminders: Reminder[]) => void
  /** ยกเลิก a reminder (the [ยกเลิก] action in the list). */
  cancel: (id: string) => void
}

function group(reminders: Reminder[]): ReminderList {
  const upcoming = reminders.filter((r) => r.group === 'upcoming')
  const past = reminders.filter((r) => r.group === 'past')
  return {
    upcoming,
    past,
    totalYams: reminders.length,
    totalDays: new Set(reminders.map((r) => r.date)).size,
  }
}

export function useReminders(): UseReminders {
  const [reminders, setReminders] = useState<Reminder[]>(MOCK_REMINDERS)

  const list = useMemo(() => group(reminders), [reminders])

  const hasReminderFor = useCallback(
    (date: string) => reminders.some((r) => r.date === date),
    [reminders],
  )

  const add = useCallback((incoming: Reminder[]) => {
    // de-dupe by id so a replay/double-add can't duplicate a row (mirrors save-flow's commit latch).
    setReminders((prev) => {
      const seen = new Set(prev.map((r) => r.id))
      return [...prev, ...incoming.filter((r) => !seen.has(r.id))]
    })
  }, [])

  const cancel = useCallback((id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { list, hasReminderFor, add, cancel }
}
