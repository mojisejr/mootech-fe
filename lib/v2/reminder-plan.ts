// MuMate v2 · reminder commit PLANNER (goo · #287). PURE — the write DECISION, no DB — so every rule
// (empty draft, malformed input, ตั้งย้อนหลัง, atomic batch) is unit-testable without a server. The API
// handler stays a thin shell: resolve identity → gate membership → plan() → one transactional insert.

import { computeFireAt, computeCustomFireAt, normalizeTime, isFireTimePast } from './reminder-time'

export interface YamInput {
  yamId: string
  yamLabel: string
  window: string // "HH:MM-HH:MM"
}

/** ตั้งเวลาเอง (free-time reminder) — a user-picked HH:MM + an optional note, not tied to a ยาม window. */
export interface CustomInput {
  time: string // "HH:MM"
  note?: string
}

export interface CommitInput {
  date: string // "YYYY-MM-DD" (ยาม START's BKK day)
  yams: YamInput[]
  /** free-time reminders — modelled as synthetic ยาม rows (id `c<HHMM>`, window "HH:MM-HH:MM") so the DB
   *  schema, DTO, cron and list are all unchanged. Fire is the EXACT time (no 30-min lead). */
  custom?: CustomInput[]
  destinations: string[]
}

/** Synthetic ยาม id for a free-time reminder: `c` + HHMM (e.g. "07:30" → "c0730"). ≤8 chars (yam_id col). */
export function customYamId(time: string): string | null {
  const t = normalizeTime(time)
  return t === null ? null : `c${t.replace(':', '')}`
}

const CUSTOM_DEFAULT_LABEL = 'แจ้งเตือนที่ตั้งเอง'

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
  const yams = Array.isArray(input.yams) ? input.yams : []
  const custom = Array.isArray(input.custom) ? input.custom : []
  // ต้องมีอย่างน้อย 1 รายการ — ยามที่ติ๊ก หรือ เวลาที่ตั้งเอง (อย่างใดอย่างหนึ่งก็พอ)
  if (yams.length === 0 && custom.length === 0) {
    return { ok: false, status: 400, error: 'ต้องเลือกอย่างน้อย 1 ยาม หรือ ตั้งเวลาเอง 1 รายการ' }
  }
  if (!Array.isArray(input.destinations) || input.destinations.length === 0) {
    return { ok: false, status: 400, error: 'ต้องเลือกปลายทางอย่างน้อย 1 อย่าง' }
  }

  const rows: PlannedRow[] = []
  const pastYamIds: string[] = []

  // ── free-time reminders (ตั้งเวลาเอง) — synthetic ยาม, fire = exact time (no lead). Same atomic rules. ──
  for (const c of custom) {
    const id = customYamId(c.time)
    const t = normalizeTime(c.time)
    if (id === null || t === null) {
      return { ok: false, status: 400, error: 'เวลาที่ตั้งเองไม่ถูกต้อง' }
    }
    const fireAt = computeCustomFireAt(input.date, c.time)
    if (fireAt === null) {
      return { ok: false, status: 400, error: `วันหรือเวลา ${c.time} ไม่ถูกต้อง` }
    }
    if (isFireTimePast(fireAt, now)) {
      pastYamIds.push(id)
      continue
    }
    rows.push({
      yamId: id,
      yamLabel: (c.note ?? '').trim() || CUSTOM_DEFAULT_LABEL,
      window: `${t}-${t}`, // start==end ⇒ display shows the single time; not re-parsed after insert
      destinations: input.destinations,
      fireAtUtc: fireAt,
    })
  }

  for (const yam of yams) {
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
