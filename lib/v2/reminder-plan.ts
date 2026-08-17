// MuMate v2 · reminder commit PLANNER (goo · #287). PURE — the write DECISION, no DB — so every rule
// (empty draft, malformed input, ตั้งย้อนหลัง, atomic batch) is unit-testable without a server. The API
// handler stays a thin shell: resolve identity → gate membership → plan() → one transactional insert.

import { computeFireAt, isFireTimePast } from './reminder-time'

export interface YamInput {
  yamId: string
  yamLabel: string
  window: string // "HH:MM-HH:MM"
}

export interface CommitInput {
  date: string // "YYYY-MM-DD" (ยาม START's BKK day)
  yams: YamInput[]
  destinations: string[]
}

export interface PlannedRow {
  yamId: string
  yamLabel: string
  window: string
  destinations: string[]
  fireAtUtc: Date
}

export type CommitPlan =
  | { ok: true; rows: PlannedRow[] }
  | { ok: false; status: 400 | 422; error: string; pastYamIds?: string[] }

/**
 * Validate a commit and compute each yam's fire instant — or refuse.
 *
 * The BATCH is all-or-nothing (atomic): if ANY yam is malformed (400) or already past (422), NOTHING is
 * planned — the handler inserts zero rows. This is #287's "เลือก 5 ยามแล้วล้มกลางคัน → ไม่มีอันไหนถูก
 * บันทึกเลย" AND "ตั้งย้อนหลัง → ไม่มีรายการเพิ่มขึ้น": a partial save is never allowed. `now` injectable.
 */
export function planReminderCommit(input: CommitInput, now: Date = new Date()): CommitPlan {
  if (!Array.isArray(input.yams) || input.yams.length === 0) {
    return { ok: false, status: 400, error: 'ต้องเลือกอย่างน้อย 1 ยาม' }
  }
  if (!Array.isArray(input.destinations) || input.destinations.length === 0) {
    return { ok: false, status: 400, error: 'ต้องเลือกปลายทางอย่างน้อย 1 อย่าง' }
  }

  const rows: PlannedRow[] = []
  const pastYamIds: string[] = []

  for (const yam of input.yams) {
    if (!yam.yamId || !yam.yamLabel || !yam.window) {
      return { ok: false, status: 400, error: 'ข้อมูลยามไม่ครบ' }
    }
    const fireAt = computeFireAt(input.date, yam.window)
    if (fireAt === null) {
      return { ok: false, status: 400, error: `วันหรือเวลาของยาม ${yam.yamId} ไม่ถูกต้อง` }
    }
    if (isFireTimePast(fireAt, now)) {
      pastYamIds.push(yam.yamId)
      continue
    }
    rows.push({
      yamId: yam.yamId,
      yamLabel: yam.yamLabel,
      window: yam.window,
      destinations: input.destinations,
      fireAtUtc: fireAt,
    })
  }

  // Any past yam fails the WHOLE batch — atomic + honest (never save some, drop others silently).
  if (pastYamIds.length > 0) {
    return { ok: false, status: 422, error: 'บางยามเลยเวลาแจ้งเตือนแล้ว', pastYamIds }
  }
  return { ok: true, rows }
}
