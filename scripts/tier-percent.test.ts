// Mutant proof for the ONE-NUMBER reader (harness/tier-percent.ts) — B-1. Plain tsx + node:assert.
// Two scale mutants must turn the ONE-NUMBER invariant RED; the clean case stays GREEN. Proven at the
// exact pure logic the harness assertion calls, so no browser is needed to show the mutant biting.
import assert from 'node:assert'
import { onePercentAgree, readPct } from '../harness/tier-percent'

let pass = 0
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

// The old regex, kept here only to DEMONSTRATE why the gate used to go green on a fraction-scale leak.
const oldRead = (s: string) => s.match(/(\d+)%/)?.[1] ?? ''

console.log('— reader: decimals are read as numbers (were dropped before) —')
ok('readPct("40.83%") === 40.83 (real man-vs-day value)', readPct('40.83%') === 40.83)
ok('readPct("61.67%") === 61.67', readPct('61.67%') === 61.67)
ok('readPct("57%") === 57', readPct('57%') === 57)
ok('readPct("no percent here") === null', readPct('no percent here') === null)

console.log('\n— old regex was lossy (why the gate certified the bug) —')
console.log(`  "57.3%" old→"${oldRead('57.3%')}"  new→${readPct('57.3%')}`)
console.log(`  "0.57%" old→"${oldRead('0.57%')}"  new→${readPct('0.57%')}`)
ok('old regex read "57.3%" as "3" (garbage)', oldRead('57.3%') === '3')
ok('old regex read "0.57%" as "57" → MATCHED a correct ring "57%" → gate GREEN on the scale bug', oldRead('0.57%') === '57')
ok('new reader reads "0.57%" as 0.57 (the real fraction, not 57)', readPct('0.57%') === 0.57)

console.log('\n— ONE-NUMBER invariant: clean GREEN, both mutants RED —')
const clean = onePercentAgree('57.3%', '57.3%', '57.3%')
const mutDecimal = onePercentAgree('57.3%', '57.3%', '57%') // tile 57.3, ring 57 — a rounding split
const mutFraction = onePercentAgree('0.57%', '0.57%', '57%') // tile 0.57 (scale leaked), ring 57 (correct)
console.log(`  CLEAN               57.3 / 57.3 / 57.3 → agree=${clean}   → ${clean ? 'GREEN ✓' : 'RED'}`)
console.log(`  mut-decimal-percent 57.3 / 57.3 / 57   → agree=${mutDecimal}  → ${mutDecimal ? 'GREEN' : 'RED (caught) ✓'}`)
console.log(`  mut-fraction-scale  0.57 / 0.57 / 57   → agree=${mutFraction}  → ${mutFraction ? 'GREEN' : 'RED (caught) ✓'}`)
ok('CLEAN → gate GREEN (agree)', clean === true)
ok('mut-decimal-percent → gate RED (disagree)', mutDecimal === false)
ok('mut-fraction-scale → gate RED (disagree)', mutFraction === false)
// and the fraction mutant would have PASSED the old string compare (both "0.57%" → old "57" === "57")
ok('proof: old string compare would have PASSED mut-fraction-scale', oldRead('0.57%') === oldRead('0.57%') && oldRead('0.57%') === '57')

console.log(`\n✅ tier-percent.test.ts — ${pass} assertions passed`)
