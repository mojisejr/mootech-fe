// Calendar advanced-mode 八字 pillars — SHAPE teeth. PillarColumn.cells is PillarCell[] {stem,branch,element}
// (3 layers), NOT the old single-glyph string[] that dropped 2 of 3 layers. The bug-class this guards: a
// presentation-driven shape (draw 1 glyph → store 1 glyph) that silently loses backend data and forces a
// contract-rewrite at API-time. The teeth prove (a) every cell carries all 3 layers, and (b) the fixture's
// element never contradicts its stem (五行), so a mislabel can't sail through green.
// Run: npx tsx scripts/calendar-pillar-shape.test.ts
//
// ANCHOR: scripts/calendar-pillar-shape.test.ts#pillar-cell-three-layer-and-stem-element
import assert from 'node:assert/strict'
import { mockDayDetail, MOCK_DAYS } from '../features/v2-calendar/fixtures'
import type { PillarCell } from '../features/v2-calendar/types'

// Independent 五行 oracle (NOT imported from fixtures — an independent check, so a fixture-side change to the
// map is caught here rather than tautologically agreeing with itself).
const STEM_ELEMENT: Record<string, string> = {
  甲: 'ไม้', 乙: 'ไม้', 丙: 'ไฟ', 丁: 'ไฟ', 戊: 'ดิน',
  己: 'ดิน', 庚: 'ทอง', 辛: 'ทอง', 壬: 'น้ำ', 癸: 'น้ำ',
}

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

const detail = mockDayDetail(MOCK_DAYS[0].date)
const pillars = detail.pillars ?? []

t('pillar-cell-three-layer-and-stem-element: both MAN and DAY blocks are present', () => {
  const kinds = pillars.map((p) => p.kind).sort()
  assert.deepEqual(kinds, ['day', 'man'], 'expected exactly the man + day pillar blocks')
})

t('every pillar block has 4 เสา (ปี/เดือน/วัน/ยาม)', () => {
  for (const p of pillars) {
    assert.equal(p.cells.length, 4, `${p.kind} should have 4 cells, got ${p.cells.length}`)
  }
})

t('every cell carries all 3 layers as non-empty strings (guards regression to string[])', () => {
  for (const p of pillars) {
    for (const cell of p.cells as PillarCell[]) {
      // If cells regressed to string[], `cell.stem` is undefined → this fails loudly (the whole point).
      assert.equal(typeof cell, 'object', `${p.kind} cell must be an object, not a bare glyph`)
      for (const layer of ['stem', 'branch', 'element'] as const) {
        assert.equal(typeof cell[layer], 'string', `${p.kind} cell.${layer} must be a string`)
        assert.ok(cell[layer].length > 0, `${p.kind} cell.${layer} must be non-empty`)
      }
    }
  }
})

t('element never contradicts its stem (五行 data-correctness — a mislabel is caught)', () => {
  for (const p of pillars) {
    for (const cell of p.cells as PillarCell[]) {
      const expected = STEM_ELEMENT[cell.stem]
      assert.ok(expected, `stem ${cell.stem} is not a valid 天干`)
      assert.equal(
        cell.element,
        expected,
        `${p.kind} cell stem ${cell.stem} → element should be ${expected}, got ${cell.element}`,
      )
    }
  }
})

t('DAY block wires the วัน pillar to the day\'s real ganzhi glyphs', () => {
  const day = pillars.find((p) => p.kind === 'day')
  assert.ok(day, 'day pillar must exist')
  const dayColumn = day!.cells[2] // index 2 = วัน pillar (ปี/เดือน/วัน/ยาม)
  assert.equal(dayColumn.stem, MOCK_DAYS[0].ganzhi[0], 'วัน stem should be the day ganzhi[0]')
  assert.equal(dayColumn.branch, MOCK_DAYS[0].ganzhi[1], 'วัน branch should be the day ganzhi[1]')
})

if (process.exitCode) {
  console.error(`\ncalendar-pillar-shape: FAILED (${pass} passed)`)
} else {
  console.log(`\ncalendar-pillar-shape: all ${pass} passed ✓`)
}
