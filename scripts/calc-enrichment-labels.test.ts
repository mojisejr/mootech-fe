// Deterministic tests for the public-calculator-only display label override
// (#calculator-enrich-ggg-dispatch, ฟีม decision 2026-07-15). Original bazi-sft-dataset terms
// stay unchanged in data/dataset/compute; only these two render-time strings are softened for a
// general-public audience, with the original always kept in parentheses.
// Run: bun scripts/calc-enrichment-labels.test.ts   or: npx tsx scripts/calc-enrichment-labels.test.ts
import assert from 'node:assert/strict'
import { displayQi, displayReaction } from '../lib/calculator/enrichment-labels'

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
  t('displayQi overrides "ซวย" (衰) and keeps the original term in parentheses', () => {
    assert.equal(displayQi('ซวย'), 'ระยะถดถอย (ซวย)')
  })

  t('displayReaction overrides "โชคลาภ" (財) and keeps the original term in parentheses', () => {
    assert.equal(displayReaction('โชคลาภ'), 'บทบาททรัพย์ (โชคลาภ)')
  })

  t('all other qi stages pass through unchanged (มุน confirmed no collision)', () => {
    for (const qi of ['เชี่ยงแซ', 'หมกยก', 'กวงตั่ว', 'ลิ่มกัว', 'ตี้อ๋วง', 'แป่', 'ซี่', 'หมอ', 'เจ๊าะ', 'ทอ', 'เอี้ยง']) {
      assert.equal(displayQi(qi), qi)
    }
  })

  t('all other reactions pass through unchanged', () => {
    for (const r of ['คู่ธาตุ', 'ถ่ายเท', 'พิฆาต', 'ส่งเสริม']) {
      assert.equal(displayReaction(r), r)
    }
  })

  t('unknown/empty input -> unchanged, no crash', () => {
    assert.equal(displayQi(''), '')
    assert.equal(displayQi('unknown'), 'unknown')
    assert.equal(displayReaction(''), '')
  })

  if (process.exitCode) {
    console.error(`\ncalc-enrichment-labels: FAILED (${pass} passed)`)
  } else {
    console.log(`calc-enrichment-labels: all ${pass} passed ✓`)
  }
}

main()
