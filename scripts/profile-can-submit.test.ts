// Phase B (#233): the register submit gate must REQUIRE gender. Run: npx tsx scripts/profile-can-submit.test.ts
// A null gender silently becomes "male" downstream and breaks the element_cycle join — 12.4% of real
// users had none. gender starts null (no default), so this gate is what forces an active choice.
import assert from 'node:assert/strict'
import { profileCanSubmit } from '../features/auth/hooks/profile-can-submit'

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

const ok = { userId: 'u1', name: 'A', birthDay: '1990-06-15', gender: 'MALE' as const, isTimeValid: true }

// MUTANT: drop `&& input.gender` from the gate and THIS flips to true → the silent-MALE bug is back.
t('no gender chosen ⇒ cannot submit', () => {
  assert.equal(profileCanSubmit({ ...ok, gender: null }), false)
})
t('gender chosen + all fields ⇒ can submit', () => {
  assert.equal(profileCanSubmit(ok), true)
  assert.equal(profileCanSubmit({ ...ok, gender: 'FEMALE' }), true)
})
t('missing name / birthDay / userId ⇒ cannot submit (unchanged)', () => {
  assert.equal(profileCanSubmit({ ...ok, name: '  ' }), false)
  assert.equal(profileCanSubmit({ ...ok, birthDay: '' }), false)
  assert.equal(profileCanSubmit({ ...ok, userId: '' }), false)
})
t('invalid time ⇒ cannot submit even with gender (unchanged)', () => {
  assert.equal(profileCanSubmit({ ...ok, isTimeValid: false }), false)
})

console.log(`\n✅ profile-can-submit — ${pass} passed`)
