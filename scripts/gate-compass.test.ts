// Mutant proof for the 8-gate compass (features/v2-calendar/components/day-detail/gate-compass.ts).
//
// This guards a bug that SHIPPED. The old EightGates placed cells by array order and rendered `dir` as a
// caption; comparing Figma 634:8752 §12 against a real payload showed every gate at the ANTIPODE of where
// the pipe puts it — a 180° point reflection across all eight, between two dates 23 days apart. The gates
// rotate daily, so Figma's positions were one day's DATA, not a layout. A user reading position would have
// been sent toward the death gate with full confidence, and no human review catches it because the caption
// travels with the glyph: the board reads correct by caption and wrong by position at the same time.
//
// TWO LAYERS, by design (บอง 2026-08-06 trimmed this from four — see gate-compass.ts for what was left out
// and the condition that brings it back).
//   A · COMPASS-TRUTH — the table agrees with what a compass MEANS. A bijection check would NOT catch this:
//       the inverted table is also a perfect bijection. So north must be UP, east must be RIGHT, and every
//       pair of opposites must reflect through the centre.
//   B · NOTHING-LOST — all 8 place, an unreadable or duplicated direction surfaces instead of vanishing.
//
// TEETH
//   • mut-compass-inverted — #mut-compass-inverted · replace DIR_CELL with its point reflection → A trips.
//                            THIS IS THE SHIPPED BUG, reproduced exactly.
//   • mut-gate-dropped     — #mut-gate-dropped · silently skip an unreadable gate → B trips.
//
// VERIFY-THE-INSTRUMENT: the eight cells must be eight DISTINCT cells and none may be the centre, asserted
// before anything else — otherwise "every gate has a cell" is satisfiable by giving them all the same one.
import assert from 'node:assert'
import {
  DIRECTIONS, DIR_CELL, CENTER, normalizeDirection, placeGates, isCompleteBoard,
  type Direction,
} from '../features/v2-calendar/components/day-detail/gate-compass'
import type { DayDetailGate } from '../features/v2-calendar/types'

