// Deterministic tests for the ops Public Calculator usage card's date-boundary logic
// (#public-bazi-calculator Phase 3). bangkokDayBoundary is pure — no DB round-trip. The actual
// query (fetchCalculatorUsage) was verified live 2026-07-15 against seeded+deleted test rows
// (see PR description): today=3, delta=2 (vs yesterday=1), 7-day trend correctly placed a
// 5-count spike on the exact seeded day.
// Run: bun scripts/ops-calculator-usage.test.ts   or: npx tsx scripts/ops-calculator-usage.test.ts
import assert from 'node:assert/strict'
import { bangkokDayBoundary } from '../lib/ops/calculator-usage'

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
  t('today (offset 0) is a 24h window starting at Bangkok midnight', () => {
    // 2026-07-15 12:00:00 UTC = 2026-07-15 19:00:00 Bangkok — unambiguously mid-day.
    const { start, end, label } = bangkokDayBoundary(0, new Date('2026-07-15T12:00:00.000Z'))
    assert.equal(label, '2026-07-15')
    assert.equal(start.toISOString(), '2026-07-14T17:00:00.000Z') // Bangkok midnight = UTC-7h
    assert.equal(end.getTime() - start.getTime(), 24 * 3600_000)
  })

  t('crossing UTC midnight into Bangkok\'s next day still resolves to the Bangkok calendar day', () => {
    // 2026-07-13 18:00:00 UTC = 2026-07-14 01:00:00 Bangkok — the exact boundary a naive
    // UTC-day calc gets wrong (#adversarial-matrix input-boundary: ข้ามเที่ยงคืน).
    const { label } = bangkokDayBoundary(0, new Date('2026-07-13T18:00:00.000Z'))
    assert.equal(label, '2026-07-14')
  })

  t('offset -1 (yesterday) is exactly one day behind offset 0, no gap or overlap', () => {
    const now = new Date('2026-07-15T12:00:00.000Z')
    const today = bangkokDayBoundary(0, now)
    const yesterday = bangkokDayBoundary(-1, now)
    assert.equal(yesterday.end.getTime(), today.start.getTime())
    assert.equal(yesterday.label, '2026-07-14')
  })

  t('month rollover: offset -1 from the 1st lands on the last day of the previous month', () => {
    // 2026-07-01 12:00:00 UTC = 2026-07-01 19:00:00 Bangkok.
    const { label } = bangkokDayBoundary(-1, new Date('2026-07-01T12:00:00.000Z'))
    assert.equal(label, '2026-06-30')
  })

  t('year rollover: offset -1 from Jan 1 lands on Dec 31 of the previous year', () => {
    const { label } = bangkokDayBoundary(-1, new Date('2027-01-01T12:00:00.000Z'))
    assert.equal(label, '2026-12-31')
  })

  if (process.exitCode) {
    console.error(`\nops-calculator-usage: FAILED (${pass} passed)`)
  } else {
    console.log(`ops-calculator-usage: all ${pass} passed ✓`)
  }
}

main()
