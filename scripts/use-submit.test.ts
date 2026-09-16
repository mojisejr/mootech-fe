// Deterministic unit tests for the useSubmit double-fire guard
// (#mootech-matching-loading-ux). React-free: tests the pure createSubmitGuard
// helper that the hook delegates to. Run: npx tsx scripts/use-submit.test.ts
//                                     or: bun scripts/use-submit.test.ts
import assert from 'node:assert/strict'
import { createSubmitGuard } from '../lib/ui/use-submit'
import { test as t } from 'vitest'



// ── first acquire succeeds, second is blocked while held ──
t('tryAcquire returns true once, false while still held', () => {
  const g = createSubmitGuard()
  assert.equal(g.tryAcquire(), true)
  assert.equal(g.tryAcquire(), false)
  assert.equal(g.tryAcquire(), false)
})

// ── release resets the guard ──
t('release resets so a later acquire succeeds again', () => {
  const g = createSubmitGuard()
  assert.equal(g.tryAcquire(), true)
  g.release()
  assert.equal(g.tryAcquire(), true)
})

// ── THE VOW: rapid double-fire runs the wrapped fn exactly once ──
t('rapid calls under one hold run the protected work only once', () => {
  const g = createSubmitGuard()
  let runs = 0
  const protectedRun = () => {
    if (g.tryAcquire()) runs++ // simulate submit() body guard
  }
  // rapid taps before release
  protectedRun()
  protectedRun()
  protectedRun()
  assert.equal(runs, 1)
  // after release, a fresh tap runs again
  g.release()
  protectedRun()
  assert.equal(runs, 2)
})

// ── isHeld reflects state for diagnostics ──
t('isHeld is false initially, true after acquire, false after release', () => {
  const g = createSubmitGuard()
  assert.equal(g.isHeld, false)
  g.tryAcquire()
  assert.equal(g.isHeld, true)
  g.release()
  assert.equal(g.isHeld, false)
})

