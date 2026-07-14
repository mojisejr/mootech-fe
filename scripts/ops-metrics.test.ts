// Deterministic tests for the ops date-range helpers (#mumate-ops-dashboard-phase1 Step 3).
// The aggregate queries themselves (fetchBusinessMetrics) were verified live against production
// data 2026-07-14 (see PR description for the EXPLAIN before/after and real numbers returned) —
// not re-mocked here since this repo has no DB-mocking convention and the module constructs a
// real Drizzle client at import time (mirrors lib/db/index.ts everywhere else in the codebase).
// Run: bun scripts/ops-metrics.test.ts   or: npx tsx scripts/ops-metrics.test.ts
import assert from 'node:assert/strict'
import { todayBangkokRange, yesterdayBangkokRange } from '../lib/ops/metrics'

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
  t('today range is [00:00:00, next-day 00:00:00) in Bangkok, mid-day UTC', () => {
    // 2026-07-14 12:00:00 UTC = 2026-07-14 19:00:00 Bangkok (+7) — unambiguously mid-day.
    const r = todayBangkokRange(new Date('2026-07-14T12:00:00.000Z'))
    assert.deepEqual(r, { start: '2026-07-14 00:00:00', end: '2026-07-15 00:00:00', label: '2026-07-14' })
  })

  t('crossing UTC midnight into Bangkok\'s next day still resolves to the Bangkok calendar day', () => {
    // 2026-07-13 18:00:00 UTC = 2026-07-14 01:00:00 Bangkok — still July 13 in UTC, but July 14
    // locally. This is exactly the boundary a naive `new Date().toISOString().slice(0,10)` gets
    // wrong (#adversarial-matrix input-boundary: ข้ามเที่ยงคืน).
    const r = todayBangkokRange(new Date('2026-07-13T18:00:00.000Z'))
    assert.equal(r.label, '2026-07-14')
    assert.equal(r.start, '2026-07-14 00:00:00')
  })

  t('month rollover: last day of month -> range end lands on the 1st of next month', () => {
    // 2026-06-30 20:00:00 UTC = 2026-07-01 03:00:00 Bangkok.
    const r = todayBangkokRange(new Date('2026-06-30T20:00:00.000Z'))
    assert.equal(r.label, '2026-07-01')
    assert.equal(r.end, '2026-07-02 00:00:00')
  })

  t('year rollover: Dec 31 Bangkok -> end range lands on Jan 1 next year', () => {
    // 2026-12-31 20:00:00 UTC = 2027-01-01 03:00:00 Bangkok.
    const r = todayBangkokRange(new Date('2026-12-31T20:00:00.000Z'))
    assert.equal(r.label, '2027-01-01')
    assert.equal(r.end, '2027-01-02 00:00:00')
  })

  t('yesterday range is exactly one day behind today, no gap or overlap', () => {
    const now = new Date('2026-07-14T12:00:00.000Z')
    const today = todayBangkokRange(now)
    const yesterday = yesterdayBangkokRange(now)
    assert.equal(yesterday.end, today.start)
    assert.equal(yesterday.label, '2026-07-13')
  })

  if (process.exitCode) {
    console.error(`\nops-metrics: FAILED (${pass} passed)`)
  } else {
    console.log(`ops-metrics: all ${pass} passed ✓`)
  }
}

main()
