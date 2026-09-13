// Beam lane slice 2 — Beam webhook bodies → the ChargeEvent vocabulary gateway.ts's predicates judge.
// Payload shapes are the ones Beam documents (bare resource, event name in X-Beam-Event). The contract
// tested is not "the parser copies fields" but "webhook-dispatch would do the RIGHT THING with the
// result", so each case is checked through the very predicates the dispatcher calls.
//
// 🔴 MUTANT CONTRACT (each reddens this spec):
//   MR1  charge.succeeded trusts the event name instead of body.status → 'header says succeeded, body says FAILED' fails
//   MR2  refund.failed carries refundSatang                            → 'refund.failed never revokes' fails
//   MR3  refund.succeeded reads chargeId into refundOfChargeId wrongly  → 'refund.succeeded' fails
//   MR4  referenceId not read into orderId                             → the #371 recovery case fails
import { describe, it, expect } from 'vitest'
import { parseBeamEvent } from '../lib/payment/beam-gateway'
import { isSettleable, isTerminalFailure, isRefund, isReversal } from '../lib/payment/gateway'

const hdr = (event?: string) => (name: string) => (name === 'x-beam-event' ? (event ?? null) : null)
const raw = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8')

const CHARGE = {
  chargeId: 'ch_30GtUweMWec7r2hHIsV5xxQeJKp',
  merchantId: 'm_x',
  referenceId: '1234567890',
  status: 'SUCCEEDED',
  currency: 'THB',
  amount: 50000,
  source: 'API',
  paymentMethod: { paymentMethodType: 'QR_PROMPT_PAY', qrPromptPay: {} },
  failureCode: '',
  transactionTime: '2026-09-13T10:16:12Z',
}

describe('charge.* events', () => {
  it('charge.succeeded with body SUCCEEDED ⇒ isSettleable, with our orderId (#371 recovery path intact)', () => {
    const evt = parseBeamEvent(raw(CHARGE), hdr('charge.succeeded'))
    expect(evt).toMatchObject({ key: 'charge.complete', chargeId: CHARGE.chargeId, orderId: '1234567890', paid: true, status: 'successful' })
    expect(isSettleable(evt)).toBe(true)
    expect(isTerminalFailure(evt)).toBe(false)
    expect(isRefund(evt)).toBe(false)
    expect(isReversal(evt)).toBe(false)
  })

  it('🔴 header says succeeded but the BODY says FAILED ⇒ NOT settleable (the body is the truth)', () => {
    const evt = parseBeamEvent(raw({ ...CHARGE, status: 'FAILED', failureCode: 'CH_CARD_DECLINED' }), hdr('charge.succeeded'))
    expect(isSettleable(evt)).toBe(false)
    expect(evt.paid).toBe(false)
  })

  it('charge.failed ⇒ isTerminalFailure (discount hold released), never settleable', () => {
    const evt = parseBeamEvent(raw({ ...CHARGE, status: 'FAILED', failureCode: 'CH_INSUFFICIENT_FUNDS' }), hdr('charge.failed'))
    expect(evt).toMatchObject({ key: 'charge.failed', chargeId: CHARGE.chargeId, paid: false, status: 'failed' })
    expect(isTerminalFailure(evt)).toBe(true)
    expect(isSettleable(evt)).toBe(false)
  })

  it('a charge.succeeded arriving for a body still PENDING (out-of-order replay) settles nothing', () => {
    const evt = parseBeamEvent(raw({ ...CHARGE, status: 'PENDING' }), hdr('charge.succeeded'))
    expect(isSettleable(evt)).toBe(false)
    expect(isTerminalFailure(evt)).toBe(false) // pending is "not finished", never a failure
  })

  it('an empty referenceId is null, not "" (the recovery path must not match on an empty string)', () => {
    const evt = parseBeamEvent(raw({ ...CHARGE, referenceId: '' }), hdr('charge.succeeded'))
    expect(evt.orderId).toBeNull()
  })
})

const REFUND = {
  refundId: 're_34duZsgqHJzkZZhMOl9wVcYzjRx',
  chargeId: 'ch_34duZsgqHJzkZZhMOl9wVcYzjRx',
  merchantId: 'm_x',
  referenceId: '1234567890',
  amount: 50000,
  currency: 'THB',
  status: 'SUCCEEDED',
  failureCode: '',
  refundReason: 'Customer requested refund',
}

describe('refund.* events', () => {
  it('refund.succeeded ⇒ isRefund with the CHARGE id in refundOfChargeId and the satang refunded', () => {
    const evt = parseBeamEvent(raw(REFUND), hdr('refund.succeeded'))
    expect(evt).toMatchObject({ key: 'refund.succeeded', chargeId: REFUND.refundId, refundOfChargeId: REFUND.chargeId, refundSatang: 50000, orderId: '1234567890' })
    expect(isRefund(evt)).toBe(true)
    expect(isSettleable(evt)).toBe(false)
    expect(isReversal(evt)).toBe(false) // Beam never says 'reversed'; the refund path is the only revoke door
  })

  it('a PARTIAL refund still parses (webhook-dispatch decides it revokes nothing — that rule lives in repo.ts)', () => {
    const evt = parseBeamEvent(raw({ ...REFUND, amount: 100 }), hdr('refund.succeeded'))
    expect(isRefund(evt)).toBe(true)
    expect(evt.refundSatang).toBe(100)
  })

  it('🔴 refund.failed NEVER revokes: refundSatang is null so isRefund is false by construction', () => {
    const evt = parseBeamEvent(raw({ ...REFUND, status: 'FAILED', failureCode: 'RE_PROCESSING_FAILED' }), hdr('refund.failed'))
    expect(evt.refundSatang).toBeNull()
    expect(isRefund(evt)).toBe(false)
    expect(isSettleable(evt)).toBe(false)
    expect(isTerminalFailure(evt)).toBe(false)
  })

  it('🔴 refund.succeeded whose body says FAILED (defensive) also revokes nothing', () => {
    const evt = parseBeamEvent(raw({ ...REFUND, status: 'FAILED' }), hdr('refund.succeeded'))
    expect(isRefund(evt)).toBe(false)
  })
})

describe('everything else', () => {
  it('transaction.created / payment_link.paid / unknown ⇒ no chargeId ⇒ matches no branch (logged, 200)', () => {
    for (const ev of ['transaction.created', 'payment_link.paid', 'bolt_intent.paid', 'something.new']) {
      const evt = parseBeamEvent(raw({ referenceId: 'x', status: 'PAID' }), hdr(ev))
      expect(evt.key).toBe(ev)
      expect(evt.chargeId).toBeNull()
      expect(isSettleable(evt) || isTerminalFailure(evt) || isRefund(evt) || isReversal(evt)).toBe(false)
    }
  })

  it('a missing X-Beam-Event header is named in the key so the "no branch matched" log says why', () => {
    const evt = parseBeamEvent(raw(CHARGE), hdr(undefined))
    expect(evt.key).toMatch(/no x-beam-event/)
    expect(isSettleable(evt)).toBe(false)
  })

  it('non-JSON throws (the route turns that into 400)', () => {
    expect(() => parseBeamEvent(Buffer.from('not json'), hdr('charge.succeeded'))).toThrow()
  })
})
