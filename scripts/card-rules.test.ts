// Teeth for features/v2-shop/card-rules.ts — mootech-fe#447.
//
// This module is the ONLY thing standing between "the buyer typed nonsense" and a charge attempt, and it
// has two callers who must never disagree (the form showing which field is wrong, and the Pay button
// deciding whether it may be pressed). So the cases below are written against BEHAVIOUR a buyer can
// reach, not against the shape of the functions.
//
// Plain node:assert, not vitest, on purpose: .githooks/pre-push §lane 2 globs scripts/*.test.ts and picks
// up new files automatically, while vitest.config.mjs carries a HAND-WRITTEN include list. A vitest spec
// added here and forgotten in that list is run by nothing at all (mootech-fe#367 counted 74 such files).
// Run: npx tsx scripts/card-rules.test.ts
//
// ANCHOR: scripts/card-rules.test.ts#card-rules
import assert from 'node:assert/strict'
import {
  cvcLengthFor,
  detectBrand,
  formatCardNumber,
  formatExpiry,
  isExpired,
  parseExpiry,
  passesLuhn,
  validateCard,
  type CardState,
} from '../features/v2-shop/card-rules'

const NOW = new Date('2026-08-28T00:00:00Z')
let failures = 0
function check(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failures += 1
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
  }
}

// Real published test numbers. Using invented digits would test the checksum against itself.
const VISA = '4242424242424242'
const VISA_13 = '4222222222222'
const MC = '5555555555554444'
const AMEX = '378282246310005'
const JCB = '3530111333300000'
const DISCOVER = '6011111111111117'
const UNIONPAY = '6250947000000014'

// ── luhn ─────────────────────────────────────────────────────────────────────────────────────────────
check('luhn accepts real numbers across brands', () => {
  for (const n of [VISA, VISA_13, MC, AMEX, JCB, DISCOVER, UNIONPAY]) {
    assert.equal(passesLuhn(n), true, `${n} should pass`)
  }
})

check('luhn rejects a single mistyped digit — the case it exists for', () => {
  // One digit changed. This is the overwhelmingly common real error, and the only one a checksum catches.
  assert.equal(passesLuhn('4242424242424243'), false)
  assert.equal(passesLuhn('5555555555554445'), false)
})

check('luhn is not fooled by separators', () => {
  assert.equal(passesLuhn('4242-4242 4242 4242'), true)
})

// ── brand ────────────────────────────────────────────────────────────────────────────────────────────
check('brand is detected from the leading digits, while still typing', () => {
  assert.equal(detectBrand('4'), 'visa')
  assert.equal(detectBrand('55'), 'mastercard')
  assert.equal(detectBrand('2221'), 'mastercard') // the 2-series range, not just 51-55
  assert.equal(detectBrand('34'), 'amex')
  assert.equal(detectBrand('3530'), 'jcb')
  assert.equal(detectBrand('36'), 'diners')
  assert.equal(detectBrand('6011'), 'discover')
  assert.equal(detectBrand('62'), 'unionpay')
  assert.equal(detectBrand('9'), 'unknown')
  assert.equal(detectBrand(''), 'unknown')
})

check('amex asks for 4 CVC digits, everyone else 3', () => {
  assert.equal(cvcLengthFor('amex'), 4)
  for (const b of ['visa', 'mastercard', 'jcb', 'unknown'] as const) assert.equal(cvcLengthFor(b), 3)
})

// ── formatting ───────────────────────────────────────────────────────────────────────────────────────
check('a pasted number with dashes survives — password managers must keep working', () => {
  assert.equal(formatCardNumber('4242-4242-4242-4242'), '4242 4242 4242 4242')
  assert.equal(formatCardNumber('  4242 4242 4242 4242  '), '4242 4242 4242 4242')
})

check('amex is grouped 4-6-5, not in fours', () => {
  assert.equal(formatCardNumber(AMEX), '3782 822463 10005')
})

check('formatting cannot exceed what the brand issues', () => {
  assert.equal(formatCardNumber('37828224631000512345'), '3782 822463 10005')
})

check('expiry gains its slash without the buyer typing one — mootech-fe#447 opens on this', () => {
  // "042026" is the exact string that made checkout.tsx:58 split into ['042026'] and send undefined as
  // the year, which the screen then blamed on the bank.
  assert.equal(formatExpiry('042026'), '04/2026')
  assert.equal(formatExpiry('04'), '04')
  assert.equal(formatExpiry('0'), '0')
  assert.equal(formatExpiry('04/2026'), '04/2026')
})

