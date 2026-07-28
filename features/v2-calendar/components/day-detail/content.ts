// MuMate v2 — ปฏิทินดวง · day-detail PRESENTATIONAL content (Lamun-owned · Figma-frozen · screens 2/3).
//
// ⚠️ TODO(API-time · move into goo's DayDetail adapter): the fields below are the day-detail rich content
// the Figma screens 634:8194 (ธรรมดา) / 634:8752 (แอดวานซ์) SHOW but goo's `DayDetail` (features/v2-calendar/
// types.ts) does NOT yet carry — the 4 life-area compatibility rows (§6/§8), the day-insight line (§7), the
// lucky-colour swatches + day-deity (§10). They live here so 3a can render the real screen WITHOUT touching
// goo's contract/hooks tonight (บอง 2026-07-28: content has no invariant/safety-property → Lamun owns it).
// At API-time these become fields on `DayDetail`, filled by the bazi→DayDetail adapter, and the screen swaps
// its import from `getDayFortuneContent(date)` to `detail.*` — a field-move, not a UI rewrite (mask-first).
//
// VALUES are ILLUSTRATIVE + Figma-frozen (verbatim copy read from the reference; lucky-colour hexes SAMPLED
// from the Figma pixels, NOT eyeballed — they are content, not a UI token, so they do not enter DESIGN.md).
// Deterministic + date-independent for now (like goo's mockDayDetail summary), so it is hydration-safe.
import type { Grade, DayCellTier } from '../../types'

/** One row of "ความเข้ากัน 5 ด้าน" (§6) / "คำทำนายรายด้าน" (§8) — a life-area score + its advice. */
export interface CompatArea {
  /** ชื่อด้าน (e.g. "อยู่บ้าน, คุมลูกน้อง, อยู่ในห้อง"). */
  label: string
  /** คะแนนความเข้ากัน 0-100 (drives the %-bar width + the number). */
  percent: number
  /** เกรด 10 ระดับ — tone of the bar / badge (shared GRADE_COLORS). */
  grade: Grade
  /** ⭐ จุดแข็ง — the day's strongest area (the pill in §6). */
  isStrength?: boolean
  /** คำแนะนำ 3 บรรทัด (§8 card body) — bg tinted by grade. */
  advice: string[]
}

/** §9 ดิถีวันนี้ · สะสม — one colored-dot bullet (tone drives the dot color, from DAY_CELL_COLORS). */
export interface DithiBullet {
  text: string
  /** 'good' = mongkol dot · 'bad' = แตกหัก red dot (colors reuse DESIGN.md day-cell tier text). */
  tone: 'good' | 'bad'
}

/** §12 8 ประตู 八門 — one cell of the 3×3 direction grid. */
export interface EightGate {
  /** compass label (NW·N·NE·W·ทิศ W·E·SW·S·SE). */
  dir: string
  /** 門 glyph (驚·開·休·死·財·生·景·杜·傷). */
  char: string
  /** Thai meaning (กลัว·เปิด·พักผ่อน·ตาย·โชคลาภ·เกิด·เสน่ห์·อุดตัน·บาดเจ็บ). */
  thai: string
  /** auspiciousness → cell tint reuses DESIGN.md §CALENDAR day-cell tiers (good/medium/bad). NO new hex. */
  tier: DayCellTier
  /** the day's own direction (財 · ทิศ W) — sapphire-filled highlight (SELECTED), not a tier tint. */
  highlight?: boolean
}

/** §13 8 เทพ 八神 · คีย์เวิร์ด — one deity row. */
export interface EightDeity {
  /** 神 glyph (天·符·蛇·陰·合·陳·雀·地). */
  char: string
  /** Thai name (เทียน·ฟู้·เสอ·อิน·เหอ·เฉิน·เชวี่ย·ตี้). */
  name: string
  /** keyword phrases shown "·"-joined. */
  keywords: string[]
}

/** The day-detail content NOT in goo's DayDetail (see TODO header). Figma-frozen. */
export interface DayFortuneContent {
  /** §3 extra chips beyond ganzhi (ganzhi comes from DayDetail): สะสม · 財 · ทิศ W. */
  chips: string[]
  /** §3 วันพระ row (only when the day is a วันพระ). */
  buddhistDay?: { label: string; deity: string }
  /** §6 + §8 — the 4 life-area rows (name/percent/grade/strength/advice). */
  compatAreas: CompatArea[]
  /** §7 — the 💡 insight line under the compat list. */
  insight: string
  /** §10 — 5 lucky-colour swatches (hex, SAMPLED from Figma pixels — content, not a token). */
  luckyColors: string[]
  /** §10 — เทพประจำวัน. */
  dayDeity: string
  /** §9 [advanced] — ดิถีวันนี้ · สะสม bullets. */
  dithi: DithiBullet[]
  /** §12 [advanced] — 8 ประตู 八門 (9 cells, row-major NW→SE). */
  gates: EightGate[]
  /** §13 [advanced] — 8 เทพ 八神 keywords. */
  deities: EightDeity[]
}

