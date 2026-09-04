// #355 — teeth for the v2 payment CATALOG (server-authoritative pricing + tier mapping). PURE, main lane.
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MC1  an unmapped package_code resolves to a paid tier instead of throwing  → the fail-loud test reddens
//   MC2  satang stops being round(amount*100)                                  → the rounding test reddens
//   MC3  VAT stops being extracted backward (amount*rate/(1+rate))             → the VAT-7% test reddens
//   MC4  a client code discount is trusted as-is instead of stubbed to 0       → the discount-ignored test reddens
import { describe, it, expect } from 'vitest'
import { quotePackage, parseExpireSpec, qiQtyOf, UnsellablePackageError, type PackageRow } from '@/lib/payment/catalog'

// #377: the tier and the on-sale flag now come from the payment_package ROW (they used to be a hardcoded
// map here). The teeth below are unchanged in meaning — only where the inputs come from moved.

const MONTHLY: PackageRow = { packageCode: 'MONTHLY', planCode: 'MEMBER', amount: 500, expire: '1M', bufferDay: 0, tierCode: 'PLUS', isActive: true }
const SOULMATE: PackageRow = { packageCode: 'SOULMATE', planCode: 'MEMBER', amount: 499, expire: '1Y', bufferDay: 7, tierCode: 'PLUS', isActive: true }

describe('quotePackage — server computes amount + tier, fails loud on the unmappable', () => {
  it('MC2 — amount is round(THB * 100) satang, VAT-inclusive', () => {
    expect(quotePackage(MONTHLY).amountSatang).toBe(50000)
    expect(quotePackage(SOULMATE).amountSatang).toBe(49900)
  })

  it('maps a known paid package to its tier + carries the expire spec + buffer', () => {
    const q = quotePackage(SOULMATE)
    expect(q.tierCode).toBe('PLUS')
    expect(q.expire).toEqual({ value: 1, unit: 'Y' })
    expect(q.bufferDay).toBe(7)
  })

  it('MC1 — an unmapped package_code THROWS (no charge for a package with no paid tier)', () => {
    // a FREE-tier row, a one-off HOROSCOPE row, and a row whose tier_code is unmappable garbage
    // 🔴 DO NOT DELETE `horoscope` AS A DUPLICATE OF `free`. They look alike (both tierCode 'FREE') and are
    // not: measured 2026-08-29 by removing `|| tierCode === 'FREE'` from lib/payment/catalog.ts:79 and
    // running the three individually, `free` still throws on the amount check (amount 0) and `garbageTier`
    // still throws on the null half, so `horoscope` (amount 690) is the ONLY row that reddens. It is the
    // whole pin on a clause other code leans on — see the note at that line and mootech-fe#525.
    const free: PackageRow = { packageCode: 'FREE', planCode: 'MEMBER', amount: 0, expire: '0D', bufferDay: 0, tierCode: 'FREE', isActive: true }
    const horoscope: PackageRow = { packageCode: 'MUMATE_AI', planCode: 'HOROSCOPE', amount: 690, expire: '0D', bufferDay: 0, tierCode: 'FREE', isActive: true }
    const garbageTier: PackageRow = { ...MONTHLY, tierCode: 'GARBAGE' }
    for (const p of [free, horoscope, garbageTier]) {
      expect(() => quotePackage(p)).toThrow(UnsellablePackageError)
    }
  })

  it('🔴 #377 — a package that is NOT on sale throws BEFORE pricing (closing "hidden on the screen, still sold by the API")', () => {
    expect(() => quotePackage({ ...MONTHLY, isActive: false })).toThrow(UnsellablePackageError)
  })

  it('a non-positive / NaN amount on a mapped package still throws (never charges 0)', () => {
    expect(() => quotePackage({ ...MONTHLY, amount: 0 })).toThrow(UnsellablePackageError)
    expect(() => quotePackage({ ...MONTHLY, amount: Number('x') })).toThrow(UnsellablePackageError)
  })

  it('VAT = 0 (default) ⇒ vatSatang 0 (no VAT line), amount unchanged', () => {
    const q = quotePackage(MONTHLY)
    expect(q.vatSatang).toBe(0)
    expect(q.amountSatang).toBe(50000)
  })

  it('MC3 — VAT is extracted BACKWARD from the inclusive amount: rate 7% on 50000 → 3271, amount unchanged', () => {
    // round(50000 * 0.07 / 1.07) = round(3271.02...) = 3271
    const q = quotePackage(MONTHLY, { vatRate: 0.07 })
    expect(q.vatSatang).toBe(3271)
    expect(q.amountSatang).toBe(50000) // inclusive: the charged amount does not grow with VAT
  })

  it('MC4 — a code discount reduces the amount (server-computed), default stub is 0', () => {
    expect(quotePackage(MONTHLY, { codeDiscountSatang: 0 }).amountSatang).toBe(50000)
    expect(quotePackage(MONTHLY, { codeDiscountSatang: 10000 }).amountSatang).toBe(40000)
  })

  it('a discount that zeroes/over-shoots the amount throws (never a free or negative charge)', () => {
    expect(() => quotePackage(MONTHLY, { codeDiscountSatang: 50000 })).toThrow(UnsellablePackageError)
    expect(() => quotePackage(MONTHLY, { codeDiscountSatang: 60000 })).toThrow(UnsellablePackageError)
  })
})

