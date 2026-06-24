// Parity regression test for get-user `is_not_expired` (#mootech-fold-parity-audit).
//
// pages/api/user.ts used to compute expiry with `new Date()` + `setHours(0,0,0,0)`
// in the SERVER's timezone. On Vercel (UTC) that flips at UTC midnight (00:00Z),
// ~7h off Bangkok, so a member sitting near a Bangkok day-boundary got the WRONG
// is_not_expired (shown paid for up to 7 extra hours, or expired early). That is
// the "แตกเป็นจุดๆ" drift: some users hit it (those near midnight), most don't.
//
// user.ts now delegates to usage-core.isNotExpired (Asia/Bangkok, mirrors the
// NestJS MomentService). This locks the boundary at BANGKOK midnight (= 17:00 UTC),
// not UTC midnight, so it matches the BE. Instants below use explicit `Z` so the
// test is deterministic regardless of the host running it.
// Run: npx tsx scripts/user-api-parity.test.ts   or: bun scripts/user-api-parity.test.ts
import assert from 'node:assert/strict'
import { isNotExpired } from '../lib/usage-core'

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

// ── THE TZ BOUNDARY (the regression the old server-local code got wrong) ──
// expire = 2026-06-14. Bangkok midnight = 17:00 UTC. The flip must happen there.
t('expire=2026-06-14 @ Bangkok 23:59 (16:59Z) -> still valid [true]', () => {
  assert.equal(isNotExpired('2026-06-14', new Date('2026-06-14T16:59:00Z')), true)
})
t('expire=2026-06-14 @ Bangkok 00:01 next day (17:01Z) -> expired [false] (old UTC code wrongly said true)', () => {
  assert.equal(isNotExpired('2026-06-14', new Date('2026-06-14T17:01:00Z')), false)
})
// Same UTC date (the 14th) on both sides of the assertion above — proving the flip
// is governed by Bangkok midnight, NOT the server's UTC date.

// ── ordinary cases (Bangkok civil-date compare) ──
t('expire today (Bangkok) -> true', () => {
  assert.equal(isNotExpired('2026-06-14', new Date('2026-06-14T05:00:00Z')), true) // BKK 12:00
})
t('expire yesterday -> false', () => {
  assert.equal(isNotExpired('2026-06-13', new Date('2026-06-14T05:00:00Z')), false)
})
t('expire tomorrow @ its own 00:01 BKK -> true', () => {
  assert.equal(isNotExpired('2026-06-15', new Date('2026-06-14T17:01:00Z')), true)
})

// ── shape parity with the removed local guards (null/garbage/datetime) ──
t('null -> false', () => assert.equal(isNotExpired(null, new Date('2026-06-14T05:00:00Z')), false))
t('empty -> false', () => assert.equal(isNotExpired('', new Date('2026-06-14T05:00:00Z')), false))
t('datetime string (member row with time) slices to date -> true', () => {
  assert.equal(isNotExpired('2026-12-31 00:00:00', new Date('2026-06-14T05:00:00Z')), true)
})
t('garbage -> false', () => assert.equal(isNotExpired('not-a-date', new Date('2026-06-14T05:00:00Z')), false))

if (process.exitCode) {
  console.error(`\nuser-api-parity: FAILED (${pass} passed)`)
} else {
  console.log(`user-api-parity: all ${pass} passed ✓`)
}
