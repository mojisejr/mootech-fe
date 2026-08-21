// #355 — teeth for v2 PROVISIONING (member_subscription row + member_payment shadow merge). PURE, main lane.
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MP1  shadow OVERWRITES expire_at instead of GREATEST(existing, new)  → the "existing longer is kept" test reddens
//   MP2  shadow plan_code is not forced to 'MEMBER'                       → the plan_code test reddens
//   MP3  month/year add stops clamping to end-of-month                    → the Jan-31 test reddens
//   MP4  buffer_day is dropped from expire/start                          → the buffer test reddens
import { describe, it, expect } from 'vitest'
import { addDays, addMonths, computeExpireDate, laterDate, buildProvision } from '@/lib/payment/provision'
import type { Quote } from '@/lib/payment/catalog'

describe('civil date math (UTC, clamped like moment)', () => {
  it('addDays crosses month/year boundaries', () => {
    expect(addDays('2026-08-21', 11)).toBe('2026-09-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('MP3 — addMonths clamps to end-of-month (Jan 31 + 1M → Feb 28, leap → Feb 29)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29') // 2028 is a leap year
    expect(addMonths('2026-08-21', 1)).toBe('2026-09-21')
    expect(addMonths('2026-08-21', 12)).toBe('2027-08-21')
  })
})

describe('computeExpireDate — (today + buffer days) + duration', () => {
  it('1M from a zero-buffer package', () => {
    expect(computeExpireDate('2026-08-21', 0, { value: 1, unit: 'M' })).toBe('2026-09-21')
  })
  it('MP4 — 1Y with a 7-day buffer counts the buffer first (base 2026-08-28 → 2027-08-28)', () => {
    expect(computeExpireDate('2026-08-21', 7, { value: 1, unit: 'Y' })).toBe('2027-08-28')
  })
  it('10Y and 30D', () => {
    expect(computeExpireDate('2026-08-21', 0, { value: 10, unit: 'Y' })).toBe('2036-08-21')
    expect(computeExpireDate('2026-08-21', 0, { value: 30, unit: 'D' })).toBe('2026-09-20')
  })
})

describe('laterDate — GREATEST for ISO date strings', () => {
  it('keeps the later of the two, handles null/blank existing', () => {
    expect(laterDate('2027-12-31', '2026-09-21')).toBe('2027-12-31')
    expect(laterDate('2026-01-01', '2026-09-21')).toBe('2026-09-21')
    expect(laterDate(null, '2026-09-21')).toBe('2026-09-21')
    expect(laterDate('', '2026-09-21')).toBe('2026-09-21')
    expect(laterDate('garbage', '2026-09-21')).toBe('2026-09-21')
  })
})

const quote: Quote = {
  packageCode: 'MONTHLY',
  tierCode: 'PLUS',
  amountSatang: 50000,
  vatSatang: 0,
  expire: { value: 1, unit: 'M' },
  bufferDay: 0,
}

describe('buildProvision — a NEW subscription row + a MERGED shadow', () => {
  it('no existing member_payment ⇒ shadow = the new span, plan MEMBER, subscription records the same span', () => {
    const { subscription, shadow } = buildProvision({
      userId: 'u-1',
      quote,
      paymentId: 'pay-1',
      today: '2026-08-21',
      existingMemberPayment: null,
    })
    expect(subscription).toEqual({
      userId: 'u-1',
      tierCode: 'PLUS',
      packageCode: 'MONTHLY',
      amountSatang: 50000,
      startAt: '2026-08-21',
      expireAt: '2026-09-21',
      paymentId: 'pay-1',
      status: 'ACTIVE',
    })
    expect(shadow).toEqual({
      userId: 'u-1',
      planCode: 'MEMBER',
      packageCode: 'MONTHLY',
      startAt: '2026-08-21',
      expireAt: '2026-09-21',
    })
  })

  it('MP1 — an existing member with a LATER expiry keeps it in the shadow (days never burn)', () => {
    const { subscription, shadow } = buildProvision({
      userId: 'u-1',
      quote,
      paymentId: 'pay-2',
      today: '2026-08-21',
      existingMemberPayment: { expireAt: '2027-12-31' }, // still has ~16 months left
    })
    expect(shadow.expireAt).toBe('2027-12-31') // GREATEST — NOT shortened to 2026-09-21
    expect(subscription.expireAt).toBe('2026-09-21') // the row for THIS purchase records its own span
  })

  it('an existing member whose expiry is SOONER than the new one is extended', () => {
    const { shadow } = buildProvision({
      userId: 'u-1',
      quote,
      paymentId: 'pay-3',
      today: '2026-08-21',
      existingMemberPayment: { expireAt: '2026-08-25' },
    })
    expect(shadow.expireAt).toBe('2026-09-21')
  })

  it('MP2 — the shadow plan_code is ALWAYS MEMBER regardless of the package', () => {
    const { shadow } = buildProvision({
      userId: 'u-1',
      quote: { ...quote, packageCode: 'FAMILY_5' },
      paymentId: 'pay-4',
      today: '2026-08-21',
      existingMemberPayment: null,
    })
    expect(shadow.planCode).toBe('MEMBER')
  })
})