describe('parseExpireSpec — strict single value+unit, matches v1', () => {
  it('parses 1Y / 1M / 30D', () => {
    expect(parseExpireSpec('1Y')).toEqual({ value: 1, unit: 'Y' })
    expect(parseExpireSpec('30D')).toEqual({ value: 30, unit: 'D' })
    expect(parseExpireSpec('10Y')).toEqual({ value: 10, unit: 'Y' })
  })
  it('rejects malformed durations (spaces / lowercase / multi-segment / empty)', () => {
    for (const bad of ['1Y 6M', '1y', ' 1Y', '', 'Y', '1W']) {
      expect(() => parseExpireSpec(bad)).toThrow(UnsellablePackageError)
    }
  })
})

// ── QI PACKS (buy-qi ก้อน 1.6) — tier 'QI' อยู่นอกบันไดสมาชิก: ราคาผ่านรางเดียวกัน, ปริมาณชี่ต้องรู้จัก ──
describe('quotePackage — เลนแพ็กชี่ (tierCode QI)', () => {
  const pack = (code: string, amount: number, overrides: Partial<PackageRow> = {}): PackageRow =>
    ({ packageCode: code, planCode: 'MEMBER', amount, expire: '1Y', bufferDay: 0, tierCode: 'QI', isActive: true, ...overrides })

  it('แพ็กที่รู้จัก ได้ tier QI + ราคา satang ตามแถวจริง', () => {
    const q = quotePackage(pack('QI_200', 59))
    expect(q.tierCode).toBe('QI')
    expect(q.amountSatang).toBe(5900)
    expect(qiQtyOf('QI_1200')).toBe(1200)
  })

  it('แพ็ก QI ที่ไม่รู้จัก THROWS — เงินห้ามวิ่งก่อนรู้ว่าขายอะไร', () => {
    expect(() => quotePackage(pack('QI_999', 99))).toThrow(UnsellablePackageError)
  })

  it('แพ็ก QI ที่ปิดขายยัง THROWS ตามเดิม (isActive ตรวจก่อนปริมาณ)', () => {
    expect(() => quotePackage(pack('QI_200', 59, { isActive: false }))).toThrow(UnsellablePackageError)
  })

  it('qiQtyOf — ไม่รู้จัก = null ไม่ใช่ 0 (0 ชี่ที่ถูกต้องจะทำให้ grant เงียบ ๆ ไม่เครดิต)', () => {
    expect(qiQtyOf('QI_500')).toBe(500)
    expect(qiQtyOf('V2_PRO_YEARLY')).toBeNull()
  })
})
