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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 📌 #377 moved tiers out of a hardcoded PACKAGE_TIER map and into payment_package.tier_code, so there is
// no longer a constant to import. The money-lane fact now lives in the MIGRATION, and that is what this
// spec reads — the same source the DB is built from. It is deliberately not a fixture: a fixture would
// freeze today's rows and stop biting the day someone edits the migration.
//
// 🔴 This was a SEMANTIC conflict, not a textual one: the rebase onto #377 merged cleanly (different
// files) and `tsc --noEmit` stayed green — because tsconfig excludes scripts/ (see mootech-fe#351). The
// only thing that caught the broken import was `npm test`.
const MIGRATION = readFileSync(join(process.cwd(), 'lib/db/0009_package_tier.sql'), 'utf8')

/** package_code → tier_code, read out of the INSERT … VALUES block of 0009. */
function migrationRows(): Map<string, { tier: string; active: boolean }> {
  const rows = new Map<string, { tier: string; active: boolean }>()
  // Line-based on purpose: each VALUES row is one line, and the `description` column contains parentheses
  // ('Mumate + (รายปี)'), which makes any `[^)]` span stop in the wrong place. Caught by this spec's own
  // "the parser is a gate too" assertion rather than by a wrong answer.
  for (const line of MIGRATION.split('\n')) {
    const code = /'(V2_[A-Z0-9_]+)'/.exec(line)?.[1]
    if (!code) continue
    const tier = /'(FREE|PLUS|PRO)'/.exec(line)?.[1]
    const active = /,\s*(true|false)\s*\)/.exec(line)?.[1]
    if (!tier || !active) continue
    rows.set(code, { tier, active: active === 'true' })
  }
  return rows
}

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
    expect(codeFor(planBy('plus'), 'annual')).toBe('V2_PLUS_YEARLY')
    expect(codeFor(planBy('pro'), 'annual')).toBe('V2_PRO_YEARLY')
    expect(codeFor(planBy('plus'), 'monthly')).toBe('V2_PLUS_MONTHLY')
    expect(codeFor(planBy('pro'), 'monthly')).toBe('V2_PRO_MONTHLY')
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
    const href = checkoutHrefFor(plus, 'annual')
    expect(href).toBe('/v2/shop/checkout?package_code=V2_PLUS_YEARLY')
    expect(href).toContain(codeFor(plus, 'annual') as string)
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

  // MS5 — the screen must never advertise a package_code that does not exist in the DB, or one whose tier
  // is not a paid tier. Either would throw UnsellablePackageError at lib/payment/catalog.ts:78-81 — i.e.
  // the user taps, and the failure happens at the till.
  it('every package_code the screen declares exists in the migration with a paid tier', () => {
    const rows = migrationRows()
    // The parser is a gate too: if it matched nothing, every assertion below would pass over zero items.
    expect(rows.size, 'อ่านแถวจาก 0009_package_tier.sql ไม่ได้เลย — ตัวอ่านพัง ไม่ใช่ข้อมูลว่าง').toBe(4)

    let declared = 0
    for (const p of PLANS) {
      for (const period of PERIODS) {
        const code = codeFor(p, period)
        if (code === null) continue
        declared++
        const row = rows.get(code)
        expect(row, `${p.id}/${period} sells ${code}, which 0009 never inserts`).toBeDefined()
        expect(row!.tier, `${code} has tier ${row!.tier} — not a paid tier`).not.toBe('FREE')
      }
    }
    expect(declared, 'no declared code was exercised — this gate answered over zero items').toBeGreaterThan(0)
  })

  // 🔴 The screen must not decide "buyable" from this file alone. is_active is flipped from /ops without a
  // deploy (#377), so it is a RUNTIME fact — asserted here only to record which rows ship switched off, so
  // that a migration change that silently turns the monthly pair on is visible in a diff.
  it('บันทึกไว้ว่าแถวไหน ship มาแบบปิดขาย — และจอต้องไม่ตัดสินจากไฟล์นี้', () => {
    const rows = migrationRows()
    expect(rows.get('V2_PLUS_YEARLY')?.active, 'รายปี PLUS ควรเปิดขาย').toBe(true)
    expect(rows.get('V2_PRO_YEARLY')?.active, 'รายปี PRO ควรเปิดขาย').toBe(true)
    expect(rows.get('V2_PLUS_MONTHLY')?.active, 'รายเดือน PLUS ship มาแบบปิดขาย').toBe(false)
    expect(rows.get('V2_PRO_MONTHLY')?.active, 'รายเดือน PRO ship มาแบบปิดขาย').toBe(false)
  })
})
