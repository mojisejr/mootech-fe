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

console.log(`\n${pass} passed`)
