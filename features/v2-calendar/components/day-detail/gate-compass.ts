// features/v2-calendar/components/day-detail/gate-compass.ts — where each of the 8 gates sits in the 3×3.
//
// THE 3×3 IS A COMPASS, NOT A GRID. Every gate the pipe sends carries a `direction`, and on a real payload
// the 8 directions are exactly the 8 compass points with no repeats. So the position of a gate is DATA the
// pipe already gave us, and reading it lets the screen answer the question the feature is actually for —
// "which way should I go today, and which way should I avoid" — instead of just listing eight names.
//
// WHY THIS FILE EXISTS AT ALL (มุน 2026-08-06). The shipped EightGates laid cells out by ARRAY ORDER:
// `gates.map(...)` into a `grid-cols-3`, with `dir` rendered as a caption. It looked right only because the
// frozen content.ts array happened to be in the order Figma drew. Opening Figma 634:8752 §12 and comparing
// it cell-by-cell against a real payload showed every single gate at the ANTIPODE of where the pipe puts it
// — a clean 180° point reflection across all eight, between two dates 23 days apart. The gates ROTATE daily.
// What Figma drew was 14 July's fortune, not a layout. Copying those positions freezes one day's reading
// forever, inverted, and points a user at the death gate with complete confidence.
//
// And a human cannot catch it: the direction caption travels INSIDE the cell with the glyph, so a scrambled
// board still reads correct to anyone reading captions and wrong to anyone reading position. One widget,
// two answers, nothing red.
//
// The fix is to remove the freedom rather than watch it. Position comes from ONE table applied as explicit
// grid coordinates, so array order and JSX order cannot move anything, and CI asserts that the table agrees
// with what a compass MEANS (scripts/gate-compass.test.ts). A bijection check is not enough — the inverted
// table is also a bijection.
//
// ⭐ WHY INDEX-BASED PLACEMENT IS A TRAP AND NOT MERELY A RISK (ตู๋ asked the right question; the answer is
// in bazi's own table, 209 well-formed rows in day-month-table.json):
//
//     GLYPH order      — ONE distinct order across all 209 rows: 開 休 生 傷 杜 景 死 驚
//     DIRECTION order  — EIGHT distinct orders: the same eight points, rotated
//
// The array IS always sorted — by the classical gate SEQUENCE, not by direction. So `gates[i] → cell[i]`
// produces a board where each glyph sits at a fixed square forever and the compass never turns: correct on
// the one rotation that happens to match, wrong on the other seven. And the caption moves with the glyph,
// so it looks right every single day.
//
// It also explains the 180° I measured between Figma and a live payload: those two days were four rotations
// apart, and four of eight is a half-turn. Not a mysterious mirror — one step of a wheel that turns daily.
//
// ⚠️ WHAT IS STILL UNGUARDED, STATED PLAINLY (ตู๋ demonstrated it 2026-08-06 — do not read the green ticks
// as coverage):
//
//     DELETE the two `gridRow` / `gridColumn` lines from EightGates.tsx and the board is wrong on 7 days in
//     8 — while tsc passes, all 55 assertions here pass, every scripts test passes, and the capture log is
//     identical to the character.
//
// Because this file's test reads the TABLE and the component reads the TABLE, and NOTHING checks that the
// component still applies it. The table being correct is not the same claim as the board being correct, and
// only the second one is what a user sees. My earlier note said "revisit if anyone touches the CSS of this
// grid" — that was watching the wrong door: the failure path is deleting a prop in the TSX, and CSS never
// enters it.
//
// NOT DONE, ON PURPOSE (บอง 2026-08-06, after ฟีม flagged that we were writing 1.7× more harness than
// product — a deadline call, not a judgement that these are unnecessary):
//   • DOM-layer check — render EightGates and assert the glyph inside [data-dir="NW"] sits at the NW grid
//     coordinates. THIS is the layer that closes the hole above, and it is the cheap one.
//   • Browser geometry check (each cell's bbox centre falls in the octant its direction names) + its
//     mut-rtl-flip tooth — catches a CSS inversion (`direction: rtl`, `rotate(180deg)`, `order`), which has
//     never happened here.
//   REVISIT IF: anyone edits EightGates.tsx's cell placement AT ALL (the style props, the element, the
//   grid container), or touches this grid's CSS, or a wrong-direction bug reaches a real screen. The
//   DOM layer is the one to add first — it is what would have caught ตู๋'s two-line deletion.
import type { DayDetailGate } from '../../types'

