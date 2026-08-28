// Teeth for mootech-fe#492 — the Pay button, and who gets blamed when tokenisation fails.
//
// Two claims, and they fail in opposite directions:
//   1. an invalid card cannot be submitted           (before this, "a" in every field could press Pay)
//   2. a failure we caused is never dressed as the buyer's fault
//
// Claim 2 is the one with a victim. A buyer told "your bank declined" for OUR broken key goes and finds
// another card, and it fails again, for a problem they cannot see or fix.
//
// Plain node:assert so .githooks/pre-push §lane 2 picks it up automatically — vitest.config's include
// list is hand-written and a spec forgotten in it is run by nothing (mootech-fe#367).
// Run: npx tsx scripts/pay-gate.test.ts
//
// ANCHOR: scripts/pay-gate.test.ts#pay-gate
import assert from 'node:assert/strict'
import { type CardState } from '../features/v2-shop/card-rules'
import { payReady } from '../features/v2-shop/pay-ready'
import { tokenizationFailedDestination } from '../features/v2-shop/pay-destination'
import { RESULT_COPY } from '../features/v2-shop/result-state'

const NOW = new Date('2026-08-28T00:00:00Z')
let failures = 0
const check = (name: string, fn: () => void): void => {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failures += 1
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
  }
}

// 🔴 IMPORTED, NOT RE-IMPLEMENTED (ตู๋, review r1 B2). The first version of this file wrote the rule out
// again, so deleting the real condition from pages/v2/shop/checkout.tsx left every lane green — a test
// that rebuilds what it guards proves only that the tester can write it twice.
const ready = (card: CardState, method: 'card' | 'promptpay', hasQuote = true, loading = false): boolean =>
  payReady({ hasQuote, loading, method, card, now: NOW })

const GOOD: CardState = { name: 'David Watson', number: '4242424242424242', expiry: '04/2027', cvc: '123' }
const EMPTY: CardState = { name: '', number: '', expiry: '', cvc: '' }

// ── the gate ─────────────────────────────────────────────────────────────────────────────────────────
check('a good card can be submitted', () => {
  assert.equal(ready(GOOD, 'card'), true)
})

check('"a" in every field CANNOT — the exact state that could press Pay before #492', () => {
  assert.equal(ready({ name: 'a', number: 'a', expiry: 'a', cvc: 'a' }, 'card'), false)
})

check('each single defect blocks the button on its own', () => {
  const bad: Array<[string, Partial<CardState>]> = [
    ['luhn', { number: '4242424242424243' }],
    ['expired', { expiry: '07/2026' }],
    ['bad month', { expiry: '13/2027' }],
    ['short cvc', { cvc: '12' }],
    ['no name', { name: '  ' }],
    ['empty', EMPTY as Partial<CardState>],
  ]
  for (const [why, patch] of bad) {
    assert.equal(ready({ ...GOOD, ...patch }, 'card'), false, `${why} should block Pay`)
  }
})

check('PromptPay is untouched — no card needed, and an empty one does not block it', () => {
  assert.equal(ready(EMPTY, 'promptpay'), true)
  assert.equal(ready({ name: 'a', number: 'a', expiry: 'a', cvc: 'a' }, 'promptpay'), true)
})

check('the quote still gates, on both lanes', () => {
  assert.equal(ready(GOOD, 'card', false), false)
  assert.equal(ready(EMPTY, 'promptpay', false), false)
  assert.equal(ready(GOOD, 'card', true, true), false)
})

// ── whose fault ──────────────────────────────────────────────────────────────────────────────────────
const stateOf = (href: string): string => new URL(href, 'https://x').searchParams.get('state') ?? ''

