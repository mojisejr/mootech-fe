// Deterministic unit tests for the auth-gated render-gate decision
// (#mootech-fortune-stick-hydration-fix). DB-free, React-free (pure logic).
// Run: npx tsx scripts/render-gate.test.ts   or:  bun scripts/render-gate.test.ts
import assert from 'node:assert/strict'
import { shouldRenderScreenLoading } from '../lib/auth/render-gate'

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

// ── THE FIX: before mount, ALWAYS ScreenLoading so the first client render matches
//    the server (which is never "authed") — this is what kills the #418/#423 mismatch ──
t('not mounted + authed -> ScreenLoading (first client render matches server)', () => {
  assert.equal(shouldRenderScreenLoading(false, 'authed'), true)
})

t('not mounted + loading -> ScreenLoading', () => {
  assert.equal(shouldRenderScreenLoading(false, 'loading'), true)
})

t('not mounted + anon -> ScreenLoading', () => {
  assert.equal(shouldRenderScreenLoading(false, 'anon'), true)
})

// ── ADDITIVE: once mounted, behaviour is byte-for-byte the old `authStatus !== "authed"` ──
t('mounted + authed -> render page (gate opens, identity preserved)', () => {
  assert.equal(shouldRenderScreenLoading(true, 'authed'), false)
})

t('mounted + loading -> ScreenLoading (identity gate still holds)', () => {
  assert.equal(shouldRenderScreenLoading(true, 'loading'), true)
})

t('mounted + anon -> ScreenLoading (identity gate still holds; redirect effect unchanged)', () => {
  assert.equal(shouldRenderScreenLoading(true, 'anon'), true)
})

if (!process.exitCode) console.log(`✓ all ${pass} render-gate assertions passed`)
else console.error(`\n${pass} passed, FAILURES above`)
