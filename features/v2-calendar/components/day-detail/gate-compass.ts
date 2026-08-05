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
// NOT DONE, ON PURPOSE, WITH THE CONDITION TO REVISIT (บอง 2026-08-06, after ฟีม flagged that we were
// writing 1.7× more harness than product):
//   • DOM-layer check (assert the glyph inside [data-dir=NW] is the NW gate) — mostly redundant now that
//     position comes from DIR_CELL rather than source order.
//   • Browser geometry check (each cell's bbox centre falls in the octant its direction names) + its
//     mut-rtl-flip tooth — this is the only layer that would catch a CSS inversion (`direction: rtl`,
//     `rotate(180deg)`, `order`). Nobody is adding rtl, and it has never happened here.
//   REVISIT IF: anyone touches the CSS of this grid (writing mode, direction, order, grid-auto-flow), or a
//   wrong-direction bug reaches a real screen. Then the geometry layer is the one to add, not more of A/B.
import type { DayDetailGate } from '../../types'

/** The 8 compass points, in the order a reader scans the board (row-major from the top-left). */
export const DIRECTIONS = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE'] as const
export type Direction = (typeof DIRECTIONS)[number]

/** 1-based grid coordinates. The centre (2,2) belongs to no gate — it is where the reader stands. */
export type Cell = { row: 1 | 2 | 3; col: 1 | 2 | 3 }

/** The centre. Deliberately NOT a gate slot: ฟีม cut 財 because the classics have no ninth gate. */
export const CENTER: Cell = { row: 2, col: 2 }

/**
 * The one table. North is up, east is right — the same convention as every map the reader has ever seen,
 * which is exactly what the test asserts rather than merely checking the eight entries are distinct.
 */
export const DIR_CELL: Record<Direction, Cell> = {
  NW: { row: 1, col: 1 },
  N: { row: 1, col: 2 },
  NE: { row: 1, col: 3 },
  W: { row: 2, col: 1 },
  E: { row: 2, col: 3 },
  SW: { row: 3, col: 1 },
  S: { row: 3, col: 2 },
  SE: { row: 3, col: 3 },
}

/**
 * SETTLED FROM THE SOURCE DATA (มุน 2026-08-06, บอง asked for the raw values rather than my paraphrase):
 * bazi-testenv/src/lib/bazi/data/almanac/day-month-table.json stores gate rows as [glyph, direction] pairs
 * and the direction is a SHORT COMPASS CODE —
 *     [["開","NE"],["休","E"],["生","SE"],["傷","S"],["杜","SW"],["景","W"],["死","NW"],["驚","N"]]
 * Across all 212 rows in that table: 209 carry exactly the 8 codes, 8 distinct, ZERO rows repeat a
 * direction. (The other 3 hold 八神 keywords where directions should be — a known column-shift the engine
 * already guards at almanac-engine.ts:356 by falling back to day-pillar-table.)
 *
 * So the real wire speaks short codes. Thai phrases are read too, because features/v2-calendar/fixtures.ts
 * sends 'ทิศตะวันออกเฉียงเหนือ' — the FIXTURE disagrees with the backend it stands in for. That is the
 * mock-data trap in the open: a parser written against either vocabulary alone would silently place nothing
 * the day it met the other one. Both are read; anything else is refused and surfaced.
 *
 * Longest-first matters: 'ตะวันออกเฉียงเหนือ' contains 'ตะวันออก', so a prefix match would read NE as E.
 * Exact keys avoid that entirely.
 */
const THAI_DIRECTION: Record<string, Direction> = {
  เหนือ: 'N',
  ใต้: 'S',
  ตะวันออก: 'E',
  ตะวันตก: 'W',
  ตะวันออกเฉียงเหนือ: 'NE',
  ตะวันออกเฉียงใต้: 'SE',
  ตะวันตกเฉียงเหนือ: 'NW',
  ตะวันตกเฉียงใต้: 'SW',
}

/**
 * Read a wire direction in either vocabulary, and REFUSE everything else instead of guessing — an
 * unrecognised direction must become a visible gap, never a gate quietly placed somewhere plausible.
 */
export function normalizeDirection(raw: string | null | undefined): Direction | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/^ทิศ\s*/, '').replace(/\s+/g, '')
  if (THAI_DIRECTION[s]) return THAI_DIRECTION[s]
  const up = s.toUpperCase()
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
