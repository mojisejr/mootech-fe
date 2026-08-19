// MuMate v2 — ปฏิทินดวง · useReminders (goo · #287 — CLIENT list, now backed by the API).
//
// The §list "แบบ ข" superset (2 groups: กำลังจะถึง / เตือนไปแล้ว) is UNCHANGED in shape — so มุน's
// notifications.tsx (reads `list` + `cancel`) keeps working. What changed under it: the rows now come
// from GET /api/v2/reminders (persist across refresh — that IS #287's headline DoD), `cancel` is a real
// DELETE, and the old client-fabricating `add` is replaced by `save` (POST; the SERVER assigns ids).
//
// SSR + StrictMode safe: `dtos === null` until the first fetch resolves (server + first paint render the
// empty list, no hydration mismatch), and the effect gates every setState behind the AbortController so
// StrictMode's double-mount can't leave a stale/discarded result ([[strictmode-hook-hang-diagnosis]]).
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReminderList } from '../types'
import { toReminderList, type ReminderDTO } from './reminder-adapter'
import {
  fetchReminders,
  saveReminders,
  cancelReminder,
  type SaveReminderInput,
  type SaveOutcome,
} from './reminders-api'

export interface UseReminders {
  list: ReminderList
  /** true until the first fetch resolves (SSR + first paint) — the UI shows an empty/skeleton list. */
  loading: boolean
  /** the last load hit a transport error (retryable via refresh). save() reports its own outcome. */
  error: boolean
  hasReminderFor: (date: string) => boolean
  /** #341 — yamId ที่ "เพิ่มแล้ว" ของวันนั้น (ไม่ใช่แค่ "วันนี้มีไหม") — ป้อนให้ dayReminderCta aggregate 7 สถานะ */
  addedYamIdsFor: (date: string) => string[]
  refresh: () => Promise<void>
  /** POST a save; returns the typed outcome. On success the list already reflects the server's rows. */
  save: (input: SaveReminderInput) => Promise<SaveOutcome>
  /** ยกเลิก (DELETE, server-scoped by session user_id); removes the row after the server confirms. */
  cancel: (id: string) => Promise<void>
}

const EMPTY_LIST: ReminderList = { upcoming: [], past: [], totalYams: 0, totalDays: 0 }

/**
 * #341 — yamId ที่เพิ่มแล้วสำหรับ "วันหนึ่ง" (pure · de-dupe by yamId). แยกจากฮุคเพื่อให้ยิงฟันได้โดยไม่ต้องมี
 * React — คู่กับ `hasReminderFor(date)` ที่ตอบได้แค่ "วันนี้มีไหม" ตัวนี้ตอบ "ยามไหนของวันนี้ถูกเพิ่ม".
 */
export function addedYamIdsForDate(dtos: ReminderDTO[], date: string): string[] {
  const seen = new Set<string>()
  for (const d of dtos) if (d.date === date) seen.add(d.yamId)
  return Array.from(seen)
}

function dedupeById(dtos: ReminderDTO[]): ReminderDTO[] {
  const seen = new Set<string>()
  const out: ReminderDTO[] = []
  for (const d of dtos) {
    if (!seen.has(d.id)) {
      seen.add(d.id)
      out.push(d)
    }
  }
  return out
}

export function useReminders(): UseReminders {
  const [dtos, setDtos] = useState<ReminderDTO[] | null>(null) // null = not loaded yet
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0) // bump → refetch

  useEffect(() => {
    const ctrl = new AbortController()
    setError(false)
    fetchReminders(ctrl.signal)
      .then((rows) => {
        if (!ctrl.signal.aborted) setDtos(rows)
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setError(true)
      })
    return () => ctrl.abort()
  }, [tick])

  const refresh = useCallback(async () => setTick((t) => t + 1), [])

  const save = useCallback(async (input: SaveReminderInput): Promise<SaveOutcome> => {
    const outcome = await saveReminders(input)
    if (outcome.ok) {
      // Merge the server's rows (authoritative ids) into the list, de-duped → immediate reflection with
      // no extra round-trip. A lost-response RETRY returns the SAME rows (server idempotent) → dedupe
      // keeps exactly one each.
      setDtos((prev) => dedupeById([...(prev ?? []), ...outcome.reminders]))
    }
    return outcome
  }, [])

  const cancel = useCallback(async (id: string) => {
    const ok = await cancelReminder(id)
    if (ok) setDtos((prev) => (prev ?? []).filter((r) => r.id !== id))
  }, [])

  const list = useMemo(() => (dtos === null ? EMPTY_LIST : toReminderList(dtos, new Date())), [dtos])
  const hasReminderFor = useCallback((date: string) => (dtos ?? []).some((r) => r.date === date), [dtos])
  const addedYamIdsFor = useCallback((date: string) => addedYamIdsForDate(dtos ?? [], date), [dtos])

  return { list, loading: dtos === null && !error, error, hasReminderFor, addedYamIdsFor, refresh, save, cancel }
}
