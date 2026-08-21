// #361 — teeth for the pure discount money math (lib/discount/rules.ts). MAIN lane.
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MD1  PERCENT stops flooring (rounds) → discount can exceed the advertised %  → the floor test reddens
//   MD2  max_discount cap stops applying to FIXED                                → the FIXED-cap test reddens
//   MD3  the clamp-to-list is dropped → a big FIXED yields a negative amount     → the clamp test reddens
//   MD4  the gateway-minimum check is dropped → a 100%-off amount is allowed     → the BELOW_MIN test reddens
//   MD5  codeApplies ignores applies_to                                          → the applies_to test reddens
import { describe, it, expect } from 'vitest'
import {
  quoteWithCode,
  discountSatangFor,
  vatBackward,
  codeApplies,
  MIN_CHARGE_SATANG,
  type DiscountCodeSpec,
} from '@/lib/discount/rules'

const base = (o: Partial<DiscountCodeSpec> = {}): DiscountCodeSpec => ({
  kind: 'PERCENT',
  value: 10,
  maxDiscountSatang: null,
  appliesTo: [],
  status: 'ACTIVE',
  startsAt: null,
  endsAt: null,
  ...o,
})

describe('quoteWithCode — the locked formula (list − code = amount, VAT backward)', () => {
  it('SAVE10 (PERCENT 10) on ฿1,590 → discount ฿159, amount ฿1,431 (design example)', () => {
    const q = quoteWithCode({ listSatang: 159000, code: base({ value: 10 }), vatPercent: 0 })
    expect(q).toEqual({ listSatang: 159000, discountSatang: 15900, amountSatang: 143100, vatSatang: 0 })
  })

  it('VAT 7% is extracted backward from the discounted amount (inclusive)', () => {
    const q = quoteWithCode({ listSatang: 159000, code: base({ value: 10 }), vatPercent: 7 })
    // round(143100 * 7 / 107) = round(9361.68) = 9362
    expect(q).toMatchObject({ amountSatang: 143100, vatSatang: 9362 })
  })
})

describe('discountSatangFor — floor, cap, clamp', () => {
  it('MD1 — PERCENT floors (never more than the advertised %)', () => {
    // 12345 * 10% = 1234.5 → floor 1234
    expect(discountSatangFor(12345, base({ kind: 'PERCENT', value: 10 }))).toBe(1234)
  })
  it('FIXED is a flat satang discount', () => {
    expect(discountSatangFor(159000, base({ kind: 'FIXED', value: 5000 }))).toBe(5000)
  })
  it('MD2 — max_discount_satang caps BOTH PERCENT and FIXED', () => {
    expect(discountSatangFor(159000, base({ kind: 'PERCENT', value: 50, maxDiscountSatang: 10000 }))).toBe(10000)
    expect(discountSatangFor(159000, base({ kind: 'FIXED', value: 90000, maxDiscountSatang: 10000 }))).toBe(10000)
  })
  it('MD3 — the discount is clamped to the price (never more than list ⇒ amount never negative)', () => {
    expect(discountSatangFor(50000, base({ kind: 'FIXED', value: 99999 }))).toBe(50000)
  })
})

describe('quoteWithCode — no 100%-off / below-minimum (ตู๋ B4)', () => {
  it('MD4 — a FIXED discount that drops the amount under the gateway minimum is REFUSED', () => {
    const q = quoteWithCode({ listSatang: 159000, code: base({ kind: 'FIXED', value: 159000 }), vatPercent: 0 })
    expect(q).toEqual({ ok: false, reason: 'BELOW_MIN' }) // clamped discount = list ⇒ amount 0 < min ⇒ refuse
  })
  it('a FIXED that lands the amount EXACTLY at the minimum is allowed', () => {
    const q = quoteWithCode({
      listSatang: 159000,
      code: base({ kind: 'FIXED', value: 159000 - MIN_CHARGE_SATANG }),
      vatPercent: 0,
    })
    expect(q).toMatchObject({ amountSatang: MIN_CHARGE_SATANG })
  })
})

describe('vatBackward', () => {
  it('0% ⇒ 0; 7% ⇒ round(amount*7/107)', () => {
    expect(vatBackward(143100, 0)).toBe(0)
    expect(vatBackward(143100, 7)).toBe(9362)
  })
})

describe('codeApplies — status / window / applies_to (quota is the DB, not here)', () => {
  const now = new Date('2026-08-21T10:00:00Z')
  it('ACTIVE, in-window, applicable ⇒ ok', () => {
    expect(codeApplies(base({ appliesTo: ['MONTHLY'] }), 'MONTHLY', now).ok).toBe(true)
    expect(codeApplies(base({ appliesTo: [] }), 'ANYTHING', now).ok).toBe(true) // [] = every package
  })
  it('PAUSED / EXPIRED ⇒ STATUS', () => {
    expect(codeApplies(base({ status: 'PAUSED' }), 'MONTHLY', now)).toEqual({ ok: false, reason: 'STATUS' })
  })
  it('before starts_at or after ends_at ⇒ WINDOW', () => {
    expect(codeApplies(base({ startsAt: '2026-09-01T00:00:00Z' }), 'MONTHLY', now)).toEqual({ ok: false, reason: 'WINDOW' })
    expect(codeApplies(base({ endsAt: '2026-08-01T00:00:00Z' }), 'MONTHLY', now)).toEqual({ ok: false, reason: 'WINDOW' })
  })
  it('MD5 — a package NOT in a non-empty applies_to ⇒ NOT_APPLICABLE', () => {
    expect(codeApplies(base({ appliesTo: ['SOULMATE'] }), 'MONTHLY', now)).toEqual({ ok: false, reason: 'NOT_APPLICABLE' })
  })
})
