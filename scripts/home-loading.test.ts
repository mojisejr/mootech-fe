// ANCHOR: home-loading-progressive-reveal — the v2 home per-zone grey-block rule (ฟีมเคาะ: โครงจริง
// ตั้งแต่เฟรมแรก, ช่องที่ข้อมูลยังไม่มา = บล็อกเทา ❌ ไม่ใช่มาสคอตสำรอง 01.webp). The two zones resolve
// from DIFFERENT requests at DIFFERENT times, so `profile` must be able to un-grey while `mascot` is still
// loading — a naive single `phase !== 'home'` flag for both would fail the "user in, chart pending" case.
// On API error the hook settles to 'home' → both false → safe fallbacks show, never an infinite grey block.
// Run: npx tsx scripts/home-loading.test.ts
import assert from 'node:assert/strict'
import { deriveHomeLoading } from '../lib/home/loading'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

// mount: nothing fetched yet → both zones grey
t('resolving + no user → profile grey + mascot grey', () => {
  assert.deepEqual(deriveHomeLoading('resolving', false), { profile: true, mascot: true })
})

// UserGetById returned, ChineseHoroscopeGet still in flight → avatar reveals, mascot stays grey.
// This is the discriminating case: it FAILS if both flags were `phase === 'resolving'`.
t('resolving + user in → profile REVEALS, mascot still grey', () => {
  assert.deepEqual(deriveHomeLoading('resolving', true), { profile: false, mascot: true })
})

// happy path settled → everything shows
t('home + user → nothing grey', () => {
  assert.deepEqual(deriveHomeLoading('home', true), { profile: false, mascot: false })
})

// API error path: hook lands home with user=null → show letter-avatar + 01.webp fallback, NOT infinite grey
t('home + no user (error fallback) → nothing grey (fallbacks, not stuck grey)', () => {
  assert.deepEqual(deriveHomeLoading('home', false), { profile: false, mascot: false })
})

// redirecting → screen is not rendered (caller holds the frame); flags are moot but must be inert, not grey
t('redirecting → both false (screen not rendered anyway)', () => {
  assert.deepEqual(deriveHomeLoading('redirecting', false), { profile: false, mascot: false })
  assert.deepEqual(deriveHomeLoading('redirecting', true), { profile: false, mascot: false })
})

// ── 🔴 DoD#3 MONEY-BUG GUARD (P3): the chart cache (mascotReady) may un-grey the MASCOT instantly, but must
//    NEVER un-grey the PROFILE (avatar + upgrade badge) — those are live-row-only. A cached "not paid" badge
//    shown to a user who just paid is the money bug. `profile` must be ⊥ mascotReady. These bite before the
//    cache is even wired (บอง: place the gate + prove it bites BEFORE building what sits under it). ──
t('DoD#1: cached chart (mascotReady) while row in flight → MASCOT un-greys instantly', () => {
  // resolving, no user yet, but the chart is cached → mascot shows now (that is the whole point of P3)
  assert.equal(deriveHomeLoading('resolving', false, true).mascot, false)
})
t('🔴 DoD#3: cached chart must NOT un-grey PROFILE — avatar/upgrade stay grey until the LIVE row lands', () => {
  // the money-bug boundary: mascotReady=true un-greys mascot, but profile MUST remain grey while row absent.
  // A mutant that leaks mascotReady into profile (profile un-greys from cache) turns THIS red.
  assert.deepEqual(deriveHomeLoading('resolving', false, true), { profile: true, mascot: false })
})
t('🔴 DoD#3: profile is a pure function of (phase,hasUser) — identical for BOTH mascotReady values', () => {
  for (const phase of ['resolving', 'home', 'redirecting'] as const) {
    for (const hasUser of [false, true]) {
      assert.equal(
        deriveHomeLoading(phase, hasUser, false).profile,
        deriveHomeLoading(phase, hasUser, true).profile,
        `profile must not depend on mascotReady (phase=${phase} hasUser=${hasUser})`,
      )
    }
  }
})

console.log(`\n${pass} passed`)
