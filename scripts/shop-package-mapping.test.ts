// #359 — teeth for the shop screen's plan→package_code mapping (features/v2-shop/packages.ts). MAIN lane.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MS1  swap the codes of two cards                    → the "each plan keeps its own code" test reddens
//   MS2  give `free` a package_code                     → the "free never reaches checkout" test reddens
//   MS3  checkoutHrefFor stops encoding / drops the code → the href test reddens
//   MS4  isSellable returns true for a null code        → the not-yet-sellable test reddens
//   MS5  declare a package_code that lib/payment/catalog.ts cannot sell
//                                                        → the catalog-agreement test reddens
//
// 🔑 MS5 is the one that matters most and the one a screen-only test would miss: it asserts the screen and
// the MONEY LANE agree. A code the catalog cannot map throws UnsellablePackageError
// (lib/payment/catalog.ts:79-82) — i.e. the user taps, and the failure happens at the till. This test moves
// that failure to `npm test`. It is deliberately written against the REAL catalog export, not a fixture:
// a fixture would freeze today's answer and stop biting the day marketing edits the catalog.
import { describe, it, expect } from 'vitest'
import {
  PLANS,
  codeFor,
  isSellable,
  checkoutHrefFor,
  type BillingPeriod,
} from '@/features/v2-shop/packages'
import { PACKAGE_TIER } from '@/lib/payment/catalog'

const PERIODS: BillingPeriod[] = ['monthly', 'annual']
const planBy = (id: string) => {
  const p = PLANS.find((x) => x.id === id)
  if (!p) throw new Error(`no plan ${id} — the screen lost a card`)
  return p
}

describe('#359 shop plan catalogue', () => {
  // Guards "a gate that answers over zero items": every assertion below iterates PLANS, so an empty or
  // truncated PLANS would make them all vacuously pass.
  it('renders exactly the three cards the design draws', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['free', 'plus', 'pro'])
  })

  it('every card carries a name, a tagline and at least one feature line', () => {
    for (const p of PLANS) {
      expect(p.name.length, `${p.id} name`).toBeGreaterThan(0)
      expect(p.tagline.length, `${p.id} tagline`).toBeGreaterThan(0)
      expect(p.features.length, `${p.id} features`).toBeGreaterThan(0)
    }
  })

  // MS1 — swapping two cards' codes must redden. Asserting a per-plan expected code (not "all codes are
  // distinct"): distinctness survives a swap, which is exactly the bug the ticket asks the mutant to catch.
  it('each plan keeps its OWN package_code', () => {
    expect(codeFor(planBy('plus'), 'monthly')).toBe('MONTHLY')
    expect(codeFor(planBy('pro'), 'monthly')).not.toBe('MONTHLY')
    expect(codeFor(planBy('free'), 'monthly')).toBeNull()
  })

  // MS2 — free must never acquire a code, in any period.
  it('free never reaches checkout, in any billing period', () => {
    const free = planBy('free')
    for (const period of PERIODS) {
      expect(codeFor(free, period), period).toBeNull()
      expect(isSellable(free, period), period).toBe(false)
      expect(checkoutHrefFor(free, period), period).toBeNull()
    }
  })

  // MS3 — the href must carry the code the card sells, url-encoded.
  it('a sellable card links to checkout carrying its own code', () => {
    const plus = planBy('plus')
    const href = checkoutHrefFor(plus, 'monthly')
    expect(href).toBe('/v2/shop/checkout?package_code=MONTHLY')
    expect(href).toContain(codeFor(plus, 'monthly') as string)
  })

  // MS4 — "no code yet" must not read as sellable. Today this is Pro (#359 B2) and every annual code
  // (#359 B3); the assertion is written against the DATA, so it keeps working when marketing fills them in.
  it('a plan with no package_code is not sellable and has no checkout link', () => {
    let checked = 0
    for (const p of PLANS) {
      for (const period of PERIODS) {
        if (codeFor(p, period) !== null) continue
        checked++
        expect(isSellable(p, period), `${p.id}/${period}`).toBe(false)
        expect(checkoutHrefFor(p, period), `${p.id}/${period}`).toBeNull()
      }
    }
    // Say the surface size out loud: "passed" must not be reachable by checking nothing.
    expect(checked, 'no not-yet-sellable combination was exercised').toBeGreaterThan(0)
  })

  // MS5 — the screen must never advertise a code the money lane refuses to sell.
  it('every package_code the screen sells is one lib/payment/catalog.ts can map', () => {
    let sold = 0
    for (const p of PLANS) {
      for (const period of PERIODS) {
        const code = codeFor(p, period)
        if (code === null) continue
        sold++
        expect(
          PACKAGE_TIER[code],
          `${p.id}/${period} sells ${code}, which catalog.ts cannot map — quotePackage would throw`,
        ).toBeDefined()
      }
    }
    expect(sold, 'no sellable code was exercised — this gate answered over zero items').toBeGreaterThan(0)
  })
})
