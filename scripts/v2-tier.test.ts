// Unit gate for the v2 paid-tier seam (lib/v2/tier.ts). Plain tsx + node:assert (ci.yml `for f in
// scripts/*.test.ts`). The pure logic behind useV2Tier — the whole free/paid state-table.
//
// ANCHOR: scripts/v2-tier.test.ts#v2-tier-gate-both-directions
// Bug-class this owns: a paid-gate that GUESSES when the tier is not known. An unknown tier is wrong BOTH
// ways — reading it as free hides a paying user's content; reading it as paid leaks paid content to free.
// So computeTier must return `null` (not false) while loading AND on a fetch error, and must NEVER report
// isPaid=true without a strict `payment.is_not_expired === true`. The mutants below prove each guard bites.
import assert from 'node:assert'
import { computeTier, isPaidMember } from '../lib/v2/tier' // #v2-tier-gate-both-directions

let pass = 0
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

// ── isPaidMember — strict === true, never truthy ──
ok('paid when is_not_expired === true', isPaidMember({ payment: { is_not_expired: true } }) === true)
ok('not paid when false', isPaidMember({ payment: { is_not_expired: false } }) === false)
ok('not paid when null field', isPaidMember({ payment: { is_not_expired: null } }) === false)
ok('not paid when no payment row', isPaidMember({}) === false)
ok('not paid when null user', isPaidMember(null) === false)
ok('strict: string "true" is NOT paid (mutant: truthy)', isPaidMember({ payment: { is_not_expired: 'true' as unknown as boolean } }) === false)
ok('strict: 1 is NOT paid (mutant: truthy)', isPaidMember({ payment: { is_not_expired: 1 as unknown as boolean } }) === false)

// ── computeTier — the full state-table ──
const PAID = { payment: { is_not_expired: true } }
const FREE = { payment: { is_not_expired: false } }

const noAccount = computeTier({ userId: '', done: false, errored: false, user: null })
ok('no account → KNOWN free (isPaid=false, not loading)', noAccount.isPaid === false && noAccount.loading === false)

const loading = computeTier({ userId: 'u1', done: false, errored: false, user: null })
ok('loading → isPaid=null (NOT false — no free flash), loading=true', loading.isPaid === null && loading.loading === true)

const errored = computeTier({ userId: 'u1', done: true, errored: true, user: null })
ok('fetch error → isPaid=null (NOT false — do not hide paid content)', errored.isPaid === null && errored.loading === false)

const noUser = computeTier({ userId: 'u1', done: true, errored: false, user: null })
ok('settled but no user row → isPaid=null (unknown)', noUser.isPaid === null && noUser.loading === false)

const paid = computeTier({ userId: 'u1', done: true, errored: false, user: PAID })
ok('resolved paid → isPaid=true', paid.isPaid === true && paid.loading === false)

const free = computeTier({ userId: 'u1', done: true, errored: false, user: FREE })
ok('resolved free → isPaid=false', free.isPaid === false && free.loading === false)

// ── the two directions the gate must never take (explicit, so a mutant flipping either fails loudly) ──
ok('NEVER false-while-loading (would flash free content)', loading.isPaid !== false)
ok('NEVER false-on-error (would hide paid content)', errored.isPaid !== false)
ok('NEVER true without confirmed payment', paid.isPaid === true && free.isPaid !== true && errored.isPaid !== true && loading.isPaid !== true)

console.log(`✅ v2-tier.test.ts — ${pass} assertions passed`)
