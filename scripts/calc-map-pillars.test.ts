// Deterministic tests for the pillar-column mapping (#public-bazi-calculator).
// Run: bun scripts/calc-map-pillars.test.ts   or: npx tsx scripts/calc-map-pillars.test.ts
import assert from 'node:assert/strict'
import { mapPillarColumns } from '../lib/calculator/map-pillars'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

// Real shape verified live against mootech-be, 2026-07-15 (dob 1990-03-21, time 09:15).
const REAL_DETAIL = {
  ascendantAbove: { chinese_symbol: '甲', element: 'WOOD' },
  ascendantBelow: { chinese_symbol: '申', element: 'METAL' },
  timeAbove: { chinese_symbol: '己', element: 'EARTH' },
  timeBelow: { chinese_symbol: '巳', element: 'FIRE' },
  dayAbove: { chinese_symbol: '乙', element: 'WOOD' },
  dayBelow: { chinese_symbol: '酉', element: 'METAL' },
  monthAbove: { chinese_symbol: '己', element: 'EARTH' },
  monthBelow: { chinese_symbol: '卯', element: 'WOOD' },
  yearAbove: { chinese_symbol: '庚', element: 'METAL' },
  yearBelow: { chinese_symbol: '午', element: 'FIRE' },
}

function main() {
  t('column order is frozen: ลัคนา, ยาม, วัน, เดือน, ปี', () => {
    const cols = mapPillarColumns(REAL_DETAIL)
    assert.deepEqual(
      cols.map((c) => c.label),
      ['ลัคนา', 'ยาม', 'วัน', 'เดือน', 'ปี'],
    )
  })

  t('day column is centered (index 2 of 5) and flagged isDay', () => {
    const cols = mapPillarColumns(REAL_DETAIL)
    assert.equal(cols[2].key, 'day')
    assert.equal(cols[2].isDay, true)
    assert.equal(cols.filter((c) => c.isDay).length, 1)
  })

  t('above/below glyph+element read from detail.*, matching a real case where a pillar\'s two glyphs have different elements', () => {
    const cols = mapPillarColumns(REAL_DETAIL)
    const ascendant = cols.find((c) => c.key === 'ascendant')!
    assert.deepEqual(ascendant.above, { chinese_symbol: '甲', element: 'WOOD' })
    assert.deepEqual(ascendant.below, { chinese_symbol: '申', element: 'METAL' })
  })

  t('missing time -> ascendant/time slots are null (soft placeholder), not crashed or defaulted', () => {
    const noTimeDetail = {
      ...REAL_DETAIL,
      ascendantAbove: { chinese_symbol: '', element: '' },
      ascendantBelow: { chinese_symbol: '', element: '' },
      timeAbove: { chinese_symbol: '', element: '' },
      timeBelow: { chinese_symbol: '', element: '' },
    }
    const cols = mapPillarColumns(noTimeDetail)
    const ascendant = cols.find((c) => c.key === 'ascendant')!
    const time = cols.find((c) => c.key === 'time')!
    assert.equal(ascendant.above, null)
    assert.equal(ascendant.below, null)
    assert.equal(time.above, null)
    assert.equal(time.below, null)
    // day/month/year still populate normally alongside the empty ones
    const day = cols.find((c) => c.key === 'day')!
    assert.deepEqual(day.above, { chinese_symbol: '乙', element: 'WOOD' })
  })

  t('null/undefined detail object -> all 5 columns present with null slots, no crash', () => {
    const cols = mapPillarColumns(null)
    assert.equal(cols.length, 5)
    for (const c of cols) {
      assert.equal(c.above, null)
      assert.equal(c.below, null)
    }
  })

  if (process.exitCode) {
    console.error(`\ncalc-map-pillars: FAILED (${pass} passed)`)
  } else {
    console.log(`calc-map-pillars: all ${pass} passed ✓`)
  }
}

main()
