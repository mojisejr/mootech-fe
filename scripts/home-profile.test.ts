// ANCHOR: show-upgrade-rule-c — the v2 home upgrade badge (กติกา ค, ฟีมเคาะ) must HIDE only for a paid
// member whose plan is still valid (payment.is_not_expired === true); free / expired / no-payment / no-user
// all SHOW it — identical to v1 header-v2.tsx so the two versions never disagree about paid status.
// Run: npx tsx scripts/home-profile.test.ts
import assert from 'node:assert/strict'
import { deriveHomeProfile } from '../lib/home/profile'

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

t('paid + still valid (is_not_expired===true) → HIDE badge', () => {
  assert.equal(deriveHomeProfile({ payment: { is_not_expired: true } }).showUpgrade, false)
})
t('free (no payment row) → SHOW badge', () => {
  assert.equal(deriveHomeProfile({ payment: null }).showUpgrade, true)
})
t('expired (is_not_expired===false) → SHOW badge', () => {
  assert.equal(deriveHomeProfile({ payment: { is_not_expired: false } }).showUpgrade, true)
})
t('no user yet → SHOW badge (safe default)', () => {
  assert.equal(deriveHomeProfile(null).showUpgrade, true)
})
// neg-control: a truthy-but-not-true value must NOT hide the badge. If the rule were `!(is_not_expired)`
// (truthy) instead of strict `=== true`, this would wrongly hide it — proving the strict comparison.
t('strict ===true: a truthy non-boolean (1) must NOT hide the badge', () => {
  assert.equal(deriveHomeProfile({ payment: { is_not_expired: 1 as unknown as boolean } }).showUpgrade, true)
})
t('avatar: real picture_url kept', () => {
  assert.equal(deriveHomeProfile({ picture_url: 'https://x/p.jpg' }).pictureUrl, 'https://x/p.jpg')
})
t('avatar: empty/whitespace picture_url → null (Lamun draws the letter tile)', () => {
  assert.equal(deriveHomeProfile({ picture_url: '' }).pictureUrl, null)
  assert.equal(deriveHomeProfile({ picture_url: null }).pictureUrl, null)
})

console.log(`\n  show-upgrade-rule-c: ${pass} passed`)
