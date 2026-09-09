// #484 slice 6 — teeth for the REFUND event, in the MAIN `npm test` lane.
//
// 🔴 WHY THIS FILE EXISTS AT ALL. Before it, `parseChargeEvent`, `isReversal`, `isSettleable` and
// `isTerminalFailure` had no main-lane test of any kind — the only coverage was in `*-db.test.ts` suites
// that are `describe.skipIf(!TEST_DATABASE_URL)` and do not run in the pre-push lane. That is lesson ②
// exactly, the one `payment-webhook-verify.ts` states in its own header: never leave a money gate testable
// only in the DB suite. A refund on production took nothing back on 2026-09-09 and nothing went red.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MR1  parseChargeEvent stops reading `data.charge`        → "the charge id lives on data.charge" reddens
//   MR2  parseChargeEvent stops reading `data.amount`        → "the refunded amount is read" reddens
//   MR3  isRefund stops requiring a refund key               → "a charge event is never a refund" reddens
//   MR4  isReversal is widened to catch refunds              → "the two events stay separate" reddens
//
// 🔴 THE PAYLOAD BELOW IS OBSERVED, NOT INVENTED. It is the refund object the account returned for
// rfnd_68ymhs6wskczqmp67us on 2026-09-09 at 21:21:53 — a real 35 baht refund of a real card charge. The
// previous defect in this lane shipped because a fixture was built from an assumption about a vendor's
// wire format; this one is built from the wire.
import { describe, it, expect } from 'vitest'
import { parseChargeEvent, isRefund, isReversal, isSettleable, isTerminalFailure } from '@/lib/payment/gateway'

const CHARGE = 'chrg_68ylhf590g119lfivdi'
const REFUND = 'rfnd_68ymhs6wskczqmp67us'

const body = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8')

/** The shape Omise actually sent: `data` is the REFUND object, and the charge id is a field inside it. */
const refundEvent = (over: Record<string, unknown> = {}) =>
  body({
    key: 'refund.create',
    data: {
      object: 'refund',
      id: REFUND,
      charge: CHARGE,
      amount: 3500,
      currency: 'THB',
      status: 'closed',
      voided: true,
      ...over,
    },
  })

describe('#484 slice 6 — a refund event carries the charge id somewhere else entirely', () => {
  it('MR1 — the charge id lives on data.charge, NOT on data.id', () => {
    const evt = parseChargeEvent(refundEvent())
    expect(evt.refundOfChargeId).toBe(CHARGE)
    // 🔴 The trap, asserted so it cannot quietly change: `chargeId` on a refund event is the REFUND's id.
    // Every predicate that reads it is asking about the wrong object.
    expect(evt.chargeId).toBe(REFUND)
  })

  it('MR2 — the refunded amount is read, because a full refund is what revokes', () => {
    expect(parseChargeEvent(refundEvent()).refundSatang).toBe(3500)
    expect(parseChargeEvent(refundEvent({ amount: 1000 })).refundSatang).toBe(1000)
  })

  it('MR3 — a refund event is recognised as one', () => {
    expect(isRefund(parseChargeEvent(refundEvent()))).toBe(true)
  })

  it('🔴 THE DEFECT — isReversal is FALSE for a refund, which is why nothing was revoked', () => {
    const evt = parseChargeEvent(refundEvent())
    // The refund's own lifecycle word, never the charge's status. This is the whole bug in one assertion.
    expect(evt.status).toBe('closed')
    expect(isReversal(evt)).toBe(false)
    // And no other branch picks it up either — it fell through the entire handler.
    expect(isSettleable(evt)).toBe(false)
    expect(isTerminalFailure(evt)).toBe(false)
  })

  it('MR4 — the two events stay separate: charge.reverse is still a reversal and not a refund', () => {
    // What #484 actually implemented, and what this change deliberately leaves alone.
    const reversal = parseChargeEvent(body({ key: 'charge.reverse', data: { id: CHARGE, status: 'reversed', paid: true } }))
    expect(isReversal(reversal)).toBe(true)
    expect(isRefund(reversal)).toBe(false)
    expect(reversal.refundOfChargeId).toBeNull()
  })

  it('a settleable charge is untouched by any of this', () => {
    const complete = parseChargeEvent(body({ key: 'charge.complete', data: { id: CHARGE, status: 'successful', paid: true } }))
    expect(isSettleable(complete)).toBe(true)
    expect(isRefund(complete)).toBe(false)
    expect(complete.refundSatang).toBeNull()
  })

  it('a charge event is never a refund, whatever else it carries', () => {
    for (const status of ['successful', 'failed', 'expired', 'pending', 'reversed']) {
      const evt = parseChargeEvent(body({ key: 'charge.complete', data: { id: CHARGE, status, paid: false } }))
      expect(isRefund(evt)).toBe(false)
    }
  })

  it('fails CLOSED on a refund event missing the charge id or the amount', () => {
    expect(isRefund(parseChargeEvent(refundEvent({ charge: undefined })))).toBe(false)
    expect(isRefund(parseChargeEvent(refundEvent({ charge: '' })))).toBe(false)
    expect(isRefund(parseChargeEvent(refundEvent({ amount: undefined })))).toBe(false)
    expect(isRefund(parseChargeEvent(refundEvent({ amount: 'lots' })))).toBe(false)
    // A refund of zero is well-formed and harmless: it can never reach the charge's amount, so the caller's
    // full-refund gate refuses it. Recognising it is what lets it be LOGGED rather than fall through silently.
    expect(isRefund(parseChargeEvent(refundEvent({ amount: 0 })))).toBe(true)
    expect(parseChargeEvent(refundEvent({ amount: 0 })).refundSatang).toBe(0)
  })

  it('a sibling refund key is still routed — the revoke is idempotent, so tolerating one costs nothing', () => {
    expect(isRefund(parseChargeEvent(refundEvent({}) ))).toBe(true)
    const updated = body({ key: 'refund.update', data: { id: REFUND, charge: CHARGE, amount: 3500, status: 'closed' } })
    expect(isRefund(parseChargeEvent(updated))).toBe(true)
  })
})
