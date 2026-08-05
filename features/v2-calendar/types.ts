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
// Grade — the ORIGINAL 10-step UI union. Still used by ดวงสมพงศ์ (features/v2-service). The calendar no
// longer keys colours off it: the wire speaks 13 levels and colour now speaks 5 zones (lib/v2/grade-scale.ts,
// มุน M-C 2026-08-05), so nothing here had to widen. COMMENT-ONLY edit — the union below is untouched.
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
  // NOTE — no `grade` here on purpose. The month grid colours cells by dayCellTier(percent), never by a
  // letter grade (grep-verified: MonthGrid/DateSelector don't read it). bazi's day grade is 13-level and
  // the UI `Grade` is 10-level; carrying it on this UNUSED grid field forced a lossy projection (G-0a/G-0b).
  // G-0c removed it (บอง 2026-08-05: "delete, don't widen"). The grade the CARD/detail renders lives on
  // DayDetail.grade (its own path + M-C's 13-level colour work) — not on a grid cell.
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

/**
 * One เสา (column) of a 八字 chart — the DATA a pillar always carries, independent of how a screen draws it.
 * Each 柱 has a 天干 (heavenly stem, top glyph), a 地支 (earthly branch, bottom glyph), and the 五行 (ธาตุ)
 * of that stem. Figma 634:8752 draws the DAY block as 3 layers (stem / branch / ธาตุ); the MAN block draws
 * only the stem glyph — but that is PRESENTATION. The bazi backend sends stem+branch+element for BOTH blocks
 * (four-pillar 八字 is fully populated on both the natal chart and the day chart), so the shape is shared and
 * the UI picks how many layers to render per `kind`. Keeping cells as `string[]` (the old single-glyph form)
 * would drop 2 of 3 layers and force a contract-rewrite at API-time.
 */
export interface PillarCell {
  /** 天干 heavenly stem — the top glyph (e.g. "甲"). */
  stem: string
  /** 地支 earthly branch — the bottom glyph (e.g. "子"). */
  branch: string
  /** 五行 ธาตุof this pillar's stem (ไม้ / ไฟ / ดิน / ทอง / น้ำ). */
  element: string
}

/** One of the pillar blocks in advanced mode (บล็อก 4 เสา: MAN · DAY ...). */
export interface PillarColumn {
  /** heading key — 'man' = เจ้าของดวง · 'day' = วันนี้. */
  kind: 'man' | 'day'
  label: string
  /** the 4 เสา ปี/เดือน/วัน/ยาม — each a full stem/branch/element (MAN draws 1 layer, DAY draws 3). */
  cells: PillarCell[]
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
// ครึ่งล่าง sub-shapes (G-4). Defined HERE (the feature contract) — self-contained, matching the lib
// pipe's shapes (lib/v2-calendar/day-detail); the G-2 adapter maps lib → these. RAW discipline: gates carry
// NO good/bad level and colors stay Thai names (ตำราไม่มีเกณฑ์ = แปลง=แต่งตำรา; μุน decides display).
/** ความเข้ากันรายด้าน — one facet (percent/grade nullable = คิดไม่ได้; grade raw, never re-derived). */
export interface DayDetailArea {
  key: string
  label: string
  percent: number | null
  grade: string | null
  /** ⭐ จุดแข็ง — the main facet (isMain). */
  isStrength: boolean
}
/** 八神 — one of the 8 spirits + its keywords. */
export interface DayDetailSpirit {
  name: string
  keywords: string[]
}
/** 8 ประตู — ชื่อ+ทิศ+ความหมาย ดิบ (❌ no good/bad level — ตำราไม่มี). */
export interface DayDetailGate {
  name: string
  direction: string
  meaning: string
}
/** สีมงคล — ธาตุ → ชื่อสีไทย ดิบ (❌ no hex; งานดีไซน์ μุน). */
export interface DayDetailColor {
  element: string
  colors: string
}
/** ดิถี — ข้อความล้วน (❌ ไม่แปลงเป็นโทนดี/ร้าย — การตีความ ไม่ใช่ข้อมูล). */
export interface DayDetailDithi {
  officer: string
  officerDesc: string
  jianchu: string
}

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

  // ── ครึ่งล่าง (G-4) — เปิดฟิลด์หน้ารายละเอียดวัน ให้ μุน's M-D ย้าย content.ts → detail.* ──
  // กอง 1 (ย้ายตรงๆ — ท่อ day-detail (B-5) มีให้ครบ; sub-types reused from lib/v2-calendar/day-detail):
  /** ความเข้ากันรายด้าน — facets[] (isMain→isStrength). */
  compatAreas: DayDetailArea[]
  /** คำแนะนำของด้านหลัก — facets[].lines[].text (3 บรรทัด). */
  advice: string[]
  /** 💡 บรรทัดสรุปปฏิกิริยาธาตุ — elementRelation.summaryTh. */
  insight: string
  /** เทพประจำวัน — almanac.deity. */
  dayDeity: string
  /** 8 เทพ 八神 + คีย์เวิร์ด — almanac.spirits[]. */
  spirits: DayDetailSpirit[]
  /** แถววันพระ (ค่ำ/เดือน) — almanac.thaiLunar. */
  wanPhra: { isWanPhra: boolean; label: string }
  // กอง 2 (ส่งดิบ — ❌ ห้ามแปลง/ตีความ; ตำราไม่มีเกณฑ์ = แปลง=แต่งตำรา; μุน ตัดสินการแสดงผล):
  /** สีมงคล — ชื่อสีไทย ❌ ไม่แปลงเป็นรหัสสี (งานดีไซน์ μุน). */
  luckyColors: DayDetailColor[]
  /** 8 ประตู — ชื่อ+ทิศ+ความหมาย ❌ ไม่ใส่ระดับดี/ร้าย (ตำราไม่มี). */
  gates: DayDetailGate[]
  /** ดิถี — officer + คำอธิบาย + jianchu เป็นข้อความ ❌ ไม่แปลงเป็นโทนดี/ร้าย. */
  dithi: DayDetailDithi
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
