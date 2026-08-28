// #466 round 2 — teeth for WHERE a checkout attempt goes, and in WHAT ORDER it is decided. MAIN lane.
//
// 🔴 THIS FILE EXISTS BECAUSE THE ROUND-1 TEETH POINTED AT THE WRONG PLACE (ตู๋, review of 983d3b0).
// Round 1 tested refusedHref — the function — while the bug lived at the CALL SITE, in the order of two
// `if`s inside pages/v2/shop/checkout.tsx. ตู๋ ran the ticket's own DoD mutant against the real tree:
//
//   MC1  delete the two `if (refused…)` lines        → 883 passed, rc=0   ← green, bug restored
//   MC2  move `if (!r.ok …)` above the refusal check → 883 passed, rc=0   ← green, bug restored
//
// Both mutants now live INSIDE payDestination, so both are covered here — see MP-ORDER and MP-DROP.
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MP-DROP    remove the refusal branch entirely            → the card + promptpay refusal tests redden
//   MP-ORDER   ask `!ok` BEFORE the refusal (ตู๋'s MC2)       → the same tests redden, with the exact
//                                                               "ธนาคารปฏิเสธ" regression they describe
//   MP-LANE    give the PromptPay lane CARD_DECLINED words   → the lane-separation test reddens
//   MP-3DS     router.push the bank's URL instead of leaving → the external-destination test reddens
//   MP-PAYING  re-enable the button while leaving the app    → the keepPaying test reddens
import { describe, it, expect } from 'vitest'
import { payDestination } from '@/features/v2-shop/pay-destination'

const base = { packageCode: 'V2_PLUS_YEARLY', amountSatang: 79000 }
const state = (href: string) => new URLSearchParams(href.split('?')[1] ?? '').get('state')

describe('#466 the refusal is decided FIRST — the order is the rule', () => {
  // 🔴 A REFUSAL IS ALSO `!ok`. That is the whole trap: any fallback asked first swallows it, and the
  // fallback on the card lane names the BANK — about a card the bank never saw, because the purchase is
  // refused at lib/payment/charge-flow.ts before Omise is called at all.
  it('MP-DROP / MP-ORDER — card lane: 409 ALREADY_ON_THIS_TIER goes to the refusal screen, never CARD_DECLINED', () => {
    const d = payDestination({
      ...base, lane: 'card', status: 409, ok: false,
      body: { purchaseError: 'ALREADY_ON_THIS_TIER' },
      targetPlanName: 'Mumate +',
    })
    expect(state(d.href)).toBe('ALREADY_ON_THIS_TIER')
    expect(d.href).not.toContain('CARD_DECLINED')
    expect(d.kind).toBe('route')
    expect(d.keepPaying).toBe(false)
  })

  it('MP-DROP / MP-ORDER — promptpay lane: the same 409 never lands on OFFLINE', () => {
    const d = payDestination({
      ...base, lane: 'promptpay', status: 409, ok: false,
      body: { purchaseError: 'CANNOT_DOWNGRADE' },
      heldPlanName: 'Mumate Pro',
    })
    expect(state(d.href)).toBe('CANNOT_DOWNGRADE')
    expect(d.href).not.toContain('OFFLINE')
  })

  it('the plan each refusal names comes from the RIGHT side of the comparison', () => {
    // ALREADY_ON_THIS_TIER → the one they tried to buy. CANNOT_DOWNGRADE → the higher one they hold.
    const same = payDestination({
      ...base, lane: 'card', status: 409, ok: false,
      body: { purchaseError: 'ALREADY_ON_THIS_TIER' },
      targetPlanName: 'Mumate +', heldPlanName: 'Mumate Pro',
    })
    expect(new URLSearchParams(same.href.split('?')[1]).get('plan')).toBe('Mumate +')

    const down = payDestination({
      ...base, lane: 'card', status: 409, ok: false,
      body: { purchaseError: 'CANNOT_DOWNGRADE' },
      targetPlanName: 'Mumate +', heldPlanName: 'Mumate Pro',
    })
    expect(new URLSearchParams(down.href.split('?')[1]).get('plan')).toBe('Mumate Pro')
  })

  it('🔴 a 409 that is NOT a refusal is OUR failure, not the bank — #492 r2', () => {
    // charge-flow answers 409 for a quote that expired and for a price that moved. Those are a different
    // screen, and they must not be dressed up as "you already own this" — NOR as "the bank refused",
    // which is what this branch said until review r2. A real Omise decline answers 200 with
    // status REJECT (charge-flow.ts:192), so it never arrives here at all.
    expect(state(payDestination({ ...base, lane: 'card', status: 409, ok: false, body: {} }).href)).toBe('PAYMENT_SETUP_BROKEN')
    expect(state(payDestination({ ...base, lane: 'card', status: 409, ok: false, body: { purchaseError: 'QUOTE_REQUIRED' } }).href)).toBe('PAYMENT_SETUP_BROKEN')
    // and a refusal-shaped string on a non-409 answer proves nothing — never take the client's word for it
    expect(state(payDestination({ ...base, lane: 'card', status: 500, ok: false, body: { purchaseError: 'ALREADY_ON_THIS_TIER' } }).href)).toBe('PAYMENT_SETUP_BROKEN')
  })

  it('🔴 NOTHING the card lane can answer reaches CARD_DECLINED — a bank cannot get here', () => {
    // The class, pinned. CARD_DECLINED must be unreachable from payDestination entirely: the only honest
    // source is /payment/status reporting REJECTED, which this function never sees.
    for (const status of [400, 401, 403, 404, 409, 429, 500, 502, 503]) {
      const d = payDestination({ ...base, lane: 'card', status, ok: false, body: {} })
      expect(state(d.href), `HTTP ${status}`).not.toBe('CARD_DECLINED')
    }
  })

  it('an unknown purchaseError never reaches the URL — result.tsx would park the reader on a spinner', () => {
    const d = payDestination({ ...base, lane: 'card', status: 409, ok: false, body: { purchaseError: 'SOMETHING_NEW' } })
    expect(state(d.href)).toBe('PAYMENT_SETUP_BROKEN')
    expect(d.href).not.toContain('SOMETHING_NEW')
  })
})