// ── expiry parsing ───────────────────────────────────────────────────────────────────────────────────
check('expiry is read in every shape a human types', () => {
  assert.deepEqual(parseExpiry('04/2026'), { month: 4, year: 2026 })
  assert.deepEqual(parseExpiry('4/2026'), { month: 4, year: 2026 })
  assert.deepEqual(parseExpiry('042026'), { month: 4, year: 2026 })
  assert.deepEqual(parseExpiry('04/26'), { month: 4, year: 2026 })
  assert.deepEqual(parseExpiry('0426'), { month: 4, year: 2026 })
})

check('five bare digits are REFUSED, not guessed', () => {
  // "42026" is 4/2026 or 42/026 and the string does not say which. Guessing puts a wrong month on a
  // real charge, so the honest answer is "unreadable".
  assert.equal(parseExpiry('42026'), null)
  assert.equal(parseExpiry(''), null)
  assert.equal(parseExpiry('abc'), null)
  assert.equal(parseExpiry('04/20/26'), null)
})

check('a card is good through the last day of its printed month', () => {
  assert.equal(isExpired({ month: 8, year: 2026 }, NOW), false) // this very month
  assert.equal(isExpired({ month: 7, year: 2026 }, NOW), true)
  assert.equal(isExpired({ month: 12, year: 2025 }, NOW), true)
  assert.equal(isExpired({ month: 1, year: 2027 }, NOW), false)
})

// ── the whole answer ─────────────────────────────────────────────────────────────────────────────────
const good: CardState = { name: 'David Watson', number: VISA, expiry: '04/2027', cvc: '123' }

check('a good card is ok and names no field', () => {
  const r = validateCard(good, NOW)
  assert.equal(r.ok, true)
  assert.deepEqual(r.fields, { name: null, number: null, expiry: null, cvc: null })
})

check('"a" in every field — the exact state that could press Pay before this ticket', () => {
  const r = validateCard({ name: 'a', number: 'a', expiry: 'a', cvc: 'a' }, NOW)
  assert.equal(r.ok, false)
  assert.equal(r.fields.name, null) // a name is a name
  assert.equal(r.fields.number, 'empty')
  assert.equal(r.fields.expiry, 'expiry_format')
  assert.equal(r.fields.cvc, 'empty')
})

check('each field fails on its own, and only it is named', () => {
  const cases: Array<[Partial<CardState>, keyof typeof good, string]> = [
    [{ name: '   ' }, 'name', 'empty'],
    [{ number: '4242424242424243' }, 'number', 'number_luhn'],
    [{ number: '42424242424242' }, 'number', 'number_length'],
    [{ number: '424242' }, 'number', 'number_too_short'],
    [{ expiry: '13/2027' }, 'expiry', 'expiry_month'],
    [{ expiry: '07/2026' }, 'expiry', 'expiry_past'],
    [{ cvc: '12' }, 'cvc', 'cvc_length'],
    [{ cvc: '12345' }, 'cvc', 'cvc_length'],
  ]
  for (const [patch, field, reason] of cases) {
    const r = validateCard({ ...good, ...patch }, NOW)
    assert.equal(r.ok, false, `${JSON.stringify(patch)} should not be ok`)
    assert.equal(r.fields[field], reason, `${JSON.stringify(patch)} → ${field}`)
    for (const other of ['name', 'number', 'expiry', 'cvc'] as const) {
      if (other !== field) assert.equal(r.fields[other], null, `${JSON.stringify(patch)} must not blame ${other}`)
    }
  }
})

check('amex needs 4 CVC digits — 3 is wrong ONLY because of the brand', () => {
  assert.equal(validateCard({ ...good, number: AMEX, cvc: '123' }, NOW).fields.cvc, 'cvc_length')
  assert.equal(validateCard({ ...good, number: AMEX, cvc: '1234' }, NOW).fields.cvc, null)
  // and the same 4 digits are wrong on a visa
  assert.equal(validateCard({ ...good, cvc: '1234' }, NOW).fields.cvc, 'cvc_length')
})

check('a pasted card with dashes validates — end to end, not just the formatter', () => {
  assert.equal(validateCard({ ...good, number: '4242-4242-4242-4242' }, NOW).ok, true)
})

check('🔴 ok:true while naming a broken field CANNOT be constructed', () => {
  // The contract this module exists to hold. Both halves come from one value, so the payload that has
  // burned this team all week — a shape that contradicts itself — has no way to exist here.
  const states: CardState[] = [
    good,
    { name: '', number: '', expiry: '', cvc: '' },
    { ...good, number: '4242424242424243' },
    { ...good, expiry: '42026' },
    { ...good, number: AMEX },
  ]
  for (const s of states) {
    const r = validateCard(s, NOW)
    const named = Object.values(r.fields).filter((x) => x !== null).length
    assert.equal(r.ok, named === 0, `ok=${r.ok} while ${named} field(s) are named`)
  }
})

if (failures > 0) {
  console.error(`\n${failures} case(s) failed.`)
  process.exit(1)
}
console.log('\ncard rules: all cases hold.')