let pass = 0
const ok = (name: string, cond: boolean, detail = '') => {
  assert.ok(cond, `FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  pass += 1
}
const key = (c: { row: number; col: number }) => `${c.row},${c.col}`

// ── VERIFY-THE-INSTRUMENT ──
console.log('— instrument check —')
ok('there are exactly 8 directions', DIRECTIONS.length === 8, DIRECTIONS.join(' '))
ok('the 8 cells are 8 DISTINCT cells (else "every gate has a cell" proves nothing)',
  new Set(DIRECTIONS.map((d) => key(DIR_CELL[d]))).size === 8)
ok('no gate is placed in the centre — that is where the reader stands',
  !DIRECTIONS.some((d) => key(DIR_CELL[d]) === key(CENTER)))

// ── A · COMPASS-TRUTH — the table must mean what a compass means ── #mut-compass-inverted
console.log('\n— A · COMPASS-TRUTH: north is up, east is right, opposites reflect —')
// north half on the top row, south half on the bottom; west column left, east column right.
for (const d of ['NW', 'N', 'NE'] as Direction[]) ok(`${d} is on the TOP row`, DIR_CELL[d].row === 1, key(DIR_CELL[d]))
for (const d of ['SW', 'S', 'SE'] as Direction[]) ok(`${d} is on the BOTTOM row`, DIR_CELL[d].row === 3, key(DIR_CELL[d]))
for (const d of ['NW', 'W', 'SW'] as Direction[]) ok(`${d} is in the LEFT column`, DIR_CELL[d].col === 1, key(DIR_CELL[d]))
for (const d of ['NE', 'E', 'SE'] as Direction[]) ok(`${d} is in the RIGHT column`, DIR_CELL[d].col === 3, key(DIR_CELL[d]))
ok('N is directly above the centre', DIR_CELL.N.col === CENTER.col && DIR_CELL.N.row < CENTER.row)
ok('S is directly below the centre', DIR_CELL.S.col === CENTER.col && DIR_CELL.S.row > CENTER.row)
ok('W is directly left of the centre', DIR_CELL.W.row === CENTER.row && DIR_CELL.W.col < CENTER.col)
ok('E is directly right of the centre', DIR_CELL.E.row === CENTER.row && DIR_CELL.E.col > CENTER.col)
// every opposite pair reflects through the centre — the property the 180° bug violates on all four axes
const OPPOSITES: [Direction, Direction][] = [['N', 'S'], ['E', 'W'], ['NE', 'SW'], ['NW', 'SE']]
for (const [a, b] of OPPOSITES) {
  const A = DIR_CELL[a], B = DIR_CELL[b]
  ok(`${a} and ${b} reflect through the centre`,
    A.row + B.row === CENTER.row * 2 && A.col + B.col === CENTER.col * 2, `${key(A)} / ${key(B)}`)
}

// ── B · NOTHING-LOST ── #mut-gate-dropped
console.log('\n— B · NOTHING-LOST: all 8 place, and nothing vanishes quietly —')
const gate = (name: string, direction: string): DayDetailGate => ({ name, direction, meaning: `${name}-meaning` })
// the real payload's own directions (มุน 2026-08-06, man-vs-day 2026-08-06) — not invented for the test
const REAL: DayDetailGate[] = [
  gate('開', 'S'), gate('休', 'SW'), gate('生', 'W'), gate('傷', 'NW'),
  gate('杜', 'N'), gate('景', 'NE'), gate('死', 'E'), gate('驚', 'SE'),
]
const real = placeGates(REAL)
ok('a real payload places all 8 gates', real.placed.length === 8, `${real.placed.length}`)
ok('a real payload leaves nothing unplaced', real.unplaced.length === 0, JSON.stringify(real.unplaced))
ok('a real payload is a complete board', isCompleteBoard(real))
// ⚠️ NOT `p.cell === DIR_CELL[p.direction]` — placeGates ASSIGNS that, so it is true by construction and
// can never fail. ตู๋ 2026-08-06 named this exact shape: a check that reads the label back out of the thing
// that wrote it passes even when every position is wrong. What is actually asserted is the SET of occupied
// cells: the eight gates must fill the eight non-centre squares of the 3×3, no square twice, none in the
// middle. A table that collapsed two directions onto one cell, or leaked into the centre, fails here.
const ALL_CELLS = [1, 2, 3].flatMap((row) => [1, 2, 3].map((col) => `${row},${col}`))
const occupied = new Set(real.placed.map((p) => key(p.cell)))
ok('the 8 placed gates occupy 8 DIFFERENT cells', occupied.size === 8, [...occupied].join(' '))
ok('they fill exactly the 8 non-centre squares of the 3×3',
  ALL_CELLS.filter((c) => c !== key(CENTER)).every((c) => occupied.has(c)), [...occupied].sort().join(' '))
ok('and none of them is the centre', !occupied.has(key(CENTER)))

// ── POSITION-NOT-ORDER — ตู๋'s second mutant, stated as a property ── #mut-place-by-index
// Shuffle the payload WITHOUT touching a single label. If placement read the array index (the shipped bug)
// every gate would move; if it reads `direction`, the board is byte-identical. This is the assertion that
// proves the compass is driven by data and not by arrival order — a label-vs-content check cannot see it,
// because shuffling keeps every label glued to its own gate and the widget stays self-consistent while
// being completely wrong.
console.log('\n— POSITION-NOT-ORDER: shuffling the payload must not move anything —')
const boardOf = (gs: DayDetailGate[]) =>
  placeGates(gs).placed.map((p) => `${p.gate.name}@${key(p.cell)}`).sort().join(' ')
const SHUFFLED = [REAL[5], REAL[0], REAL[7], REAL[2], REAL[4], REAL[1], REAL[6], REAL[3]]
ok('INSTRUMENT: the shuffle really is a different array order',
  SHUFFLED.map((g) => g.name).join('') !== REAL.map((g) => g.name).join(''))
ok('a shuffled payload produces the IDENTICAL board', boardOf(SHUFFLED) === boardOf(REAL), boardOf(SHUFFLED))
const REVERSED = [...REAL].reverse()
ok('a reversed payload produces the IDENTICAL board', boardOf(REVERSED) === boardOf(REAL))

// an unreadable direction must SURFACE, not disappear
const bad = placeGates([...REAL.slice(0, 7), gate('驚', 'CENTRE')])
ok('an unreadable direction is reported as unplaced, not dropped', bad.unplaced.length === 1, JSON.stringify(bad.unplaced))
ok('and the board is then NOT complete (7 gates must not look fine)', !isCompleteBoard(bad), `${bad.placed.length} placed`)
// a duplicate must not overwrite the gate already there
const dupe = placeGates([...REAL, gate('開-again', 'S')])
ok('a duplicate direction does not silently overwrite the first', dupe.placed.length === 8 && dupe.unplaced.length === 1)
// a short payload is not silently a full board
ok('a 7-gate payload is not a complete board', !isCompleteBoard(placeGates(REAL.slice(0, 7))))
ok('an empty payload is not a complete board', !isCompleteBoard(placeGates([])))
ok('a null payload does not throw and is not complete', !isCompleteBoard(placeGates(null)))

// tolerated spellings, and the refusal of everything else
console.log('\n— direction parsing: forgiving about spelling, strict about meaning —')
ok('"NW" reads as NW', normalizeDirection('NW') === 'NW')
ok('"ทิศ NW" reads as NW (the wire has used this prefix)', normalizeDirection('ทิศ NW') === 'NW')
ok('" nw " reads as NW', normalizeDirection(' nw ') === 'NW')
// the Thai vocabulary the FIXTURE actually uses. Without these, a real payload spelled this way would put
// every gate in `unplaced` and the board would be empty — the mock-data trap, asserted rather than assumed.
ok('"ทิศเหนือ" reads as N', normalizeDirection('ทิศเหนือ') === 'N')
ok('"ทิศใต้" reads as S', normalizeDirection('ทิศใต้') === 'S')
ok('"ทิศตะวันออก" reads as E', normalizeDirection('ทิศตะวันออก') === 'E')
ok('"ทิศตะวันตก" reads as W', normalizeDirection('ทิศตะวันตก') === 'W')
// the four compound points are the ones a prefix match gets WRONG — NE would read as E
ok('"ทิศตะวันออกเฉียงเหนือ" reads as NE, not E', normalizeDirection('ทิศตะวันออกเฉียงเหนือ') === 'NE')
ok('"ทิศตะวันออกเฉียงใต้" reads as SE, not E', normalizeDirection('ทิศตะวันออกเฉียงใต้') === 'SE')
ok('"ทิศตะวันตกเฉียงเหนือ" reads as NW, not W', normalizeDirection('ทิศตะวันตกเฉียงเหนือ') === 'NW')
ok('"ทิศตะวันตกเฉียงใต้" reads as SW, not W', normalizeDirection('ทิศตะวันตกเฉียงใต้') === 'SW')
// every Thai name maps to a DIFFERENT point — a table that collapsed two of them would still "work"
ok('the 8 Thai names map to 8 distinct points',
  new Set(['ทิศเหนือ', 'ทิศใต้', 'ทิศตะวันออก', 'ทิศตะวันตก', 'ทิศตะวันออกเฉียงเหนือ', 'ทิศตะวันออกเฉียงใต้', 'ทิศตะวันตกเฉียงเหนือ', 'ทิศตะวันตกเฉียงใต้'].map((t) => normalizeDirection(t))).size === 8)
for (const junk of ['', 'C', 'CENTRE', 'NNW', '財', 'up', null, undefined]) {
  ok(`${JSON.stringify(junk)} is refused rather than guessed`, normalizeDirection(junk as string) === null)
}

console.log(`\n✅ gate-compass.test.ts — ${pass} assertions passed`)
