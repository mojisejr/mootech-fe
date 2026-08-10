// A5 (#233): the onboarded gate must read onboarded_at, and a user WITH it must NOT be sent to first-run.
// Run: npx tsx scripts/first-run-gate.test.ts
// If GET /user ever drops onboarded_at from its response, every onboarded user regresses into the loop —
// this test is the tripwire (and the onboarded fixture below stops compiling if the field is removed).
import assert from 'node:assert/strict'
import { needsFirstRun } from '../lib/home/first-run-gate'

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

// MUTANT: if the gate stopped reading onboarded_at (e.g. `return false`), THIS fails (null/missing → home).
t('onboarded (onboarded_at set) ⇒ does NOT need first-run', () => {
  assert.equal(needsFirstRun({ onboarded_at: '2026-01-01 00:00:00' }), false)
})
t('never onboarded (null) ⇒ needs first-run', () => {
  assert.equal(needsFirstRun({ onboarded_at: null }), true)
})
t('field MISSING from response ⇒ treated as not onboarded (the dropped-field regression)', () => {
  assert.equal(needsFirstRun({}), true)
})
t('empty string ⇒ not onboarded', () => {
  assert.equal(needsFirstRun({ onboarded_at: '' }), true)
})

console.log(`\n✅ first-run-gate — ${pass} passed`)
