// MuMate v2 — ปฏิทินดวง · Phase 0 DATA/STATE contract (goo · logic-only, NO UI, NO network).
//
// This file is the single source of the SHAPES the 6 calendar screens bind to. The rule the whole
// frame turns on: "ยังไม่ต่อ API" ≠ "ไม่มี state" — six screens are wired by { เดือนที่ดู · วันที่คลิก ·
// โหมด · ยามที่ติ๊ก · บันทึกแล้วหรือยัง }. Phase 0 hands Lamun mock hooks whose shape MATCHES the real
// API-fed shape, so at API-time we swap only the data source (an adapter) and the UI never changes.
//
// SHAPE DISCIPLINE (ฟีม's "หน้ากากก่อน" + goo's two-layer split):
//   • layer 1 — CLIENT-TRUTH state (month cursor, day selection, advanced toggle, reminder draft, ยาม
//     checkboxes): never touches a backend even at API-time → safe to lock here 100%.
//   • layer 2 — DATA that WILL come from an API (month grid ganzhi/%/grade, day detail, reminder list):
//     mocked now, but every field below is derived from what the UI must SHOW (Figma-frozen), NOT from a
//     guessed backend schema. At API-time an adapter maps backend→these shapes; hooks/UI stay put.

// ─────────────────────────────────────────────────────────────────────────────
// Grade — the 10-step scale shared by ring / badge / %-bar / calendar cell (DESIGN.md §GRADE).
// The LABELS are ground-truth (DESIGN.md). The grade→% mapping is bazi's ground-truth and is NOT
// invented here (see grade.ts) — a day fixture carries its grade EXPLICITLY.
// ─────────────────────────────────────────────────────────────────────────────
export type Grade = 'A' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-'

/** Calendar day-cell tint tier (DESIGN.md §CALENDAR day-cell). Thresholds are authoritative; colors are Lamun's. */
export type DayCellTier = 'good' | 'medium' | 'bad'

// ─────────────────────────────────────────────────────────────────────────────
// Month view (screen 1 · node 375:16710)
// ─────────────────────────────────────────────────────────────────────────────

/** One cell of the month grid: เลขวัน + อักษรจีน(ganzhi) + % + เกรด + สี-tier. */
export interface CalendarDay {
  /** ISO date `YYYY-MM-DD` (Asia/Bangkok calendar day) — the routing key for /v2/calendar/[date]. */
  date: string
  /** วันที่ (1-31). */
  day: number
  /** อักษรจีนของวัน — ganzhi 干支 (e.g. "甲子"). */
  ganzhi: string
  /** คะแนนดวงวัน 0-100. */
  percent: number
  /** เกรด 10 ระดับ (carried explicitly; not computed from percent — see grade.ts). */
  grade: Grade
  /** วันพระ (ไทย/จีน) — drives the #9D85DA ring marker. */
  isBuddhistDay?: boolean
  /** true when this cell is NOT part of the displayed month (leading/trailing padding). */
  isPadding?: boolean
}

/** A whole month: cursor + the 6×7 grid (weeks) + score summary card. */
export interface CalendarMonth {
  /** Year in CE. */
  year: number
  /** Month 1-12. */
  month: number
  /** Weeks, each a length-7 array (Sun..Sat), padded with isPadding cells. */
  weeks: CalendarDay[][]
  /** Flat list of the real (non-padding) days — convenience for consumers. */
  days: CalendarDay[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Day detail (screens 2/3 · nodes 634:8194 ธรรมดา · 634:8752 แอดวานซ์)
// ─────────────────────────────────────────────────────────────────────────────

/** One of the 4 pillars in advanced mode (บล็อก 4 เสา: MAN · DAY ...). */
export interface PillarColumn {
  /** heading key — 'man' = เจ้าของดวง · 'day' = วันนี้. */
  kind: 'man' | 'day'
  label: string
  /** the 4 stems/branches shown top→bottom (ปี/เดือน/วัน/ยาม). */
  cells: string[]
}

/** A ยาม window (5 per day) — the checkbox rows in the save sheet + the advanced timeline. */
export interface YamSlot {
  /** stable id `y1`..`y5` — the reminder-draft toggles key off this. */
  id: string
  /** ชื่อยามมงคล (e.g. "ยามมงคล มีลาภผล ทรัพย์สิน"). */
  label: string
  /** ช่วงเวลา `HH:MM-HH:MM`. */
  window: string
  /** grade of this ยาม (tone of the row). */
  grade: Grade
}

/** Full day-detail payload (screens 2/3). Advanced-only fields are optional. */
export interface DayDetail {
  date: string
  day: number
  ganzhi: string
  percent: number
  grade: Grade
  /** headline สรุปดวงวัน. */
  summary: string
  /** เหมาะกับวันนี้ / ควรเลี่ยง. */
  suitable: string[]
  avoid: string[]
  /** ยาม 5 ช่วง (used by both the timeline and the save sheet). */
  yams: YamSlot[]
  /** advanced-mode pillars (บล็อก 4 เสา) — present but hidden when the toggle is off. */
  pillars?: PillarColumn[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminders (screens 5/6 · sheet 375:13316 · list 636:10221)
// ─────────────────────────────────────────────────────────────────────────────

/** ปลายทางการแจ้งเตือน (toggle 3 ตัวใน sheet). */
export type ReminderDestination = 'mumate' | 'google' | 'apple'

/** A saved reminder (one row in the "การแจ้งเตือนทั้งหมด" list). */
export interface Reminder {
  id: string
  /** which day + ยาม this reminder is for. */
  date: string
  yamId: string
  yamLabel: string
  window: string
  destinations: ReminderDestination[]
  /** 'upcoming' = กำลังจะถึง · 'past' = เตือนไปแล้ว (จางลง). The §list superset uses exactly 2 groups. */
  group: 'upcoming' | 'past'
}

/** Grouped reminder list — the §list "แบบ ข" superset. แบบ ก degrades to a single fixed row. */
export interface ReminderList {
  upcoming: Reminder[]
  past: Reminder[]
  /** แถบสรุป: "ตั้งแจ้งเตือนแล้ว · N ยาม · M วัน". */
  totalYams: number
  totalDays: number
}
