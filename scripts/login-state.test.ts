// Deterministic unit tests for home-page login-state logic (#mootech-login-loop-fix).
// DB-free, React-free (pure shouldRegister / shouldClearToken logic).
// Run: npx tsx scripts/login-state.test.ts   or: bun scripts/login-state.test.ts
import assert from 'node:assert/strict'
import { shouldRegister, shouldClearToken } from '../lib/auth/login-state'

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

// ── shouldRegister: idempotent — fire only when authenticated AND no member id ──
t('authenticated + no member id -> register (first login OR after wipe)', () => {
  assert.equal(shouldRegister('authenticated', false), true)
})

t('authenticated + has member id -> skip (avatar already resolved)', () => {
  assert.equal(shouldRegister('authenticated', true), false)
})

t('loading -> never register (no double-fire / no race during hydration)', () => {
  assert.equal(shouldRegister('loading', false), false)
  assert.equal(shouldRegister('loading', true), false)
})

t('unauthenticated -> never register', () => {
  assert.equal(shouldRegister('unauthenticated', false), false)
  assert.equal(shouldRegister('unauthenticated', true), false)
})

// ── shouldClearToken: ONLY on settled logout, NEVER on the loading tick ──
t('unauthenticated -> clear token (genuine logout)', () => {
  assert.equal(shouldClearToken('unauthenticated'), true)
})

t('loading -> NEVER clear token (the loading-tick wipe = the login loop bug)', () => {
  assert.equal(shouldClearToken('loading'), false)
})

t('authenticated -> never clear token', () => {
  assert.equal(shouldClearToken('authenticated'), false)
})

// ── the loop regression: missing cookie under loading must NOT wipe AND NOT register ──
t('loading + no cookie -> no register, no clear (let it settle, never wipe)', () => {
  assert.equal(shouldRegister('loading', false), false)
  assert.equal(shouldClearToken('loading'), false)
})

if (!process.exitCode) console.log(`✓ all ${pass} login-state assertions passed`)
else console.error(`\n${pass} passed, FAILURES above`)
