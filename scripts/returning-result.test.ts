// Deterministic unit tests for returning-user routing-state hydration
// (#mootech-home-cta-bounce-migration). DB-free, React-free.
// Run: npx tsx scripts/returning-result.test.ts   or: bun scripts/returning-result.test.ts
import assert from 'node:assert/strict'
import { resolveReturningResult } from '../lib/auth/returning-result'

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

// ── returning user WITH a computed chart -> expose code -> CTA opens /my-destiny ──
t('result_code present, not refresh -> {RC123, false} [the fix]', () => {
  assert.deepEqual(resolveReturningResult({ result_code: 'RC123', is_refresh: false }),
    { resultCode: 'RC123', isRefreshResult: false })
})

t('result_code with whitespace is trimmed', () => {
  assert.deepEqual(resolveReturningResult({ result_code: '  RC123  ', is_refresh: false }),
    { resultCode: 'RC123', isRefreshResult: false })
})

// ── refresh flagged -> leave code empty so CTA recomputes (/register?refresh=1) ──
t('result_code present + refresh -> empty code, refresh true', () => {
  assert.deepEqual(resolveReturningResult({ result_code: 'RC123', is_refresh: true }),
    { resultCode: '', isRefreshResult: true })
})

// ── no computed chart -> empty -> CTA routes to /register (input birth) ──
t('no result_code -> empty, not refresh', () => {
  assert.deepEqual(resolveReturningResult({ result_code: '', is_refresh: false }),
    { resultCode: '', isRefreshResult: false })
})

t('null result_code -> empty', () => {
  assert.deepEqual(resolveReturningResult({ result_code: null, is_refresh: false }),
    { resultCode: '', isRefreshResult: false })
})

t('undefined / missing fields -> empty', () => {
  assert.deepEqual(resolveReturningResult({}), { resultCode: '', isRefreshResult: false })
  assert.deepEqual(resolveReturningResult(null), { resultCode: '', isRefreshResult: false })
})

if (process.exitCode) {
  console.error(`\nreturning-result: FAILED (${pass} passed)`)
} else {
  console.log(`returning-result: all ${pass} passed ✓`)
}
