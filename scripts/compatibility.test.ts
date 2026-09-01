// ดวงสมพงศ์ Slice 1 — kind-gate + create-friend gap-fill teeth (goo logic contract).
// Bug-class this guards: (1) the [kind] route resolving the WRONG matching_type or a truthy value for an
// unknown/prototype kind (silent mis-route or a rendered blank instead of the /v2/service redirect);
// (2) the create-friend wrapper landing the two GAP fields (surname/gender — absent from the Figma form)
// in the wrong positions or with undocumented values (a surname↔gender swap is invisible to tsc: both string).
// Run: npx tsx scripts/compatibility.test.ts
//
// ANCHOR: scripts/compatibility.test.ts#compatibility-kind-gate-and-createfriend-gap
import assert from 'node:assert/strict'
import { resolveCompatibilityKind, COMPATIBILITY_KINDS, WORK_MATCHING_TYPES, compatibilityKindOfMatchingType } from '../features/v2-service/compatibility'
import {
  buildCreateFriendArgs,
  COMPAT_FRIEND_DEFAULTS,
  friendInputToPerson,
  applyFriendDetail,
  friendDetailToEditForm,
  buildEditFriendArgs,
  mapUpdateFriendResult,
  type NewFriendForm,
  type EditFriendForm,
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
  // #569 added pickLabel; #585 removed hasRoles with the picker. deepEqual is kept ON PURPOSE (not
  // loosened to a field check): it is
  // what turned red when the contract grew, which is the whole reason to know the contract grew.
  assert.deepEqual(c, { kind: 'love', title: 'ดูดวงคู่รัก', matchingType: 'LOVE', pickLabel: 'เลือกคู่รัก' })
})

