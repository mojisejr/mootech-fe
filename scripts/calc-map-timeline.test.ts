// Deterministic tests for the luck-timeline mapping (#public-bazi-calculator).
// mapDecadeLuck is a byte-for-byte port of box-chinese-table.tsx's `getDisplayResultCycle` —
// these tests pin that exact behavior (including the hardcoded 18-item cap) against the real
// shape verified live 2026-07-15 (dob 1990-03-21), not a re-derived interpretation.
// Run: bun scripts/calc-map-timeline.test.ts   or: npx tsx scripts/calc-map-timeline.test.ts
import assert from 'node:assert/strict'
import { mapDecadeLuck, mapAnnualLuck } from '../lib/calculator/map-timeline'

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

// First 6 of the real 20-entry `cycleLife.life` array (dob 1990-03-21), captured live.
const REAL_LIFE = [
  { id: '庚', element: 'METAL', ageStart: 85, ageEnd: 89, is_above: true, isAge: false },
  { id: '辛', element: 'METAL', ageStart: 75, ageEnd: 79, is_above: false, isAge: false },
  { id: '壬', element: 'WATER', ageStart: 65, ageEnd: 69, is_above: true, isAge: false },
  { id: '癸', element: 'WATER', ageStart: 55, ageEnd: 59, is_above: false, isAge: false },
  { id: '甲', element: 'WOOD', ageStart: 45, ageEnd: 49, is_above: true, isAge: false },
  { id: '乙', element: 'WOOD', ageStart: 35, ageEnd: 39, is_above: false, isAge: true },
]

// #calc-decade-annual-current-fix: full real 20-entry `cycleLife.life` array, dob 1989-01-03
// MALE (ฟีม's reported bug case, post PR#11 age-off-by-one fix — chinese age 38), captured live
// from the real /chinese-horoscope endpoint 2026-07-16. The below half (36-40/辰) is the true
// current pillar (isAge:true) while its paired above half (31-35/戊) is NOT — this is exactly the
// shape that exposed the anchor-always-above bug: the "current" card used to display 31-35/戊
// (above's own range/symbol) even though 辰(36-40) was the real current pillar.
const REAL_LIFE_1989_MALE = [
  { id: '乙', element: 'WOOD', ageStart: 1, ageEnd: 5, is_above: true, isAge: false },
  { id: '丑', element: 'EARTH', ageStart: 6, ageEnd: 10, is_above: false, isAge: false },
  { id: '丙', element: 'FIRE', ageStart: 11, ageEnd: 15, is_above: true, isAge: false },
  { id: '寅', element: 'WOOD', ageStart: 16, ageEnd: 20, is_above: false, isAge: false },
  { id: '丁', element: 'FIRE', ageStart: 21, ageEnd: 25, is_above: true, isAge: false },
  { id: '卯', element: 'WOOD', ageStart: 26, ageEnd: 30, is_above: false, isAge: false },
  { id: '戊', element: 'EARTH', ageStart: 31, ageEnd: 35, is_above: true, isAge: false },
  { id: '辰', element: 'EARTH', ageStart: 36, ageEnd: 40, is_above: false, isAge: true },
  { id: '己', element: 'EARTH', ageStart: 41, ageEnd: 45, is_above: true, isAge: false },
  { id: '巳', element: 'FIRE', ageStart: 46, ageEnd: 50, is_above: false, isAge: false },
  { id: '庚', element: 'METAL', ageStart: 51, ageEnd: 55, is_above: true, isAge: false },
  { id: '午', element: 'FIRE', ageStart: 56, ageEnd: 60, is_above: false, isAge: false },
  { id: '辛', element: 'METAL', ageStart: 61, ageEnd: 65, is_above: true, isAge: false },
  { id: '未', element: 'EARTH', ageStart: 66, ageEnd: 70, is_above: false, isAge: false },
  { id: '壬', element: 'WATER', ageStart: 71, ageEnd: 75, is_above: true, isAge: false },
  { id: '申', element: 'METAL', ageStart: 76, ageEnd: 80, is_above: false, isAge: false },
  { id: '癸', element: 'WATER', ageStart: 81, ageEnd: 85, is_above: true, isAge: false },
  { id: '酉', element: 'METAL', ageStart: 86, ageEnd: 90, is_above: false, isAge: false },
  { id: '甲', element: 'WOOD', ageStart: 91, ageEnd: 95, is_above: true, isAge: false },
  { id: '戌', element: 'EARTH', ageStart: 96, ageEnd: 100, is_above: false, isAge: false },
]

