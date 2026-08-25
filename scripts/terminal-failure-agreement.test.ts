// #437 / review of #440 (ตู๋) — TWO DOORS, ONE ANSWER.
//
// A charge can be declared dead in two places: at creation (isRefusedCharge, lib/payment/charge-flow.ts)
// and when a webhook arrives (isTerminalFailure, pages/api/v2/payment/webhook.ts). Today both read the same
// TERMINAL_FAILURE_STATUSES set. Nothing structurally forces that — someone can inline a list at either
// call site and every other test stays green (ตู๋ proved this: mutant S2, 769 passed).
//
// 🔴 WHAT THIS FILE GUARDS IS AGREEMENT, NOT IMPLEMENTATION. Inlining is fine; DISAGREEING is not. If the
// two ever answer differently for the same charge, a card refused at creation could still be settled by a
// webhook (or the reverse) and the row ends up in whichever state won the race — on the money lane.
//
// MUTANT CONTRACT: add or remove a status from ONE of the two definitions → this file reddens.
import { describe, it, expect } from 'vitest'
import { isRefusedCharge, isTerminalFailure } from '@/lib/payment/gateway'

// Every status either side has ever been asked about, plus the shapes that must NOT read as refused.
const STATUSES = ['failed', 'expired', 'reversed', 'pending', 'successful', 'unknown_future_status', '']

describe('#437 the two doors must answer the same question the same way', () => {
  it('agrees on every status, for an unpaid charge', () => {
    for (const status of STATUSES) {
      const atCreation = isRefusedCharge({ status, paid: false })
      const atWebhook = isTerminalFailure({ key: 'charge.complete', chargeId: 'chrg_x', orderId: null, paid: false, status })
      expect(atCreation, `status "${status}" — creation says ${atCreation}, webhook says ${atWebhook}`).toBe(atWebhook)
    }
  })

  it('agrees that a PAID charge is never a refusal, whatever the status string says', () => {
    for (const status of STATUSES) {
      expect(isRefusedCharge({ status, paid: true })).toBe(false)
      expect(isTerminalFailure({ key: 'charge.complete', chargeId: 'chrg_x', orderId: null, paid: true, status })).toBe(false)
    }
  })

  // The half that matters most on a money lane: silence is "not finished", never "refused". A gateway that
  // did not answer must not cause us to kill a charge the user may still be paying.
  it('a charge with no status is NOT refused by either door', () => {
    expect(isRefusedCharge({})).toBe(false)
    expect(isRefusedCharge({ paid: false })).toBe(false)
  })
})
