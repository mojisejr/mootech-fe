// ดวงสมพงศ์ Slice 1 — kind-gate + create-friend gap-fill teeth (goo logic contract).
// Bug-class this guards: (1) the [kind] route resolving the WRONG matching_type or a truthy value for an
// unknown/prototype kind (silent mis-route or a rendered blank instead of the /v2/service redirect);
// (2) the create-friend wrapper landing the two GAP fields (surname/gender — absent from the Figma form)
// in the wrong positions or with undocumented values (a surname↔gender swap is invisible to tsc: both string).
// Run: npx tsx scripts/compatibility.test.ts
//
// ANCHOR: scripts/compatibility.test.ts#compatibility-kind-gate-and-createfriend-gap
import assert from 'node:assert/strict'
import { resolveCompatibilityKind, COMPATIBILITY_KINDS } from '../features/v2-service/compatibility'
import {
  buildCreateFriendArgs,
  COMPAT_FRIEND_DEFAULTS,
  friendInputToPerson,
  applyFriendDetail,
  type NewFriendForm,
} from '../features/v2-service/compatibility-api'

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

// ── kind gate — done-condition #1/#2: prove the VALUE (title + matching_type), not just "two kinds exist" ──
t('love → "ดูดวงคู่รัก" + matching_type LOVE', () => {
  const c = resolveCompatibilityKind('love')
  assert.deepEqual(c, { kind: 'love', title: 'ดูดวงคู่รัก', matchingType: 'LOVE' })
})

t('colleague → "ดูดวงเพื่อนร่วมงาน" + matching_type FRIEND', () => {
  const c = resolveCompatibilityKind('colleague')
  assert.deepEqual(c, { kind: 'colleague', title: 'ดูดวงเพื่อนร่วมงาน', matchingType: 'FRIEND' })
})

// the two kinds send DIFFERENT types (a mut that maps both to LOVE, or love→FRIEND, dies here)
t('love and colleague resolve to DIFFERENT matching_types', () => {
  assert.notEqual(resolveCompatibilityKind('love')!.matchingType, resolveCompatibilityKind('colleague')!.matchingType)
})

// unknown kind → null (drives the /v2/service redirect — "ห้ามเงียบ"). Includes the removed BOSS/EMPLOYEE,
// wrong-case, empty, and PROTOTYPE keys (the object-injection hole: CONFIG['constructor'] would be truthy
// without the allow-list guard).
t('unknown / prototype / wrong-shape kinds → null (never a truthy config)', () => {
  for (const raw of ['boss', 'employee', 'LOVE', 'Colleague', '', ' love', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.equal(resolveCompatibilityKind(raw), null, `expected null for ${JSON.stringify(raw)}`)
  }
  for (const raw of [undefined, null, 123, {}, [], true]) {
    assert.equal(resolveCompatibilityKind(raw as unknown), null, `expected null for ${String(raw)}`)
  }
})

t('COMPATIBILITY_KINDS is exactly [love, colleague] (BOSS/EMPLOYEE removed — ฟีม)', () => {
  assert.deepEqual([...COMPATIBILITY_KINDS], ['love', 'colleague'])
})

// ── create-friend arg-mapping — done-condition #13 (REFRAME 3): gender = the user's CHOICE; surname still gap ──
// FORM uses FEMALE so a hardcode-MALE mutant is actually catchable (a MALE fixture would hide it).
const FORM: NewFriendForm = { name: 'โปเตโต้', birthDay: '1992-08-01', time: '05:30', isRememberTime: true, imageProfile: 'https://x/p.png', gender: 'FEMALE' }

t('buildCreateFriendArgs maps form → v1 positional signature exactly (gender = the chosen value)', () => {
  const args = buildCreateFriendArgs('user-123', FORM)
  // v1: (user_id, dob, name, surname, time, gender, is_remember_time, picture_url)
  assert.deepEqual(args, ['user-123', '1992-08-01', 'โปเตโต้', '', '05:30', 'FEMALE', true, 'https://x/p.png'])
})

t('surname is the DOCUMENTED gap (still absent from the form) → "" at index 3', () => {
  const args = buildCreateFriendArgs('u', FORM)
  assert.equal(args[3], COMPAT_FRIEND_DEFAULTS.surname, 'index 3 must be the surname default')
  assert.equal(args[3], '', 'surname default is empty string')
})

// ANCHOR: scripts/compatibility.test.ts#gender-required-no-silent-fallback
// REFRAME 3 core: the SELECTED gender reaches index 5 — both directions (mut hardcoding MALE dies on FEMALE).
t('the user-chosen gender flows to index 5 (MALE→MALE, FEMALE→FEMALE)', () => {
  assert.equal(buildCreateFriendArgs('u', { ...FORM, gender: 'MALE' })[5], 'MALE')
  assert.equal(buildCreateFriendArgs('u', { ...FORM, gender: 'FEMALE' })[5], 'FEMALE')
})

// 🔴 บอง's guard: if the form fails to send a gender, it must NOT silently become MALE (the exact bug REFRAME 3
// fixes). A reintroduced `form.gender || COMPAT_FRIEND_DEFAULTS.gender` turns '' → 'MALE' → this test goes RED.
t('an absent/empty gender does NOT silently fall back to MALE', () => {
  const args = buildCreateFriendArgs('u', { ...FORM, gender: '' as unknown as NewFriendForm['gender'] })
  assert.notEqual(args[5], 'MALE', 'empty gender must NOT become MALE (silent fallback = the bug we fixed)')
  assert.equal(args[5], '', 'the empty value flows as-is (loud), never coerced to a default')
})

// ── person2 enrichment seam (μุน's flag) — modal gives no dob/time; goo enriches from the friend detail ──
t('friendInputToPerson: modal fields → instant person2, dob/time BLANK (not fabricated)', () => {
  const p = friendInputToPerson({ id: 'f1', name: 'โปเตโต้', surname: 'x', picture_url: 'https://x/f.png' })
  assert.deepEqual(p, { id: 'f1', name: 'โปเตโต้', dob: '', time: '', imageProfile: 'https://x/f.png' })
})

t('friendInputToPerson: no picture → imageProfile ""', () => {
  assert.equal(friendInputToPerson({ id: 'f1', name: 'ก' }).imageProfile, '')
})

const base = friendInputToPerson({ id: 'f1', name: 'โปเตโต้', picture_url: 'p' })

t('applyFriendDetail: real detail fills dob/time', () => {
  const p = applyFriendDetail(base, { dob: '1992-08-01', time: '05:30' })
  assert.equal(p.dob, '1992-08-01')
  assert.equal(p.time, '05:30')
  assert.equal(p.id, 'f1') // identity preserved
})

t('applyFriendDetail: error / null / missing keys → KEEP base (no strand, no fabricated dob/time)', () => {
  assert.deepEqual(applyFriendDetail(base, null), base)
  assert.deepEqual(applyFriendDetail(base, { error: 'boom' }), base)
  assert.deepEqual(applyFriendDetail(base, {}), base) // missing dob/time keys → stays '' (mut that drops the ||base fallback would set undefined here)
  assert.equal(applyFriendDetail(base, {}).dob, '', 'dob must remain "" when detail lacks it, never undefined')
})

console.log(`\n${process.exitCode ? '❌ compatibility FAIL' : `✅ compatibility PASS (${pass})`}`)