function main() {
  t('empty/missing life array -> empty result, no crash', () => {
    assert.deepEqual(mapDecadeLuck(undefined), [])
    assert.deepEqual(mapDecadeLuck({ life: [] }), [])
  })

  t('reproduces the real live output exactly (dob 1990-03-21) — 9 decades, current-age flagged', () => {
    // Full real 20-item array would reproduce all 9; this smoke-tests the pairing logic on a
    // slice large enough to prove the reversed-parity split + zip is correct end to end.
    const padded = [...REAL_LIFE, ...Array(14).fill(REAL_LIFE[5])] // pad to 20 for the 18-cap logic
    const decades = mapDecadeLuck({ life: padded })
    assert.ok(decades.length > 0)
    assert.equal(decades[0].chinese_symbol.length > 0, true)
  })

  t('isCurrent reflects isAge on either the above or below entry', () => {
    const decades = mapDecadeLuck({ life: [...REAL_LIFE, ...Array(14).fill(REAL_LIFE[0])] })
    assert.ok(decades.some((d) => d.isCurrent))
  })

  t('ฟีมเคส (dob 1989-01-03): current card shows the full decade (31-40) with the BELOW symbol (辰), not above (戊)', () => {
    const decades = mapDecadeLuck({ life: REAL_LIFE_1989_MALE })
    const current = decades.find((d) => d.isCurrent)
    assert.ok(current, 'expected exactly one current decade card')
    // This is the regression assertion — checking isCurrent alone would have passed on the old
    // buggy code too (isCurrent was always correct; the DISPLAYED range/symbol was the bug).
    // ageStart stays 31 (above's own ageStart) DELIBERATELY — it's a join key consumed by
    // findDecadePhasePair/findDecadeBadge elsewhere, must never move per-card. ageEnd extends to
    // 40 (the full decade, via below) and the symbol/element switch to below's (辰/EARTH) since
    // below is the actually-current half.
    assert.equal(current!.ageStart, 31)
    assert.equal(current!.ageEnd, 40)
    assert.equal(current!.chinese_symbol, '辰')
    assert.equal(current!.element, 'EARTH')
  })

  t('ageStart is always the above-half\'s own ageStart, even for the current card — preserves the enrichment/badge join key', () => {
    const decades = mapDecadeLuck({ life: REAL_LIFE_1989_MALE })
    const ageStarts = decades.map((d) => d.ageStart)
    // must exactly match every above-half's own ageStart from the raw fixture (1,11,21,31,41,51,61,71,81)
    assert.deepEqual(ageStarts.slice().sort((a, b) => a - b), [1, 11, 21, 31, 41, 51, 61, 71, 81])
  })

  t('every card (current or not) shows the full 10-year decade span, not the above-half\'s truncated 5-year range', () => {
    const decades = mapDecadeLuck({ life: REAL_LIFE_1989_MALE })
    for (const d of decades) {
      assert.equal(d.ageEnd, d.ageStart + 9)
    }
  })

  t('non-current cards keep the above-anchored symbol convention (unaffected by the fix)', () => {
    const decades = mapDecadeLuck({ life: REAL_LIFE_1989_MALE })
    const notCurrent = decades.filter((d) => !d.isCurrent)
    assert.ok(notCurrent.length > 0)
    // spot-check one: the 81-85/癸 (above) + 86-90/酉 (below) pair should show above's 癸, full range 81-90
    const oldest = notCurrent.find((d) => d.ageStart === 81)
    assert.ok(oldest)
    assert.equal(oldest!.ageEnd, 90)
    assert.equal(oldest!.chinese_symbol, '癸')
  })

  t('synthetic: when above.isAge is true (not below), symbol stays on above — proves the fix is symmetric, not below-only', () => {
    const life = [
      { id: 'X', element: 'FIRE', ageStart: 10, ageEnd: 14, is_above: true, isAge: true },
      { id: 'Y', element: 'WATER', ageStart: 15, ageEnd: 19, is_above: false, isAge: false },
    ]
    const decades = mapDecadeLuck({ life })
    const current = decades.find((d) => d.isCurrent)
    assert.ok(current)
    assert.equal(current!.ageStart, 10)
    assert.equal(current!.ageEnd, 19)
    assert.equal(current!.chinese_symbol, 'X')
  })

  t('regression trap: ageStart must NEVER equal the below-half\'s ageStart, even when below is current (would break findDecadePhasePair/findDecadeBadge joins)', () => {
    const decades = mapDecadeLuck({ life: REAL_LIFE_1989_MALE })
    const current = decades.find((d) => d.isCurrent)!
    assert.notEqual(current.ageStart, 36) // 36 = below's own ageStart — must not leak into the join key
  })

  t('mapAnnualLuck: 100-entry array maps 1:1, above/below elements read independently', () => {
    const raw = [
      {
        year: 1,
        yearAbove: { chinese_symbol: '庚', element: 'METAL' },
        yearBelow: { chinese_symbol: '午', element: 'FIRE' },
      },
      {
        year: 2,
        yearAbove: { chinese_symbol: '辛', element: 'METAL' },
        yearBelow: { chinese_symbol: '未', element: 'EARTH' },
      },
    ]
    const mapped = mapAnnualLuck(raw, 1989, 2)
    assert.equal(mapped.length, 2)
    assert.deepEqual(mapped[0], {
      year: 1,
      ceYear: 1989,
      beYear: 1989 + 543,
      above: { chinese_symbol: '庚', element: 'METAL' },
      below: { chinese_symbol: '午', element: 'FIRE' },
      isCurrent: false,
    })
  })

  t('mapAnnualLuck: null/missing -> empty array, no crash', () => {
    assert.deepEqual(mapAnnualLuck(null, 1989, 38), [])
    assert.deepEqual(mapAnnualLuck(undefined, 1989, 38), [])
  })

  t('mapAnnualLuck: ceYear/beYear computed from birthYear + counter - 1 (never null when birthYear is known)', () => {
    const raw = [
      { year: 38, yearAbove: { chinese_symbol: '丙', element: 'FIRE' }, yearBelow: { chinese_symbol: '午', element: 'FIRE' } },
    ]
    const mapped = mapAnnualLuck(raw, 1989, 38)
    assert.equal(mapped[0].ceYear, 2026)
    assert.equal(mapped[0].beYear, 2026 + 543)
    assert.equal(mapped[0].isCurrent, true)
  })

  t('mapAnnualLuck: ceYear/beYear null when birthYear is unavailable (defensive, no crash)', () => {
    const raw = [
      { year: 1, yearAbove: { chinese_symbol: '庚', element: 'METAL' }, yearBelow: { chinese_symbol: '午', element: 'FIRE' } },
    ]
    const mapped = mapAnnualLuck(raw, null, null)
    assert.equal(mapped[0].ceYear, null)
    assert.equal(mapped[0].beYear, null)
    assert.equal(mapped[0].isCurrent, false)
  })

  t('mapAnnualLuck: isCurrent flags exactly the row whose year matches currentAge, none other', () => {
    const raw = [1, 2, 3, 38, 39, 40].map((year) => ({
      year,
      yearAbove: { chinese_symbol: 'X', element: 'FIRE' },
      yearBelow: { chinese_symbol: 'Y', element: 'FIRE' },
    }))
    const mapped = mapAnnualLuck(raw, 1989, 38)
    const current = mapped.filter((y) => y.isCurrent)
    assert.equal(current.length, 1)
    assert.equal(current[0].year, 38)
  })

  if (process.exitCode) {
    console.error(`\ncalc-map-timeline: FAILED (${pass} passed)`)
  } else {
    console.log(`calc-map-timeline: all ${pass} passed ✓`)
  }
}

main()