// Figma 634:8194 §6/§7/§8/§10 — verbatim copy. Colours sampled from the reference pixels.
const FROZEN: DayFortuneContent = {
  chips: ['สะสม', '財', 'ทิศ W'],
  buddhistDay: { label: 'แรม ๙ ค่ำ เดือน ๘', deity: 'เจ้าพ่อพระเพลิง' },
  compatAreas: [
    {
      label: 'อยู่บ้าน, คุมลูกน้อง, อยู่ในห้อง',
      percent: 95,
      grade: 'A',
      isStrength: true,
      advice: [
        'การเจรจาและการปรองดองไหลลื่น',
        'เหมาะเปิดใจคุยเรื่องที่ค้างคา',
        'ความสัมพันธ์ใกล้ตัวให้พลังคุณกลับมา',
      ],
    },
    {
      label: 'อยู่กับเพื่อน, พี่น้อง, คู่ครอง',
      percent: 75,
      grade: 'B',
      advice: [
        'งานประจำเดินได้ปกติ',
        'เหมาะสะสางงานค้างมากกว่าเริ่มของใหม่',
        'ผู้ใหญ่ให้การสนับสนุน',
      ],
    },
    {
      label: 'ไปที่ทำงาน, สถานศึกษา, พ่อแม่',
      percent: 55,
      grade: 'C+',
      advice: [
        'พลังตก อาจรู้สึกอึดอัดหรือมีปากเสียงในบ้าน',
        'สั่งงานควรพูดให้ชัด',
        'เลี่ยงตัดสินใจตอนอารมณ์ขึ้น',
      ],
    },
    {
      label: 'ไปลูกค้า, งานสังคม, สื่อ, ต่างถิ่น',
      percent: 42,
      grade: 'C-',
      advice: [
        'ระวังพูดพลาดต่อคนนอก ไม่ใช่วันปิดดีล',
        'เลื่อนงานสังคมใหญ่ออกไปก่อนได้จะดีกว่า',
      ],
    },
  ],
  insight: 'วันนี้พลังแรงสุดตอนอยู่กับ “คนใกล้ตัว” (68%) — เลี่ยงงานที่ต้องออกไปเจอคนแปลกหน้า (45%)',
  luckyColors: ['#FFFCE1', '#FCFF7C', '#ECE79C', '#888888', '#DEDEDE'],
  dayDeity: 'พระกษิติครรภ์',
  // §9 — dot tone reuses DAY_CELL_COLORS (good=teal · bad=red); no new hex.
  dithi: [
    { text: 'สะสม', tone: 'good' },
    { text: 'ลาภผล โชคลาภ ตำแหน่งดี', tone: 'good' },
    { text: 'แตกหัก', tone: 'bad' },
  ],
  // §12 — row-major NW→SE. tiers read from Figma pixel tints (≈ DESIGN.md day-cell good/medium/bad); the
  // day's direction 財/ทิศ W is the sapphire highlight. Every colour is a DESIGN.md token — no new hex.
  gates: [
    { dir: 'NW', char: '驚', thai: 'กลัว', tier: 'bad' },
    { dir: 'N', char: '開', thai: 'เปิด', tier: 'good' },
    { dir: 'NE', char: '休', thai: 'พักผ่อน', tier: 'good' },
    { dir: 'W', char: '死', thai: 'ตาย', tier: 'bad' },
    { dir: 'ทิศ W', char: '財', thai: 'โชคลาภ', tier: 'good', highlight: true },
    { dir: 'E', char: '生', thai: 'เกิด', tier: 'good' },
    { dir: 'SW', char: '景', thai: 'เสน่ห์', tier: 'medium' },
    { dir: 'S', char: '杜', thai: 'อุดตัน', tier: 'bad' },
    { dir: 'SE', char: '傷', thai: 'บาดเจ็บ', tier: 'bad' },
  ],
  // §13 — 8 神 keywords.
  deities: [
    { char: '天', name: 'เทียน', keywords: ['วิสัยทัศน์', 'ดำเนินการตามแผน', 'สร้างเครือข่ายใหม่'] },
    { char: '符', name: 'ฟู้', keywords: ['เพิ่มขวัญกำลังใจ', 'ประสบความสำเร็จ', 'ฝันเป็นจริง'] },
    { char: '蛇', name: 'เสอ', keywords: ['เหนือธรรมชาติ', 'จัดฉาก', 'สร้างเสน่ห์', 'เวทมนตร์'] },
    { char: '陰', name: 'อิน', keywords: ['กลอุบาย', 'เคล็ดลับ', 'ความในใจ', 'ข้อมูลสำคัญ'] },
    { char: '合', name: 'เหอ', keywords: ['เยียวยา', 'เครือข่าย', 'ปรองดอง', 'ทำงานร่วมกัน'] },
    { char: '陳', name: 'เฉิน', keywords: ['ลิขสิทธิ์', 'ฟ้องร้องคดีความ', 'ทวงหนี้'] },
    { char: '雀', name: 'เชวี่ย', keywords: ['โฆษณา', 'การตลาด', 'เจรจา', 'โน้มน้าว'] },
    { char: '地', name: 'ตี้', keywords: ['วางโครงสร้าง', 'มั่นคงในธุรกิจ', 'ลงทุนเน้นคุณค่า'] },
  ],
}

/**
 * Day-detail rich content for a date. Illustrative + date-independent for now (Figma-frozen), mirroring
 * goo's `mockDayDetail` discipline. At API-time this whole object folds into the bazi→DayDetail adapter.
 */
export function getDayFortuneContent(_date: string): DayFortuneContent {
  return FROZEN
}