/** The 8 compass points, in the order a reader scans the board (row-major from the top-left). */
export const DIRECTIONS = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE'] as const
export type Direction = (typeof DIRECTIONS)[number]

/** 1-based grid coordinates. The centre (2,2) belongs to no gate — it is where the reader stands. */
export type Cell = { row: 1 | 2 | 3; col: 1 | 2 | 3 }

/** The centre. Deliberately NOT a gate slot: ฟีม cut 財 because the classics have no ninth gate. */
export const CENTER: Cell = { row: 2, col: 2 }

/**
 * The one table. SOUTH is up, NORTH is down — the Chinese luopan / feng-shui convention the shifu requires
 * (南上北下), NOT the Western map. So this table is the 180° point reflection of a Western north-up grid:
 * south half on top, north half on the bottom, EAST on the LEFT, WEST on the RIGHT. The reader's fixed frame:
 *     SE  S  SW
 *     E   ·  W        (· = the centre, where the reader stands — no gate)
 *     NE  N  NW
 * ⚠️ HISTORY (มุน/ตู๋ 2026-08 → shifu 2026-09-12): earlier this table was north-up and the test called the
 * 180° reflection "the shipped bug". The shifu then specified the luopan orientation is the correct one for
 * this feature (ฮวงจุ้ยธรรมชาติจักรวาล — ทิศใต้อยู่บน ทิศเหนืออยู่ล่าง เสมอ), so what was once the bug is now
 * the intended layout, and the north-up table is now what the test refuses. The gates/deities still ROTATE
 * daily by their `direction` data; only the fixed screen-frame changed. The test asserts this orientation.
 */
export const DIR_CELL: Record<Direction, Cell> = {
  SE: { row: 1, col: 1 },
  S: { row: 1, col: 2 },
  SW: { row: 1, col: 3 },
  E: { row: 2, col: 1 },
  W: { row: 2, col: 3 },
  NE: { row: 3, col: 1 },
  N: { row: 3, col: 2 },
  NW: { row: 3, col: 3 },
}

/**
 * SETTLED FROM THE SOURCE DATA (มุน 2026-08-06, บอง asked for the raw values rather than my paraphrase):
 * bazi-testenv/src/lib/bazi/data/almanac/day-month-table.json stores gate rows as [glyph, direction] pairs
 * and the direction is a SHORT COMPASS CODE —
 *     [["開","NE"],["休","E"],["生","SE"],["傷","S"],["杜","SW"],["景","W"],["死","NW"],["驚","N"]]
 * Across all 212 rows: 209 carry exactly the 8 codes, 8 distinct, ZERO rows repeat a direction. (The other
 * 3 hold 八神 keywords where directions should be — a column-shift the engine already guards at
 * almanac-engine.ts:356.) `lucky_dir` is its own shape: 'ทิศ ' + the same short code ('ทิศ SE', 'ทิศ N').
 *
 * TWO FORMS ARE ACCEPTED, AND ONLY TWO — because only two have a real producer. An earlier version also
 * read full Thai phrases ('ทิศตะวันออกเฉียงเหนือ'), which appear in exactly three places in this repo and
 * all three are FAKE (the fixture and two tests, now repaired). ตู๋'s objection is the same family we spent
 * the day killing: a parser branch with no producer does not add tolerance, it converts a LOUD failure into
 * a SILENT pass, so bad fake data sails through and nothing ever tells us the branch is dead.
 */