t('colleague → "ดูดวงเพื่อนร่วมงาน" + matching_type FRIEND', () => {
  const c = resolveCompatibilityKind('colleague')
  assert.deepEqual(c, { kind: 'colleague', title: 'ดูดวงเพื่อนร่วมงาน', matchingType: 'FRIEND', pickLabel: 'เลือกเพื่อนร่วมงาน' })
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

// ── #266 edit-friend seam (prefill · positional args · failure reason) ────────────────────────────
t('friendDetailToEditForm: prefill ALL fields from detail (snake_case → form)', () => {
  assert.deepEqual(
    friendDetailToEditForm({
      name: 'สมชาย', surname: 'ใจดี', dob: '1990-05-01', time: '08:30',
      gender: 'FEMALE', is_remember_time: true,
    }),
    { name: 'สมชาย', surname: 'ใจดี', birthDay: '1990-05-01', time: '08:30', isRememberTime: true, gender: 'FEMALE' },
  )
})
t('friendDetailToEditForm: friend added without birth time → time "" (user can fill it in)', () => {
  const f = friendDetailToEditForm({ name: 'ก', dob: '2000-01-01', time: '', is_remember_time: false })
  assert.equal(f.time, '')
  assert.equal(f.isRememberTime, false)
})
t('friendDetailToEditForm: null / legacy-null gender → MALE (visible default, never undefined)', () => {
  assert.deepEqual(friendDetailToEditForm(null), { name: '', surname: '', birthDay: '', time: '', isRememberTime: false, gender: 'MALE' })
  assert.equal(friendDetailToEditForm({ gender: null }).gender, 'MALE')
  assert.equal(friendDetailToEditForm({ gender: 'FEMALE' }).gender, 'FEMALE')
})
const editForm: EditFriendForm = { name: 'N', surname: 'S', birthDay: '1988-12-31', time: '23:59', isRememberTime: true, gender: 'FEMALE' }
t('buildEditFriendArgs: positions match MemberWithFriendUpdateProfileApi(friend_id,dob,name,surname,time,gender,is_remember_time)', () => {
  assert.deepEqual(buildEditFriendArgs('friend-1', editForm), ['friend-1', '1988-12-31', 'N', 'S', '23:59', 'FEMALE', true])
})
t('buildEditFriendArgs: surname and name are NOT swapped (silent string corruption guard)', () => {
  const args = buildEditFriendArgs('f', editForm)
  assert.equal(args[2], 'N', 'index 2 must be name')
  assert.equal(args[3], 'S', 'index 3 must be surname')
})
t('mapUpdateFriendResult: clean 2xx → ok', () =>
  assert.deepEqual(mapUpdateFriendResult({ ok: true, status: 200, data: {} }), { ok: true }))
t('mapUpdateFriendResult: 2xx echoing {error} body → system (not a false ok)', () =>
  assert.deepEqual(mapUpdateFriendResult({ ok: true, status: 200, data: { error: 'boom' } }), { ok: false, reason: 'system', error: 'boom' }))
t('mapUpdateFriendResult: http error status → system', () =>
  assert.equal((mapUpdateFriendResult({ ok: false, kind: 'http', status: 500, data: {} }) as any).reason, 'system'))
t('mapUpdateFriendResult: no response → network (distinct reason, not one blob)', () =>
  assert.equal((mapUpdateFriendResult({ ok: false, kind: 'network', error: new Error('x') }) as any).reason, 'network'))

// --- #569: the two screens stop sharing one label, and the colleague screen gains three work roles ------
// Bug-class: (1) the love screen offering "เพื่อน", which is a choice it does not have; (2) a role list
// whose values read the relationship BACKWARDS — the engine takes `boss` to mean *they* are the boss
// (measured 2026-09-01: ourLabel "เรา (ลูกน้อง)"), so a list that pairs 'BOSS' with "ลูกน้อง" would send
// the mirror image and still return a plausible-looking score. That is the failure nothing else can catch.

t('#569 each kind carries its own picker wording — the love screen never says เพื่อน', () => {
  const love = resolveCompatibilityKind('love')!
  const colleague = resolveCompatibilityKind('colleague')!
  assert.equal(love.pickLabel, 'เลือกคู่รัก')
  assert.equal(colleague.pickLabel, 'เลือกเพื่อนร่วมงาน')
  assert.ok(!love.pickLabel.includes('เพื่อน'), 'จอคู่รักต้องไม่เสนอคำว่าเพื่อน')
  assert.notEqual(love.pickLabel, colleague.pickLabel, 'สองจอต้องไม่ใช้คำเดียวกันอีก')
})

t('#585 🔴 the role picker is gone — no screen advertises a role choice any more', () => {
  // the picker's whole premise was that ONE of three readings had to be chosen. The engine returns all
  // three per person in a single call, so the choice was throwing two away. `hasRoles` is deleted; this
  // reads the config back as a whole so a re-added field cannot slip in unnoticed.
  const love = resolveCompatibilityKind('love')!
  const colleague = resolveCompatibilityKind('colleague')!
  assert.ok(!('hasRoles' in love), 'จอคู่รักต้องไม่มีฟิลด์นี้กลับมา')
  assert.ok(!('hasRoles' in colleague), 'จอเพื่อนร่วมงานต้องไม่มีฟิลด์นี้กลับมา')
})

t('#585 the three WORK types survive the picker, because history rows still carry them', () => {
  // 🔴 deleting the picker must NOT delete the vocabulary. Rows written before #585 hold BOSS / EMPLOYEE /
  // FRIEND and the result screen still has to route them back to the colleague kind. Losing this list
  // would make those rows unreachable, which is a silent data loss, not a UI simplification.
  const values = [...WORK_MATCHING_TYPES].sort()
  assert.deepEqual(values, ['BOSS', 'EMPLOYEE', 'FRIEND'])
  assert.ok(!values.includes('LOVE' as never), 'ระดับความรักไม่ใช่บทบาทในที่ทำงาน')
  assert.equal(new Set(values).size, 3, 'ห้ามมีค่าซ้ำ')
  for (const v of WORK_MATCHING_TYPES) {
    assert.equal(compatibilityKindOfMatchingType(v), 'colleague', `แถวเก่าที่เป็น ${v} ต้องกลับมาที่จอเพื่อนร่วมงาน`)
  }
})

t('#585 the colleague screen still sends the value it shipped with, now as a fixed config', () => {
  // the single-pair lane still exists and still takes ONE matching_type. Removing the picker must not
  // change WHICH value that is, or every colleague row written from today reads as a different relationship.
  assert.equal(resolveCompatibilityKind('colleague')!.matchingType, 'FRIEND')
  assert.equal(resolveCompatibilityKind('love')!.matchingType, 'LOVE')
})

t('#569 CONTROL — the unknown-kind gate still refuses, roles did not widen it', () => {
  for (const bad of ['boss', 'employee', 'friend', 'constructor', '__proto__', '']) {
    assert.equal(resolveCompatibilityKind(bad), null, `${bad} ต้องไม่กลายเป็น route`)
  }
  assert.deepEqual([...COMPATIBILITY_KINDS], ['love', 'colleague'])
})

console.log(`\n${process.exitCode ? '❌ compatibility FAIL' : `✅ compatibility PASS (${pass})`}`)
