// Deterministic tests for the แต้ม breakdown categorization (#mumate-ops-dashboard-pr56).
// categorizePointsRows is pure — no DB round-trip. The live query (fetchPointsBreakdown) was
// verified manually 2026-07-14 against production (see PR description) — today's real data
// (in: สมัครใหม่ +160; out: ดูดวงคู่รัก -10, ดูดวงเรื่องงาน -10) matched the direction/label
// mapping exactly.
// Run: bun scripts/ops-pr56-points-breakdown.test.ts   or: npx tsx scripts/ops-pr56-points-breakdown.test.ts
import assert from 'node:assert/strict'
import { categorizePointsRows } from '../lib/ops/metrics'

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
  t('known activities translate to Thai and sort by sign (in = New Register + Friend Get Friend)', () => {
    const result = categorizePointsRows([
      { description: 'New Register', points: 180 },
      { description: 'Friend Get Friend', points: 42 },
      { description: 'Love Mate', points: -30 },
      { description: 'Work Vibe', points: -20 },
    ])
    assert.deepEqual(result.in, [
      { label: 'สมัครใหม่', points: 180 },
      { label: 'ชวนเพื่อน', points: 42 },
    ])
    assert.deepEqual(result.out, [
      { label: 'ดูดวงคู่รัก', points: -30 },
      { label: 'ดูดวงเรื่องงาน', points: -20 },
    ])
  })

  t('zero points lands in "in", not dropped and not miscategorized as out', () => {
    const result = categorizePointsRows([{ description: 'New Register', points: 0 }])
    assert.deepEqual(result.in, [{ label: 'สมัครใหม่', points: 0 }])
    assert.deepEqual(result.out, [])
  })

  t('unknown activity description (future activity type) falls back to raw description, not dropped', () => {
    const result = categorizePointsRows([{ description: 'Some New Activity', points: 5 }])
    assert.deepEqual(result.in, [{ label: 'Some New Activity', points: 5 }])
  })

  t('unknown activity with negative points still correctly sorts to "out" via sign, not id map', () => {
    const result = categorizePointsRows([{ description: 'Some Future Penalty', points: -7 }])
    assert.deepEqual(result.out, [{ label: 'Some Future Penalty', points: -7 }])
  })

  t('empty rows (no activity today) -> both buckets empty, no crash', () => {
    const result = categorizePointsRows([])
    assert.deepEqual(result, { in: [], out: [] })
  })

  if (process.exitCode) {
    console.error(`\nops-pr56-points-breakdown: FAILED (${pass} passed)`)
  } else {
    console.log(`ops-pr56-points-breakdown: all ${pass} passed ✓`)
  }
}

main()
