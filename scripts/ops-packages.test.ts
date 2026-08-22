// #377 — teeth for the /ops package rules (PURE half). MAIN lane.
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MO1  a non-integer / negative / absurd price is accepted     → the price tests redden
//   MO2  a 0-baht package may be switched ON                     → the SELLING_A_ZERO_PRICE test reddens
//   MO3  isActive stops being strict (any truthy turns it on)    → the checkbox test reddens
import { describe, it, expect } from 'vitest'
import { validateEdit, MAX_PRICE_BAHT } from '@/lib/ops/packages'

const edit = (o: Record<string, unknown> = {}) => ({
  packageCode: 'V2_PRO_YEARLY',
  amountBaht: 1590,
  isActive: true,
  ...o,
})

describe('validateEdit — what /ops is allowed to change', () => {
  it('a whole-baht price on a real package is accepted', () => {
    const r = validateEdit(edit())
    expect(r).toEqual({ ok: true, edit: { packageCode: 'V2_PRO_YEARLY', amountBaht: 1590, isActive: true } })
  })

  it('MO1 — a fractional, negative, NaN or absurd price is refused', () => {
    for (const amountBaht of [1590.5, -1, Number.NaN, 'abc', MAX_PRICE_BAHT + 1]) {
      expect(validateEdit(edit({ amountBaht }))).toEqual({ ok: false, reason: 'BAD_PRICE' })
    }
  })

  it('a price of 0 is fine as long as the package stays OFF (the monthly rows live here)', () => {
    expect(validateEdit(edit({ amountBaht: 0, isActive: false }))).toMatchObject({ ok: true })
  })

  it('MO2 — turning a 0-baht package ON is refused (a card that the charge lane would reject)', () => {
    expect(validateEdit(edit({ amountBaht: 0, isActive: true }))).toEqual({
      ok: false,
      reason: 'SELLING_A_ZERO_PRICE',
    })
  })

  it('MO3 — is_active is strict: only true / "true" turn a package on', () => {
    expect(validateEdit(edit({ isActive: 'true' }))).toMatchObject({ ok: true, edit: { isActive: true } })
    for (const v of [1, 'yes', 'on', {}, 'false', false, null, undefined]) {
      expect(validateEdit(edit({ isActive: v })).ok && validateEdit(edit({ isActive: v })).edit.isActive).toBe(false)
    }
  })

  it('an empty package_code is refused', () => {
    expect(validateEdit(edit({ packageCode: '   ' }))).toEqual({ ok: false, reason: 'BAD_PACKAGE' })
  })

  it('the edit carries ONLY price + on-sale — nothing that could change a tier or invent a package', () => {
    const r = validateEdit({ ...edit(), tierCode: 'PRO', expire: '10Y' } as never)
    expect(r.ok && Object.keys(r.edit).sort()).toEqual(['amountBaht', 'isActive', 'packageCode'])
  })
})
