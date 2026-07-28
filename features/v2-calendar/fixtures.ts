// MuMate v2 — ปฏิทินดวง · MOCK DATA (Phase 0 · layer-2 data that WILL come from an API).
//
// ⚠️ SOURCE / CONFIDENCE (label a guess a guess): the SHAPES here are frozen (they mirror types.ts, the
// contract Lamun binds to). The VALUES (ganzhi/%/grade per day, ยาม copy) are ILLUSTRATIVE and generated
// deterministically — they are NOT yet reconciled cell-by-cell against Figma 375:16710. Exact per-day
// values are reconciled in Lamun's Phase 2 (she owns Figma-truth); the data SHAPE does not change when
// they are. At API-time an adapter fills these same shapes from bazi — hooks/UI stay put.
import type {
  CalendarDay,
  CalendarMonth,
  DayDetail,
  Grade,
  Reminder,
  ReminderList,
  YamSlot,
} from './types'
import { GRADES } from './grade'
import { buildMonthGrid, toISODate } from './month-grid'

/** The mock month the fixtures describe. Fixed (not "today") → deterministic + hydration-safe. */
export const MOCK_YEAR = 2026
export const MOCK_MONTH = 7 // กรกฎาคม 2569

// 60-ganzhi cycle (干支) — used to give each day a plausible, stable อักษรจีน.
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
function ganzhiFor(index: number): string {
  return STEMS[index % 10] + BRANCHES[index % 12]
}

// Deterministic percent spread (no Math.random — stable across renders/SSR). A gentle wave 30..92.
function percentFor(day: number): number {
  const wave = Math.round(50 + 30 * Math.sin(day / 2) + ((day * 7) % 13) - 6)
  return Math.max(28, Math.min(92, wave))
}

// Explicit grade per day, bucketed from percent by a DOCUMENTED illustrative rule (NOT bazi's mapping —
// see grade.ts note). This only decides fixture grades; real grades arrive from bazi at API-time.
function illustrativeGrade(percent: number): Grade {
  // 10 even-ish buckets over 28..92 → an index into GRADES (best→worst).
  const clamped = Math.max(28, Math.min(92, percent))
  const idx = Math.min(9, Math.floor(((92 - clamped) / (92 - 28)) * 10))
  return GRADES[idx]
}

// Deterministic day-generator for ANY (year, month) so the month cursor can navigate (client-truth
// state, real prev/next) instead of showing a single frozen month. Same generators = stable values.
export function generateMonthDays(year: number, month: number): CalendarDay[] {
  const total = new Date(year, month, 0).getDate()
  const cycleSeed = (year * 12 + month) % 60 // stable per-month offset into the ganzhi cycle
  return Array.from({ length: total }, (_, i) => {
    const day = i + 1
    const percent = percentFor(day)
    return {
      date: toISODate(year, month, day),
      day,
      ganzhi: ganzhiFor(cycleSeed + i),
      percent,
      grade: illustrativeGrade(percent),
      isBuddhistDay: day === 10 || day === 24, // 2 mock วันพระ → exercise the #9D85DA ring marker
    }
  })
}

/** The 31 real days of the reference mock month (กรกฎาคม 2569) — used by day-detail + tests. */
export const MOCK_DAYS: CalendarDay[] = generateMonthDays(MOCK_YEAR, MOCK_MONTH)

/** Build a full CalendarMonth for any month; defaults to the reference mock month. */
export function mockCalendarMonth(year: number = MOCK_YEAR, month: number = MOCK_MONTH): CalendarMonth {
  const days = generateMonthDays(year, month)
  return { year, month, weeks: buildMonthGrid(year, month, days), days }
}

// ── ยาม (5 windows/day) — shared by the advanced timeline and the save sheet. ─────────────────────
const YAM_DEFS: Array<Omit<YamSlot, 'grade'>> = [
  { id: 'y1', label: 'ยามมงคล มีลาภผล ทรัพย์สิน', window: '09:00-10:59' },
  { id: 'y2', label: 'ยามก้าวหน้ารุ่งเรือง', window: '19:00-20:59' },
  { id: 'y3', label: 'ยามฟ้าประทาน เทพเจ้าคุ้มครอง', window: '05:00-06:59' },
  { id: 'y4', label: 'ยามพบมิตร เจรจาสำเร็จ', window: '13:00-14:59' },
  { id: 'y5', label: 'ยามพักผ่อน สงบใจ', window: '23:00-00:59' },
]

function mockYams(seedGrade: Grade): YamSlot[] {
  const base = GRADES.indexOf(seedGrade)
  return YAM_DEFS.map((y, i) => ({ ...y, grade: GRADES[Math.min(9, (base + i) % 10)] }))
}

/** Day-detail for any date in the mock month; falls back to day 14 for out-of-range (illustrative). */
export function mockDayDetail(date: string): DayDetail {
  const found = MOCK_DAYS.find((d) => d.date === date) ?? MOCK_DAYS[13]
  return {
    date: found.date,
    day: found.day,
    ganzhi: found.ganzhi,
    percent: found.percent,
    grade: found.grade,
    summary: 'วันนี้เหมาะแก่การเริ่มต้นสิ่งใหม่ ทำงานร่วมกับผู้อื่นได้ราบรื่น',
    suitable: ['ไปที่ทำงาน / สถานศึกษา', 'พบปะเจรจา', 'เริ่มโครงการ'],
    avoid: ['ตัดสินใจเรื่องใหญ่คนเดียว', 'เดินทางไกลช่วงค่ำ'],
    yams: mockYams(found.grade),
    pillars: [
      { kind: 'man', label: 'MAN · เจ้าของดวง', cells: ['庚', '午', found.ganzhi[0] ?? '甲', '寅'] },
      { kind: 'day', label: 'DAY · วันนี้', cells: [found.ganzhi[0] ?? '甲', found.ganzhi[1] ?? '子', '丙', '子'] },
    ],
  }
}

// ── Reminders — the §list "แบบ ข" superset (2 groups). A real list, wired to grow via save-flow. ──
export const MOCK_REMINDERS: Reminder[] = [
  {
    id: 'r1',
    date: toISODate(MOCK_YEAR, MOCK_MONTH, 14),
    yamId: 'y1',
    yamLabel: 'ยามมงคล มีลาภผล ทรัพย์สิน',
    window: '09:00-10:59',
    destinations: ['mumate', 'google'],
    group: 'upcoming',
  },
  {
    id: 'r2',
    date: toISODate(MOCK_YEAR, MOCK_MONTH, 14),
    yamId: 'y2',
    yamLabel: 'ยามก้าวหน้ารุ่งเรือง',
    window: '19:00-20:59',
    destinations: ['mumate'],
    group: 'upcoming',
  },
  {
    id: 'r3',
    date: toISODate(MOCK_YEAR, MOCK_MONTH, 14),
    yamId: 'y3',
    yamLabel: 'ยามฟ้าประทาน เทพเจ้าคุ้มครอง',
    window: '05:00-06:59',
    destinations: ['mumate'],
    group: 'past',
  },
]

export function mockReminderList(): ReminderList {
  const upcoming = MOCK_REMINDERS.filter((r) => r.group === 'upcoming')
  const past = MOCK_REMINDERS.filter((r) => r.group === 'past')
  const all = [...upcoming, ...past]
  return {
    upcoming,
    past,
    totalYams: all.length,
    totalDays: new Set(all.map((r) => r.date)).size,
  }
}