check('🔴 the three buyer-fixable codes go to CARD_UNREADABLE — NEVER to CARD_DECLINED', () => {
  // The correction from review r1 B1. These are TOKENISATION failures: no charge was created, so no bank
  // saw this card. CARD_DECLINED says "ธนาคารปฏิเสธการชำระเงิน", which is the sentence this ticket exists
  // to stop — and the first version of this file asserted the wrong direction on this very line.
  for (const code of ['invalid_card', 'expired_card', 'invalid_security_code']) {
    assert.equal(stateOf(tokenizationFailedDestination('PKG', code).href), 'CARD_UNREADABLE', code)
  }
})

check('🔴 NO tokenisation failure can reach CARD_DECLINED, whatever the code', () => {
  const codes = [null, '', 'invalid_card', 'expired_card', 'invalid_security_code',
    'authentication_failure', 'service_not_found', 'anything_new']
  for (const code of codes) {
    assert.notEqual(stateOf(tokenizationFailedDestination('PKG', code).href), 'CARD_DECLINED', String(code))
  }
})

check('🔴 both failure screens lead somewhere that DOES something (review r1 B3)', () => {
  // 'same' renders "ตรวจสอบอีกครั้ง", which calls the status check — and neither of these URLs carries a
  // charge or an order, so the check returns immediately and the button does nothing at all. Nothing was
  // created here; there is nothing to check. The way forward is back to the checkout that failed.
  for (const st of ['CARD_UNREADABLE', 'PAYMENT_SETUP_BROKEN'] as const) {
    assert.notEqual(RESULT_COPY[st].retry, 'same', `${st}: a check button with nothing to check`)
    assert.notEqual(RESULT_COPY[st].retry, 'none', `${st}: a dead end with no way forward`)
  }
})

check('🔴 OUR breakage never blames the buyer', () => {
  for (const code of ['authentication_failure', 'service_not_found']) {
    assert.equal(stateOf(tokenizationFailedDestination('PKG', code).href), 'PAYMENT_SETUP_BROKEN', code)
  }
})

check('🔴 no code at all — omise.js missing — is OURS, not theirs', () => {
  assert.equal(stateOf(tokenizationFailedDestination('PKG', null).href), 'PAYMENT_SETUP_BROKEN')
  assert.equal(stateOf(tokenizationFailedDestination('PKG').href), 'PAYMENT_SETUP_BROKEN')
})

check('🔴 a code we have never seen is OURS — the allow-list direction is the whole point', () => {
  // Omise may add reasons after this file is written. An unknown reason means we do not know whose fault
  // it is, and "we do not know" must never render as "you got it wrong".
  for (const code of ['some_future_reason', 'rate_limited', '']) {
    assert.equal(stateOf(tokenizationFailedDestination('PKG', code).href), 'PAYMENT_SETUP_BROKEN', code)
  }
})

check('the package code still rides along, so the result screen can offer the way back', () => {
  const href = tokenizationFailedDestination('PRO_YEARLY', 'invalid_card').href
  assert.ok(href.includes('package_code=PRO_YEARLY'), href)
})

// ── the words ────────────────────────────────────────────────────────────────────────────────────────
check('🔴 neither tokenisation screen mentions the bank, and both say no money moved', () => {
  for (const st of ['CARD_UNREADABLE', 'PAYMENT_SETUP_BROKEN'] as const) {
    const c = RESULT_COPY[st]
    assert.equal(c.paid, false, st)
    assert.ok(!c.title.includes('ธนาคาร'), `${st} title blames the bank: ${c.title}`)
    assert.ok(!c.body.includes('ธนาคาร'), `${st} body blames the bank: ${c.body}`)
    assert.ok(c.body.includes('ยังไม่มีการตัดเงิน'), `${st} must say no money moved: ${c.body}`)
  }
})

check('CARD_DECLINED still speaks for a real decline, and still says no money moved', () => {
  const c = RESULT_COPY.CARD_DECLINED
  assert.equal(c.paid, false)
  assert.ok(c.title.includes('ธนาคาร'), c.title)
})

if (failures > 0) {
  console.error(`\n${failures} case(s) failed.`)
  process.exit(1)
}
console.log('\npay gate: all cases hold.')
