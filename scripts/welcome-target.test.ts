// Deterministic unit tests for home CTA routing (#mootech-home-cta-bounce-migration).
// DB-free, React-free (pure resolveWelcomeTarget logic). Does NOT depend on the
// dev-login provider (which sets infoUserId itself and would mask the regression).
// Run: npx tsx scripts/welcome-target.test.ts   or: bun scripts/welcome-target.test.ts
import assert from 'node:assert/strict'
import { resolveWelcomeTarget } from '../lib/auth/welcome-target'

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

// ── THE REGRESSION: returning authed user must NEVER bounce to login ──
// (returning user has MEMBER_ID but the old guard read infoUserId='' -> bounced)
t('authed + no result code + not refresh -> register (NOT login) [the regression]', () => {
  assert.deepEqual(resolveWelcomeTarget('authed', '', false), { kind: 'register' })
})

t('authed + no result code + refresh -> register-refresh (NOT login)', () => {
  assert.deepEqual(resolveWelcomeTarget('authed', '', true), { kind: 'register-refresh' })
})

t('authed + result code present -> result page', () => {
  assert.deepEqual(resolveWelcomeTarget('authed', 'RC123', false), { kind: 'result', code: 'RC123' })
})

t('authed + result code with whitespace -> trimmed result', () => {
  assert.deepEqual(resolveWelcomeTarget('authed', '  RC123  ', true), { kind: 'result', code: 'RC123' })
})

// ── only a genuinely anonymous user may go to login ──
t('anon -> login', () => {
  assert.deepEqual(resolveWelcomeTarget('anon', '', false), { kind: 'login' })
})

t('anon -> login even if a stale result code lingers', () => {
  assert.deepEqual(resolveWelcomeTarget('anon', 'RC123', false), { kind: 'login' })
})

// ── hydrating identity must WAIT, never bounce (fail-to-loading-not-anon) ──
t('loading -> wait (never bounce a hydrating user)', () => {
  assert.deepEqual(resolveWelcomeTarget('loading', '', false), { kind: 'wait' })
})

t('loading -> wait even with a result code (identity not resolved yet)', () => {
  assert.deepEqual(resolveWelcomeTarget('loading', 'RC123', false), { kind: 'wait' })
})

if (process.exitCode) {
  console.error(`\nwelcome-target: FAILED (${pass} passed)`)
} else {
  console.log(`welcome-target: all ${pass} passed ✓`)
}
