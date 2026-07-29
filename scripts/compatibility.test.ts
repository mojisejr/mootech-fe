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

// ── create-friend gap-fill — done-condition #13: the two fields absent from the Figma form ──
const FORM: NewFriendForm = { name: 'โปเตโต้', birthDay: '1992-08-01', time: '05:30', isRememberTime: true, imageProfile: 'https://x/p.png' }

t('buildCreateFriendArgs maps form → v1 positional signature exactly', () => {
  const args = buildCreateFriendArgs('user-123', FORM)
  // v1: (user_id, dob, name, surname, time, gender, is_remember_time, picture_url)
  assert.deepEqual(args, ['user-123', '1992-08-01', 'โปเตโต้', '', '05:30', 'MALE', true, 'https://x/p.png'])
})

t('the two GAP fields carry the DOCUMENTED defaults in the RIGHT positions', () => {
  const args = buildCreateFriendArgs('u', FORM)
  assert.equal(args[3], COMPAT_FRIEND_DEFAULTS.surname, 'index 3 must be surname default')
  assert.equal(args[3], '', 'surname default is empty string')
  assert.equal(args[5], COMPAT_FRIEND_DEFAULTS.gender, 'index 5 must be gender default')
  assert.equal(args[5], 'MALE', 'gender default is MALE (v1 modal-add-freind default)')
  // a surname↔gender swap (mut) puts 'MALE' at 3 / '' at 5 → both asserts above fail
  assert.notEqual(args[3], args[5], 'surname and gender defaults must not be identical (guards a swap)')
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