describe('#466 the two lanes fail in their own words', () => {
  it('MP-LANE — a QR cannot be declined by a bank, so the PromptPay lane never says so', () => {
    for (const body of [{}, { chargeId: 'c1' }, { qr: 'https://x' }]) {
      const d = payDestination({ ...base, lane: 'promptpay', status: 200, ok: true, body })
      expect(state(d.href), JSON.stringify(body)).toBe('OFFLINE')
      expect(d.href).not.toContain('CARD_DECLINED')
      expect(d.keepPaying).toBe(false)
    }
  })

  it('a 200 with no chargeId is OURS too — success with a malformed body is still our failure (#492 r2)', () => {
    // ok:true and nothing to poll. Our endpoint said yes and handed back nothing; the bank is not
    // involved in that sentence either.
    const d = payDestination({ ...base, lane: 'card', status: 200, ok: true, body: {} })
    expect(state(d.href)).toBe('PAYMENT_SETUP_BROKEN')
    expect(d.href).toContain('package_code=V2_PLUS_YEARLY')
  })
})

describe('#466 the success paths are unchanged', () => {
  it('promptpay hands the QR to the QR screen', () => {
    const d = payDestination({ ...base, lane: 'promptpay', status: 200, ok: true, body: { chargeId: 'chrg_1', qr: 'https://omise/x.png' } })
    expect(d.href).toContain('/v2/shop/qrcode')
    expect(d.href).toContain('charge=chrg_1')
    expect(d.href).toContain('amount=79000')
    expect(d.keepPaying).toBe(true)
  })

  it('MP-3DS — the bank’s page is EXTERNAL, never pushed through our router', () => {
    const d = payDestination({ ...base, lane: 'card', status: 200, ok: true, body: { chargeId: 'chrg_1', authorizeUri: 'https://bank.example/3ds' } })
    expect(d.kind).toBe('external')
    expect(d.href).toBe('https://bank.example/3ds')
  })

  it('MP-PAYING — leaving the app keeps the button disabled, so nobody charges twice on the way out', () => {
    const leaving = payDestination({ ...base, lane: 'card', status: 200, ok: true, body: { chargeId: 'c', authorizeUri: 'https://bank/3ds' } })
    expect(leaving.keepPaying).toBe(true)
    const accepted = payDestination({ ...base, lane: 'card', status: 200, ok: true, body: { chargeId: 'c' } })
    expect(accepted.keepPaying).toBe(true)
    expect(state(accepted.href)).toBe('PAYING')
    // …and only where NOTHING was created may the user act again
    expect(payDestination({ ...base, lane: 'card', status: 402, ok: false, body: {} }).keepPaying).toBe(false)
  })

  it('an accepted card is PAYING, never APPROVED — only the webhook may say the money moved', () => {
    const d = payDestination({ ...base, lane: 'card', status: 200, ok: true, body: { chargeId: 'chrg_9' } })
    expect(state(d.href)).toBe('PAYING')
    expect(d.href).not.toContain('APPROVED')
  })
})
