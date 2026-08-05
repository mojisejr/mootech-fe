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
  PillarCell,
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

// 五行 (ธาตุ) of each 天干 — the illustrative pillar cells derive `element` from `stem` so a fixture cell is
// never internally inconsistent (a mut that mislabels element is caught by the shape test). Real element
// arrives from bazi at API-time; this map only keeps the MOCK coherent (like illustrativeGrade for grade).
const STEM_ELEMENT: Record<string, string> = {
  甲: 'ไม้', 乙: 'ไม้', 丙: 'ไฟ', 丁: 'ไฟ', 戊: 'ดิน',
  己: 'ดิน', 庚: 'ทอง', 辛: 'ทอง', 壬: 'น้ำ', 癸: 'น้ำ',
}

/** Build one illustrative 八字 pillar cell — element is derived from the stem so it can never contradict it. */
function pillarCell(stem: string, branch: string): PillarCell {
  return { stem, branch, element: STEM_ELEMENT[stem] ?? 'ดิน' }
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
      grade: illustrativeGrade(percent), // G-2: grade back on the cell (for the ring's จังหวะ-1). Mock uses a
      // 10-level Grade (a subset of the 13-level string) — the real 13-level arrives from bazi at wiring.
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
const YAM_DEFS: YamSlot[] = [
  { id: 'y1', label: 'ยามมงคล มีลาภผล ทรัพย์สิน', window: '09:00-10:59' },
  { id: 'y2', label: 'ยามก้าวหน้ารุ่งเรือง', window: '19:00-20:59' },
  { id: 'y3', label: 'ยามฟ้าประทาน เทพเจ้าคุ้มครอง', window: '05:00-06:59' },
  { id: 'y4', label: 'ยามพบมิตร เจรจาสำเร็จ', window: '13:00-14:59' },
  { id: 'y5', label: 'ยามพักผ่อน สงบใจ', window: '23:00-00:59' },
]

// Yams carry NO grade/tone (cut G-2 — bazi's luckyHours emits none). Just the defs, fresh copies.
function mockYams(): YamSlot[] {
  return YAM_DEFS.map((y) => ({ ...y }))
}

/**
 * Day-detail for ANY date — generated from the REQUESTED date's own month, so selecting 2026-08-05 returns
 * 2026-08-05. It must never borrow another day's identity: the old `?? MOCK_DAYS[13]` fell back to July 14
 * (MOCK_DAYS is the fixed July fixture) and returned `date: <July-14>`, so an August selection would print
 * "14 กรกฎาคม" silently (บอง's second-day-14 catch 2026-08-05). A malformed/empty date keeps the requested
 * date with neutral illustrative fields — never a different day. (Real day-detail arrives at G-4 wiring.)
 */
export function mockDayDetail(date: string): DayDetail {
  const [gy, gm] = date.split('-').map(Number)
  const genDay =
    Number.isFinite(gy) && Number.isFinite(gm) ? generateMonthDays(gy, gm).find((d) => d.date === date) : undefined
  const found: CalendarDay = genDay ?? { date, day: Number(date.slice(8, 10)) || 0, ganzhi: '', percent: 0, grade: '' }
  // DayDetail keeps its own `grade` (the card ring — a 10-level UI Grade). Since the grid cell no longer
  // carries grade (G-0c), derive the mock's illustrative grade from percent here (mock-only bucketer; the
  // real grade arrives from bazi at G-4). This is NOT the grid's colour source (that is dayCellTier).
  const grade = illustrativeGrade(found.percent)
  return {
    date: found.date,
    day: found.day,
    ganzhi: found.ganzhi,
    percent: found.percent,
    grade,
    summary: 'วันนี้เหมาะแก่การเริ่มต้นสิ่งใหม่ ทำงานร่วมกับผู้อื่นได้ราบรื่น',
    suitable: ['ไปที่ทำงาน / สถานศึกษา', 'พบปะเจรจา', 'เริ่มโครงการ'],
    avoid: ['ตัดสินใจเรื่องใหญ่คนเดียว', 'เดินทางไกลช่วงค่ำ'],
    yams: mockYams(),
    pillars: [
      {
        kind: 'man',
        label: 'MAN · เจ้าของดวง',
        // natal 4 เสา (fixed) — ปี/เดือน/วัน/ยาม. Illustrative; MAN block draws only the stem glyph in Figma
        // but the data is full stem/branch/element so DAY and API-time share one shape.
        cells: [pillarCell('庚', '午'), pillarCell('戊', '寅'), pillarCell('甲', '子'), pillarCell('丙', '寅')],
      },
      {
        kind: 'day',
        label: 'DAY · วันนี้',
        // the day's 4 เสา — the วัน pillar uses the day's real ganzhi glyphs; the rest are illustrative.
        cells: [
          pillarCell('壬', '辰'),
          pillarCell('丁', '未'),
          pillarCell(found.ganzhi[0] ?? '甲', found.ganzhi[1] ?? '子'),
          pillarCell('丙', '子'),
        ],
      },
    ],
    // ── ครึ่งล่าง (G-4) — illustrative. Real values arrive from the day-detail pipe (mapDayDetail). กอง 1: ──
    compatAreas: [
      { key: 'home', label: 'ในบ้าน', percent: 68, grade: 'B', isStrength: true },
      { key: 'companions', label: 'มิตรสหาย', percent: 55, grade: 'C+', isStrength: false },
      { key: 'workplace', label: 'ที่ทำงาน', percent: 72, grade: 'B', isStrength: false },
      { key: 'outside', label: 'นอกบ้าน', percent: 48, grade: 'C', isStrength: false },
    ],
    advice: [
      'เริ่มงานใหม่ช่วงเช้าได้ผลดี',
      'ปรึกษาผู้ใหญ่ก่อนตัดสินใจเรื่องเงิน',
      'เลี่ยงการต่อรองสำคัญช่วงค่ำ',
    ],
    insight: 'ธาตุของวันส่งเสริมธาตุเจ้าของดวง เอื้อต่อการเริ่มต้นและการร่วมมือ',
    dayDeity: 'เทพเจ้าฟ้าประทาน',
    spirits: [
      { name: 'เทพมงคล', keywords: ['ลาภผล', 'ทรัพย์สิน'] },
      { name: 'เทพก้าวหน้า', keywords: ['เลื่อนขั้น', 'รุ่งเรือง'] },
      { name: 'เทพเมตตา', keywords: ['ผู้ใหญ่เอ็นดู'] },
      { name: 'เทพเจรจา', keywords: ['พบมิตร', 'สำเร็จ'] },
      { name: 'เทพวิชา', keywords: ['เรียนรู้', 'สอบผ่าน'] },
      { name: 'เทพสุขภาพ', keywords: ['พักผ่อน', 'ฟื้นตัว'] },
      { name: 'เทพระวัง', keywords: ['อุปสรรค'] },
      { name: 'เทพแตกหัก', keywords: ['ขัดแย้ง', 'เดียวดาย'] },
    ],
    wanPhra: {
      isWanPhra: found.isBuddhistDay ?? false,
      label: found.isBuddhistDay ? 'วันพระ · ขึ้น ๘ ค่ำ เดือน ๙' : '',
    },
    // กอง 2 — ดิบ (❌ ไม่แปลง): สีไทย · ประตูไม่มีระดับ · ดิถีข้อความ
    luckyColors: [
      { element: 'ไม้', colors: 'เขียว' },
      { element: 'น้ำ', colors: 'ฟ้า น้ำเงิน ดำ' },
    ],
    // REAL row from bazi's own almanac table, not typed by hand (มุน 2026-08-06, ตู๋'s catch):
    // bazi-testenv/src/lib/bazi/data/almanac/day-month-table.json stores [glyph, direction] pairs and the
    // direction is a SHORT COMPASS CODE. The previous fixture used Thai phrases AND repeated ทิศตะวันออก
    // while dropping ทิศตะวันตกเฉียงเหนือ entirely — 8 gates over 7 directions, which cannot fill a compass:
    // one gate lands on another, one square stays empty, silently. A fixture that disagrees with the
    // backend it stands in for makes every test that runs on it prove the wrong thing.
    // Meanings are gate-legend.json verbatim, for the same reason.
    gates: [
      { name: '開', direction: 'NE', meaning: 'เปิด' },
      { name: '休', direction: 'E', meaning: 'พักผ่อน' },
      { name: '生', direction: 'SE', meaning: 'เกิด' },
      { name: '傷', direction: 'S', meaning: 'บาดเจ็บ' },
      { name: '杜', direction: 'SW', meaning: 'อุดตัน' },
      { name: '景', direction: 'W', meaning: 'เสน่ห์' },
      { name: '死', direction: 'NW', meaning: 'ตาย' },
      { name: '驚', direction: 'N', meaning: 'กลัว' },
    ],
    dithi: { officer: 'สะสาง', officerDesc: 'อับโชค เสียหาย เดียวดาย ทุกข์โศก', jianchu: '除 · ปัดกวาดสิ่งเก่า' },
    // lucky_dir is its OWN vocabulary — 'ทิศ ' + short code (real values in the almanac data are
    // ทิศ N · ทิศ S · ทิศ E · ทิศ W · ทิศ SE). Different shape from gates[].direction; both are read.
    luckyDirection: 'ทิศ SE', // G-3 chip (raw ตำรา); chip 財 ตัดทิ้ง (8 ประตูไม่มี 財)
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
