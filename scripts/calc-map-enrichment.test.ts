// Deterministic tests for the bazi-sft-dataset enrichment bridge (#calculator-enrichment-FROZEN-v1).
// Run: bun scripts/calc-map-enrichment.test.ts   or: npx tsx scripts/calc-map-enrichment.test.ts
import assert from 'node:assert/strict'
import { thaiToBaziElement, findDecadePhasePair, findLiuNianForYear } from '../lib/calculator/map-enrichment'
import type { DecadeLuckItem, AnnualLuckItem } from '../lib/calculator/map-timeline'
import type { DaYunRow, LiuNianRow } from '../pages/api/calculator/compute'

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

function main() {
  t('thaiToBaziElement maps all 5 locked labels to their English key', () => {
    assert.equal(thaiToBaziElement('ไม้'), 'WOOD')
    assert.equal(thaiToBaziElement('ไฟ'), 'FIRE')
    assert.equal(thaiToBaziElement('ดิน'), 'EARTH')
    assert.equal(thaiToBaziElement('ทอง'), 'METAL')
    assert.equal(thaiToBaziElement('น้ำ'), 'WATER')
  })

  t('thaiToBaziElement returns undefined for unknown input, no crash', () => {
    assert.equal(thaiToBaziElement('unknown'), undefined)
    assert.equal(thaiToBaziElement(''), undefined)
  })

  t('findDecadePhasePair matches by ageStart, not array index (real shape, 2026-07-15)', () => {
    const daYun: DaYunRow[] = [
      { ageRange: '7-11 ปี', symbol: '壬', place: 'ราศีบน', qi: 'ลิ่มกัว', reaction: 'ถ่ายเท', element: 'น้ำ' },
      { ageRange: '12-16 ปี', symbol: '午', place: 'ราศีล่าง', qi: 'หมกยก', reaction: 'พิฆาต', element: 'ไฟ' },
      { ageRange: '17-21 ปี', symbol: '癸', place: 'ราศีบน', qi: 'ทอ', reaction: 'ถ่ายเท', element: 'น้ำ' },
      { ageRange: '22-26 ปี', symbol: '未', place: 'ราศีล่าง', qi: 'กวงตั่ว', reaction: 'ส่งเสริม', element: 'ดิน' },
    ]
    const decade: DecadeLuckItem = { chinese_symbol: '癸', element: 'WATER', ageStart: 17, ageEnd: 26, isCurrent: false }
    const pair = findDecadePhasePair(daYun, decade)
    assert.equal(pair.upper?.symbol, '癸')
    assert.equal(pair.lower?.symbol, '未')
  })

  t('findDecadePhasePair: no match -> empty object, no crash', () => {
    const decade: DecadeLuckItem = { chinese_symbol: 'x', element: 'WATER', ageStart: 999, ageEnd: 1003, isCurrent: false }
    assert.deepEqual(findDecadePhasePair([], decade), {})
  })

  // Regression guard: annual.year (mootech-be's cycleYearLife) is a 1-indexed "Nth year of life"
  // counter, NOT a calendar year (verified live: dob 1990-05-15 -> year:1 gave 庚午, which matches
  // bazi-sft-dataset's own annualGanzhi(1990) formula exactly — i.e. year:1 = the birth year).
  // enrichment liuNian.year IS a real calendar year, but liuNian.age uses the same "birth year =
  // age 1" counting (verified live: dob 1990, calendar 2025 -> age 36 = 2025-1990+1). Matching on
  // year===year (instead of year===age) silently never matches anything — caught via live browser
  // testing, not assumed, so this pins the fix.
  t('findLiuNianForYear matches annual.year (age counter) against liuNian.age, not liuNian.year', () => {
    const liuNian: LiuNianRow[] = [
      { year: 2025, age: 36, stem: '乙', branch: '巳', element: 'ไม้', qi: 'เชี่ยงแซ', reaction: 'โชคลาภ', clash: false, harm: false },
      { year: 2030, age: 41, stem: '庚', branch: '戌', element: 'ทอง', qi: 'ซวย', reaction: 'คู่ธาตุ', clash: true, harm: false },
    ]
    const annualYear36: AnnualLuckItem = { year: 36, ceYear: 2025, beYear: 2025 + 543, isCurrent: false, above: { chinese_symbol: '乙', element: 'WOOD' }, below: { chinese_symbol: '巳', element: 'FIRE' } }
    const match = findLiuNianForYear(liuNian, annualYear36)
    assert.equal(match?.age, 36)
    assert.equal(match?.reaction, 'โชคลาภ')

    // Would-be-buggy key (annual.year === liuNian.year, i.e. 36 === 2025) must NOT match here.
    assert.notEqual(annualYear36.year, liuNian[0].year)
  })

  t('findLiuNianForYear: no matching age -> undefined, no crash', () => {
    const annual: AnnualLuckItem = { year: 5, ceYear: 1993, beYear: 1993 + 543, isCurrent: false, above: { chinese_symbol: 'x', element: 'WOOD' }, below: { chinese_symbol: 'y', element: 'WOOD' } }
    assert.equal(findLiuNianForYear([], annual), undefined)
  })

  if (process.exitCode) {
    console.error(`\ncalc-map-enrichment: FAILED (${pass} passed)`)
  } else {
    console.log(`calc-map-enrichment: all ${pass} passed ✓`)
  }
}

main()