export function normalizeDirection(raw: string | null | undefined): Direction | null {
  if (typeof raw !== 'string') return null
  // strips the 'ทิศ ' that lucky_dir carries; gates[].direction has no prefix. Nothing else is tolerated.
  const up = raw.trim().replace(/^ทิศ\s*/, '').replace(/\s+/g, '').toUpperCase()
  return (DIRECTIONS as readonly string[]).includes(up) ? (up as Direction) : null
}

/** Thai names for the eight points — the board is read by a Thai speaker, not by a compass rose. */
export const DIR_LABEL_TH: Record<Direction, string> = {
  N: 'เหนือ', NE: 'อีสาน', E: 'ตะวันออก', SE: 'อาคเนย์',
  S: 'ใต้', SW: 'หรดี', W: 'ตะวันตก', NW: 'พายัพ',
}

/**
 * A direction as a Thai reader should see it. Falls back to the RAW string when it cannot be read, because
 * a direction we failed to parse is still information the user can act on — better a strange word than a
 * missing one. (Caught by looking at the render: the chip was showing a bare "NE" on a Thai screen.)
 */
export function directionLabelTH(raw: string | null | undefined): string {
  const d = normalizeDirection(raw)
  return d ? DIR_LABEL_TH[d] : (raw ?? '').trim()
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// สีตามธาตุของทิศ + ความเข้มตามการตรงกันของพลัง (ผู้ใช้/ซินแส 2026-09-12)
//
// คนละมิติกับ "ดี/ร้าย" ที่ตำราไม่มีสำหรับ 8 ประตู — อันนี้คือ "ธาตุของทิศ" (五行 ประจำทิศ คงที่) เป็นสีพื้นช่อง
// และถ้าธาตุของ ประตู(八門) + เทพ(十神) + ทิศ ตรงกันทั้งสาม = พลังเสริมกัน → เฉดเข้มขึ้น (bgStrong) + ป้าย "พลังแรง".
// สีพื้นมาจาก "ทิศ" เท่านั้น (ตามรูปวาดมือ: E/SE เขียว, S แดง, NE/SW น้ำตาล, W/NW ขาว-เทา, N ดำ-น้ำเงิน);
// GATE_TINT เดิม (สีตามหมวดประตู) ถูกแทนที่ด้วยสีธาตุทิศนี้. ชื่อเทพยังทาสีด้วย SPIRIT_STYLE.ink (พลังเทพ) ตามเดิม.
export type ElementTh = 'ไม้' | 'ไฟ' | 'ดิน' | 'ทอง' | 'น้ำ'

/** ธาตุประจำทิศ (คงที่) — 五行 ของทิศทั้ง 8 ตามฮวงจุ้ยธรรมชาติ (ทิศไม่หมุน; ประตู/เทพหมุนเข้าช่อง). */
export const DIR_ELEMENT: Record<Direction, ElementTh> = {
  E: 'ไม้', SE: 'ไม้',
  S: 'ไฟ',
  SW: 'ดิน', NE: 'ดิน',
  W: 'ทอง', NW: 'ทอง',
  N: 'น้ำ',
}

/** ธาตุ → เฉดสี 2 ระดับ. base = ปกติ, strong = เมื่อธาตุ ประตู+เทพ+ทิศ ตรงกันทั้งสาม → "เข้มขึ้นชัดเจน"
 *  (ผู้ใช้ 2026-09-12: บอกความแรงด้วย "สีเข้มขึ้น" อย่างเดียว ไม่ใช้ไอคอน ⚡). ink = สีตัวอักษรประตู. */
export const ELEMENT_TINT: Record<ElementTh, { bg: string; bgStrong: string; ink: string }> = {
  'ไม้': { bg: '#EAF7EC', bgStrong: '#9FD4B0', ink: '#2C8A4B' }, // เขียว (wood)
  'ไฟ': { bg: '#FDECE9', bgStrong: '#F0A093', ink: '#CD3D2E' }, // แดง (fire)
  'ดิน': { bg: '#FEF3E5', bgStrong: '#E7C083', ink: '#B47E35' }, // น้ำตาล/ครีม (earth)
  'ทอง': { bg: '#F3F4F6', bgStrong: '#C0C7D1', ink: '#5B6570' }, // ขาว-เทา (metal)
  'น้ำ': { bg: '#EAEFF6', bgStrong: '#A2BAD9', ink: '#2A3F5F' }, // ดำ-น้ำเงิน (water)
}

/** ธาตุของ 8 ประตู 八門 (五行 คลาสสิก). */
export const GATE_ELEMENT: Record<string, ElementTh> = {
  '開': 'ทอง', '驚': 'ทอง', // 金
  '休': 'น้ำ', // 水
  '生': 'ดิน', '死': 'ดิน', // 土
  '傷': 'ไม้', '杜': 'ไม้', // 木
  '景': 'ไฟ', // 火
}

/** ธาตุของ 10 เทพ 十神/八神 (五行 คลาสสิก) — เจ้าของยืนยัน "ทำตามนั้น" 2026-09-12 (ใช้ค่าคลาสสิก คุมความเข้มของสี). */
export const DEITY_ELEMENT: Record<string, ElementTh> = {
  '符': 'ดิน', '陳': 'ดิน', '地': 'ดิน', // 值符/勾陳/九地 = 土
  '蛇': 'ไฟ', '雀': 'ไฟ', // 螣蛇/朱雀 = 火
  '陰': 'ทอง', '虎': 'ทอง', '天': 'ทอง', // 太陰/白虎/九天 = 金
  '合': 'ไม้', // 六合 = 木
  '玄': 'น้ำ', // 玄武 = 水
}

/** สีพื้น/เฉด ของช่องประตูหนึ่งช่อง: พื้นตามธาตุทิศ, เข้มขึ้นเมื่อธาตุ ประตู+เทพ+ทิศ ตรงกันทั้งสาม. */
export function cellElementTint(
  direction: Direction,
  gateGlyph: string | null | undefined,
  deityGlyph: string | null | undefined,
): { bg: string; ink: string; element: ElementTh; strong: boolean } {
  const element = DIR_ELEMENT[direction]
  const t = ELEMENT_TINT[element]
  const gateEl = gateGlyph ? GATE_ELEMENT[gateGlyph.trim()] : undefined
  const deityEl = deityGlyph ? DEITY_ELEMENT[deityGlyph.trim()] : undefined
  const strong = gateEl === element && deityEl === element
  return { bg: strong ? t.bgStrong : t.bg, ink: t.ink, element, strong }
}

export type PlacedGate = { direction: Direction; cell: Cell; gate: DayDetailGate }

/**
 * Place the gates on the board. Returns the unplaced ones as well — the caller must not be able to lose a
 * gate without noticing, which is how a board silently ends up with seven.
 */
export function placeGates(gates: DayDetailGate[] | null | undefined): {
  placed: PlacedGate[]
  /** gates whose direction was unreadable or duplicated — rendered as a visible gap, never dropped silently */
  unplaced: DayDetailGate[]
} {
  const placed: PlacedGate[] = []
  const unplaced: DayDetailGate[] = []
  const taken = new Set<Direction>()
  for (const gate of gates ?? []) {
    const direction = normalizeDirection(gate?.direction)
    if (!direction || taken.has(direction)) {
      unplaced.push(gate)
      continue
    }
    taken.add(direction)
    placed.push({ direction, cell: DIR_CELL[direction], gate })
  }
  return { placed, unplaced }
}

/** Whether the board is complete: all 8 points filled and nothing left over. */
export function isCompleteBoard(result: { placed: PlacedGate[]; unplaced: DayDetailGate[] }): boolean {
  return result.unplaced.length === 0 && new Set(result.placed.map((p) => p.direction)).size === DIRECTIONS.length
}
