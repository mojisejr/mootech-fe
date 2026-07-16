// Deterministic unit tests for the homepage auto-redirect window gate (#calculator-homepage-swap,
// option c). DB-free, React-free (pure isWithinRedirectWindow logic). Proves the redirect may fire
// only while inside the window after the calculator becomes visible — so a logged-in user who starts
// interacting after a late (slow-network) settle is NOT yanked out of the form/result.
// Run: npx tsx scripts/redirect-window.test.ts   or: bun scripts/redirect-window.test.ts
import assert from 'node:assert/strict'
import { isWithinRedirectWindow } from '../lib/auth/redirect-window'

const WINDOW = 1500

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

// ── window not started (calc not visible yet) -> never fire ──
t('null elapsed (calc not visible) -> not within window', () => {
  assert.equal(isWithinRedirectWindow(null, WINDOW), false)
})

// ── inside the window -> allowed to fire (the funnel, common fast-hydrate case) ──
t('0ms elapsed -> within window (fires immediately on a fast settle)', () => {
  assert.equal(isWithinRedirectWindow(0, WINDOW), true)
})

t('well inside the window -> within', () => {
  assert.equal(isWithinRedirectWindow(800, WINDOW), true)
})

t('exactly at the window boundary -> within (inclusive)', () => {
  assert.equal(isWithinRedirectWindow(WINDOW, WINDOW), true)
})

// ── past the window (late settle, slow network) -> do NOT fire (no yank) ──
t('1ms past the window -> NOT within (no mid-interaction yank)', () => {
  assert.equal(isWithinRedirectWindow(WINDOW + 1, WINDOW), false)
})

t('far past the window (user mid-form) -> NOT within', () => {
  assert.equal(isWithinRedirectWindow(10_000, WINDOW), false)
})

// ── defensive: negative elapsed (clock skew) -> treat as within, never strand ──
t('negative elapsed (clock skew) -> within (defensive)', () => {
  assert.equal(isWithinRedirectWindow(-5, WINDOW), true)
})

if (process.exitCode) {
  console.error(`\nredirect-window: FAILED (${pass} passed)`)
} else {
  console.log(`redirect-window: all ${pass} passed ✓`)
}
