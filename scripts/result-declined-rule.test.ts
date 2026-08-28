// #438 — teeth for the rule that decides WHAT the result screen says. MAIN lane.
//
// This rule used to be a nested ternary inside pages/v2/shop/result.tsx. Testing it meant rendering a page
// and driving a router, so it was never tested — and the branch that was missing (the server said REJECT)
// stayed missing. A user whose bank refused their card saw "กำลังดำเนินการ" until they closed the tab.
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MD1  drop the REJECTED arm from resolveResultState              → "a refused card is named" reddens
//   MD2  apply the REJECTED arm to every method, not just card      → "PromptPay keeps its own words" reddens
//   MD3  let tryAnotherHref return a bare /v2/shop/checkout          → "never a dead end" reddens
//   MD4  move the REJECTED arm below the phase branch               → "a refusal outlives the clock" reddens
import { describe, it, expect } from 'vitest'
import { resolveResultState, tryAnotherHref, RESULT_COPY } from '@/features/v2-shop/result-state'
import { statusOf, isSettledStatus } from '@/features/v2-shop/useChargeStatus'

const base = { claimed: 'PAYING' as const, phase: 'waiting' as const }

describe('#438 the screen can finally say a card was refused', () => {
  it('🔴 MD1 — a refused CARD is named, not left "in progress"', () => {
    const s = resolveResultState({ ...base, status: 'REJECTED', method: 'card' })
    expect(s).toBe('CARD_DECLINED')
    expect(RESULT_COPY[s].title).toBe('ธนาคารปฏิเสธการชำระเงิน')
    // the user is offered a way forward, not a dead screen
    expect(RESULT_COPY[s].retry).toBe('different')
    expect(RESULT_COPY[s].paid).toBe(false)
  })

  it('🔴 MD4 — a refusal outlives the clock: every phase gives the same answer', () => {
    for (const phase of ['waiting', 'reconciling', 'exhausted'] as const) {
      expect(resolveResultState({ ...base, phase, status: 'REJECTED', method: 'card' })).toBe('CARD_DECLINED')
    }
  })

  // 🔴 MD4, THE CASE THAT ACTUALLY PINS THE ORDER. The loop above passes even with the REJECTED arm moved
  // to the bottom, because claimed='PAYING' has paid:false and so never enters the phase branch — i.e. it
  // named the order but did not guard it. The order only bites when the CLAIM asserts payment, which a URL
  // can do on its own ("a URL is a thing anyone can type" — the reason this whole file exists).
  //
  // Refused card + a claim of APPROVED, order reversed ⇒ the phase branch wins ⇒ the screen tells someone
  // whose card was declined "กำลังตรวจสอบกับธนาคาร ไม่ต้องจ่ายซ้ำ". That is the worst sentence available.
  it('🔴 MD4 — a refused card beats a CLAIM of success, whatever the clock says', () => {
    for (const phase of ['waiting', 'reconciling', 'exhausted'] as const) {
      const s = resolveResultState({ claimed: 'APPROVED', phase, status: 'REJECTED', method: 'card' })
      expect(s, `phase=${phase}`).toBe('CARD_DECLINED')
      expect(RESULT_COPY[s].paid, 'a refused charge must never render as paid').toBe(false)
    }
  })

  it('🔴 MD2 — PromptPay keeps its OWN words: card copy must not be borrowed (mootech-fe#443)', () => {
    // "ลองใช้บัตรใบอื่น" said to someone who scanned a QR is wrong twice over.
    expect(resolveResultState({ ...base, status: 'REJECTED', method: 'promptpay' })).not.toBe('CARD_DECLINED')
    // and a row we have not seen a method for yet is not a refusal we can describe either
    expect(resolveResultState({ ...base, status: 'REJECTED', method: null })).not.toBe('CARD_DECLINED')
  })

  it('an APPROVED charge still wins over everything, and a claim alone never does', () => {
    expect(resolveResultState({ ...base, status: 'APPROVED', method: 'card' })).toBe('APPROVED')
    // the URL claims success; the server has not agreed ⇒ NOT approved
    expect(resolveResultState({ claimed: 'APPROVED', phase: 'waiting', status: 'PENDING', method: 'card' })).toBe('PAYING')
  })

  it('PromptPay waiting behaviour is untouched — the three phases still map as #423 set them', () => {
    const pp = { claimed: 'APPROVED' as const, status: 'PENDING' as const, method: 'promptpay' }
    expect(resolveResultState({ ...pp, phase: 'waiting' })).toBe('PAYING')
    expect(resolveResultState({ ...pp, phase: 'reconciling' })).toBe('RECONCILING')
    expect(resolveResultState({ ...pp, phase: 'exhausted' })).toBe('QR_MAYBE_EXPIRED')
  })
})

describe('#438 "เลือกวิธีชำระเงินอื่น" must never be a second dead end', () => {
  it('🔴 MD3 — with a package, it returns to THAT package s checkout', () => {
    expect(tryAnotherHref('PLUS_MONTHLY')).toBe('/v2/shop/checkout?package_code=PLUS_MONTHLY')
  })

  it('🔴 MD3 — with no package it goes to the package list, NEVER a bare checkout', () => {
    // a bare /v2/shop/checkout resolves package_code to '' and /api/v2/payment/preview answers 400
    expect(tryAnotherHref('')).toBe('/v2/shop')
    expect(tryAnotherHref('')).not.toContain('/checkout')
  })

  it('a package code with URL-unsafe characters is encoded, not pasted raw', () => {
    expect(tryAnotherHref('A B&C')).toBe('/v2/shop/checkout?package_code=A%20B%26C')
  })
})

describe('#438 the DB status vocabulary reaches the screen intact', () => {
  it('REJECT becomes REJECTED — the value the schema actually stores', () => {
    expect(statusOf({ chargeId: 'c', status: 'REJECT' })).toBe('REJECTED')
  })

  it('🔴 the original guarantee survives: an UNKNOWN status is still a wait, never a verdict', () => {
    // same list scripts/charge-status.test.ts:48-54 pinned before #438 — none of these may become REJECTED
    for (const s of ['FAILED', 'EXPIRED', 'REVERSED', 'approved', 'reject', '']) {
      expect(statusOf({ chargeId: 'c', status: s }), `"${s}"`).toBe('PENDING')
    }
  })

  it('polling stops on either final answer, and only on those', () => {
    expect(isSettledStatus('APPROVED')).toBe(true)
    expect(isSettledStatus('REJECTED')).toBe(true)
    expect(isSettledStatus('PENDING')).toBe(false)
    expect(isSettledStatus('UNKNOWN')).toBe(false)
  })
})
