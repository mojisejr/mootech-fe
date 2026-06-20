// Deterministic unit tests for mapping a stored user row -> bazi input (#mootech-bazi-chat-lane).
// DB-free. Run: npx tsx scripts/birth-from-user.test.ts  or: bun scripts/birth-from-user.test.ts
import assert from 'node:assert/strict'
import {
  userRowToFeCalcInput,
  isBirthProfileComplete,
  toBaziInput,
  DEFAULT_BIRTH_TIME,
  DEFAULT_PROVINCE,
} from '../lib/bazi-bridge/input'

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

// ── isBirthProfileComplete ──
t('complete when dob + gender present', () => {
  assert.equal(isBirthProfileComplete({ dob: '1989-01-03', gender: 'MALE' }), true)
})
t('incomplete when dob missing', () => {
  assert.equal(isBirthProfileComplete({ dob: '', gender: 'MALE' }), false)
  assert.equal(isBirthProfileComplete({ dob: null, gender: 'MALE' }), false)
})
t('incomplete when gender missing', () => {
  assert.equal(isBirthProfileComplete({ dob: '1989-01-03', gender: null }), false)
})

// ── userRowToFeCalcInput honors is_remember_time ──
t('trusts time only when is_remember_time === true', () => {
  const fe = userRowToFeCalcInput({
    dob: '1989-01-03',
    time: '08:45',
    gender: 'MALE',
    place_name: 'จันทบุรี',
    is_remember_time: true,
  })
  assert.equal(fe.time, '08:45')
  assert.equal(fe.place_name, 'จันทบุรี')
})
t('blanks time when is_remember_time false (even if a time is stored)', () => {
  const fe = userRowToFeCalcInput({
    dob: '1989-01-03',
    time: '08:45',
    gender: 'MALE',
    is_remember_time: false,
  })
  assert.equal(fe.time, '')
})
t('blanks time when is_remember_time missing/null', () => {
  assert.equal(userRowToFeCalcInput({ dob: '1989-01-03', time: '08:45', gender: 'M' }).time, '')
})

// ── end-to-end: row -> rawInput via toBaziInput ──
t('row with remembered time -> hour pillar present', () => {
  const { rawInput, hasBirthTime } = toBaziInput(
    userRowToFeCalcInput({
      dob: '1989-01-03',
      time: '08:45',
      gender: 'FEMALE',
      place_name: 'เชียงใหม่',
      is_remember_time: true,
    }),
  )
  assert.equal(rawInput.birthTime, '08:45')
  assert.equal(rawInput.gender, 'female')
  assert.equal(rawInput.province, 'เชียงใหม่')
  assert.equal(hasBirthTime, true)
})
t('row without remembered time -> 12:00 + hour pillar suppressed + province default', () => {
  const { rawInput, hasBirthTime } = toBaziInput(
    userRowToFeCalcInput({ dob: '1989-01-03', gender: 'MALE', is_remember_time: false }),
  )
  assert.equal(rawInput.birthTime, DEFAULT_BIRTH_TIME)
  assert.equal(rawInput.province, DEFAULT_PROVINCE)
  assert.equal(hasBirthTime, false)
})

if (!process.exitCode) console.log(`✓ all ${pass} birth-from-user assertions passed`)
else console.error(`\n${pass} passed, FAILURES above`)
