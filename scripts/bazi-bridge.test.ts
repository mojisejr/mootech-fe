// Deterministic unit tests for the bazi-bridge primitives (Phase 3.1 hard gate,
// #mootech-fullstack-supabase-fold). DB-free. Run: npx tsx scripts/bazi-bridge.test.ts
import assert from 'node:assert/strict'
import {
  toBaziInput,
  normalizeGender,
  DEFAULT_BIRTH_TIME,
  DEFAULT_PROVINCE,
} from '../lib/bazi-bridge/input'
import {
  toMootechElement,
  toMootechLevel,
  stemPolarity,
  hiddenZodiac,
} from '../lib/bazi-bridge/elements'

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

// ── B0 input adapter ──
t('gender MALE->male', () => assert.equal(normalizeGender('MALE'), 'male'))
t('gender FEMALE->female', () => assert.equal(normalizeGender('FEMALE'), 'female'))
t('gender mixed case female', () => assert.equal(normalizeGender('Female'), 'female'))
t('gender null->male (interim default)', () => assert.equal(normalizeGender(null), 'male'))

t('full input passthrough', () => {
  const r = toBaziInput({ name: 'A', dob: '1995-03-01', time: '08:30', gender: 'FEMALE', place_name: 'Chiang Mai' })
  assert.deepEqual(r, {
    rawInput: { birthDate: '1995-03-01', birthTime: '08:30', gender: 'female', province: 'Chiang Mai' },
    hasBirthTime: true,
    name: 'A',
  })
})
t('no birth time -> default 12:00 + hasBirthTime false', () => {
  const r = toBaziInput({ dob: '1995-03-01', time: '', gender: 'MALE', place_name: '' })
  assert.equal(r.rawInput.birthTime, DEFAULT_BIRTH_TIME)
  assert.equal(r.hasBirthTime, false)
  assert.equal(r.rawInput.province, DEFAULT_PROVINCE)
})
t('null time -> default + no time', () => {
  const r = toBaziInput({ dob: '2000-01-01', time: null, gender: null })
  assert.equal(r.hasBirthTime, false)
  assert.equal(r.rawInput.birthTime, DEFAULT_BIRTH_TIME)
  assert.equal(r.rawInput.gender, 'male')
  assert.equal(r.rawInput.province, DEFAULT_PROVINCE)
})
t('whitespace fields trimmed/defaulted', () => {
  const r = toBaziInput({ dob: ' 1990-12-31 ', time: '  ', gender: ' female ', place_name: '  ' })
  assert.equal(r.rawInput.birthDate, '1990-12-31')
  assert.equal(r.hasBirthTime, false)
  assert.equal(r.rawInput.gender, 'female')
  assert.equal(r.rawInput.province, DEFAULT_PROVINCE)
})

// ── element mapping (confirmed vs golden fixture: METAL/WOOD/EARTH/FIRE/WATER) ──
t('element wood->WOOD', () => assert.equal(toMootechElement('wood'), 'WOOD'))
t('element metal->METAL', () => assert.equal(toMootechElement('metal'), 'METAL'))
t('element case-insensitive', () => assert.equal(toMootechElement('Water'), 'WATER'))
t('element unknown throws', () => assert.throws(() => toMootechElement('plasma')))

// ── level mapping (confirmed: balanced->BALANCE) ──
t('level balanced->BALANCE', () => assert.equal(toMootechLevel('balanced'), 'BALANCE'))
t('level strong->STRONG', () => assert.equal(toMootechLevel('strong'), 'STRONG'))
t('level weak->WEAK', () => assert.equal(toMootechLevel('weak'), 'WEAK'))

// ── stem polarity (yang/yin) ──
t('stem 甲->YANG', () => assert.equal(stemPolarity('甲'), 'YANG'))
t('stem 乙->YIN', () => assert.equal(stemPolarity('乙'), 'YIN'))
t('stem romanized jia->YANG', () => assert.equal(stemPolarity('jia'), 'YANG'))
t('stem unknown throws', () => assert.throws(() => stemPolarity('Z')))

// ── hidden zodiac join (fixture "丁 己") ──
t('hiddenZodiac join space', () => assert.equal(hiddenZodiac(['丁', '己']), '丁 己'))
t('hiddenZodiac empty', () => assert.equal(hiddenZodiac(null), ''))

if (!process.exitCode) console.log(`✓ all ${pass} bazi-bridge assertions passed`)
else console.error(`\n${pass} passed, FAILURES above`)
