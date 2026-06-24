// Deterministic unit tests for the home CTA readiness gate (#mootech-cta-race-gate).
// DB-free, React-free (pure resolveCtaReady logic). Proves the gate closes the
// async race: an authed returning user may NOT fire the CTA until resultHydrated.
// Run: npx tsx scripts/cta-ready.test.ts   or: bun scripts/cta-ready.test.ts
import assert from 'node:assert/strict'
import { resolveCtaReady } from '../lib/auth/cta-ready'

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

// ── THE RACE GUARD: authed but routing state not yet hydrated -> NOT ready ──
// (returning user clicks before get-user returns -> would route to /register)
t('authed + NOT hydrated -> not ready [the race guard]', () => {
  assert.equal(resolveCtaReady('authed', false), false)
})

t('authed + hydrated -> ready (result state known, safe to route)', () => {
  assert.equal(resolveCtaReady('authed', true), true)
})

// ── anonymous needs no result data -> ready immediately (routes to /login) ──
t('anon + not hydrated -> ready (no data to wait for)', () => {
  assert.equal(resolveCtaReady('anon', false), true)
})

t('anon + hydrated -> ready', () => {
  assert.equal(resolveCtaReady('anon', true), true)
})

// ── identity still resolving -> never fire ──
t('loading + not hydrated -> not ready', () => {
  assert.equal(resolveCtaReady('loading', false), false)
})

t('loading + hydrated -> not ready (identity not resolved yet)', () => {
  assert.equal(resolveCtaReady('loading', true), false)
})

if (process.exitCode) {
  console.error(`\ncta-ready: FAILED (${pass} passed)`)
} else {
  console.log(`cta-ready: all ${pass} passed ✓`)
}
