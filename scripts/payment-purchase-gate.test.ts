// #456 — teeth for the REPURCHASE / UPGRADE decision. PURE, main lane (npm test).
//
// The DoD says "พิสูจน์ทีละแถว ไม่ใช่พิสูจน์รวม", so every row of ฟีม's matrix gets its OWN `it`: a single
// combined assertion would let one row rot green behind the others.
//
// 🔴 MUTANT CONTRACT (each of these reddens `npm test` — the DoD's "ตัวพิสูจน์ว่ามีฟัน"):
//   MG1  drop the carry-over (return carryOverDays: 0 for an upgrade)       → the "PLUS→PRO carries N days" tests redden
//   MG2  remove the gate (always { allow: true })                           → all four refusal tests redden
//   MG3  refuse legacy-paid members instead of allowing them                → the legacy tests redden
//   MG4  make remainingDays inclusive of the expiry day (off-by-one)        → the day-count tests redden
//   MG5  let a downgrade through (wanted < held ⇒ allow)                    → the PRO→PLUS test reddens
//   MG6  treat an unpaid/lapsed user as paid                                → the "first purchase unchanged" tests redden
//   MG7  decideSettlement grants a tier BELOW the one held (the demotion)   → the settlement downgrade tests redden
//   MG8  decideSettlement refuses the SAME tier instead of adding its time  → the "ฟีม paid twice" test reddens
import { describe, it, expect } from 'vitest'
import { decidePurchase, decideSettlement, remainingDays, type Entitlement } from '@/lib/payment/purchase-gate'
import { tierRank } from '@/lib/v2/tier'

const TODAY = '2026-08-26'

// Helpers keep each row readable as the matrix row it is, not as an object literal.
const free: Entitlement = { tier: null, isPaid: false, expireAt: null }
const lapsed: Entitlement = { tier: 'PLUS', isPaid: false, expireAt: '2026-08-01' }
const plusUntil = (expireAt: string): Entitlement => ({ tier: 'PLUS', isPaid: true, expireAt })
const proUntil = (expireAt: string): Entitlement => ({ tier: 'PRO', isPaid: true, expireAt })
const legacyUntil = (expireAt: string): Entitlement => ({ tier: null, isPaid: true, expireAt })

describe('tierRank — the ladder #456 compares on', () => {
  it('orders FREE < PLUS < PRO, and refuses to place an unnamed tier', () => {
    expect(tierRank('FREE')).toBe(0)
    expect(tierRank('PLUS')).toBe(1)
    expect(tierRank('PRO')).toBe(2)
    expect(tierRank(null)).toBeNull()
    expect(tierRank(undefined)).toBeNull()
  })
})

describe('remainingDays — days still owed, counted from today', () => {
  it('MG4 — the expiry day itself is not a day still OWED (today is being spent now)', () => {
    expect(remainingDays(TODAY, '2026-08-26')).toBe(0) // expires today ⇒ nothing follows them
    expect(remainingDays(TODAY, '2026-08-27')).toBe(1)
    expect(remainingDays(TODAY, '2026-09-26')).toBe(31)
  })
  it('a full year ahead counts every day, leap year included', () => {
    expect(remainingDays('2026-08-26', '2027-08-26')).toBe(365)
    expect(remainingDays('2028-01-01', '2028-03-01')).toBe(60) // 2028 is a leap year: Jan 31 + Feb 29
  })
  it('never returns a negative — an already-past date owes nothing, it does not SHORTEN the new span', () => {
    expect(remainingDays(TODAY, '2026-01-01')).toBe(0)
  })
  it('null / malformed dates owe nothing rather than throwing on the money path', () => {
    expect(remainingDays(TODAY, null)).toBe(0)
    expect(remainingDays(TODAY, undefined)).toBe(0)
    expect(remainingDays(TODAY, 'garbage')).toBe(0)
    expect(remainingDays(TODAY, '')).toBe(0)
  })
  it('accepts a timestamp-shaped value by taking its date part (DATE columns arrive both ways)', () => {
    expect(remainingDays(TODAY, '2026-08-27T00:00:00.000Z')).toBe(1)
  })
})

describe('the matrix — row by row (ฟีมเคาะ 2026-08-26, ทาง C)', () => {
  it('ROW 1a — Free buys PLUS: allowed, nothing carried (first purchase is UNCHANGED)', () => {
    expect(decidePurchase({ current: free, targetTier: 'PLUS', today: TODAY })).toEqual({
      allow: true,
      carryOverDays: 0,
    })
  })

  it('ROW 1b — Free buys PRO: allowed, nothing carried', () => {
    expect(decidePurchase({ current: free, targetTier: 'PRO', today: TODAY })).toEqual({
      allow: true,
      carryOverDays: 0,
    })
  })

  it('MG6 — a LAPSED member is not a current member: they buy again like anyone else, carrying nothing', () => {
    expect(decidePurchase({ current: lapsed, targetTier: 'PLUS', today: TODAY })).toEqual({
      allow: true,
      carryOverDays: 0,
    })
  })

  it('ROW 2 — PLUS buys PLUS: REFUSED (this is ฟีม’s 1,580-baht bug)', () => {
    expect(decidePurchase({ current: plusUntil('2027-08-25'), targetTier: 'PLUS', today: TODAY })).toEqual({
      allow: false,
      reason: 'ALREADY_ON_THIS_TIER',
    })
  })

  it('ROW 3 — PLUS with 364 days left buys PRO: upgraded NOW, all 364 days follow', () => {
    expect(decidePurchase({ current: plusUntil('2027-08-25'), targetTier: 'PRO', today: TODAY })).toEqual({
      allow: true,
      carryOverDays: 364,
    })
  })

  it('ROW 4 — PRO buys PLUS: REFUSED, a purchase must never take a level away', () => {
    expect(decidePurchase({ current: proUntil('2027-08-25'), targetTier: 'PLUS', today: TODAY })).toEqual({
      allow: false,
      reason: 'CANNOT_DOWNGRADE',
    })
  })

  it('ROW 5 — PRO buys PRO: REFUSED', () => {
    expect(decidePurchase({ current: proUntil('2027-08-25'), targetTier: 'PRO', today: TODAY })).toEqual({
      allow: false,
      reason: 'ALREADY_ON_THIS_TIER',
    })
  })

  it('MG1 — an upgrade on its LAST day carries 0, and is still an upgrade (not a refusal)', () => {
    expect(decidePurchase({ current: plusUntil(TODAY), targetTier: 'PRO', today: TODAY })).toEqual({
      allow: true,
      carryOverDays: 0,
    })
  })
})

describe('MG3 — legacy members (paid, no tier NAME) are never locked out', () => {
  it('a legacy member with 100 days left may buy PLUS, and the 100 days follow', () => {
    expect(decidePurchase({ current: legacyUntil('2026-12-04'), targetTier: 'PLUS', today: TODAY })).toEqual({
      allow: true,
      carryOverDays: 100,
    })
  })
  it('a legacy member may buy PRO too — we cannot place them on the ladder, so we never refuse', () => {
    expect(decidePurchase({ current: legacyUntil('2026-12-04'), targetTier: 'PRO', today: TODAY })).toEqual({
      allow: true,
      carryOverDays: 100,
    })
  })
})

describe('MG2 — the refusals are real (a gate that always allows fails these)', () => {
  it('every refusing row refuses, and no refusal carries a day count the caller could use', () => {
    const refusals = [
      decidePurchase({ current: plusUntil('2027-08-25'), targetTier: 'PLUS', today: TODAY }),
      decidePurchase({ current: proUntil('2027-08-25'), targetTier: 'PLUS', today: TODAY }),
      decidePurchase({ current: proUntil('2027-08-25'), targetTier: 'PRO', today: TODAY }),
    ]
    for (const r of refusals) {
      expect(r.allow).toBe(false)
      expect(r).not.toHaveProperty('carryOverDays')
    }
  })
})

// ── the SETTLEMENT question (ตู๋'s review of 2c196b8) ────────────────────────────────────────────────
//
// The door and the webhook are NOT the same question, and the tests say so separately on purpose. A door
// test that also passed for the webhook is exactly what let 1,790 บาท buy PLUS.
describe('decideSettlement — money has already moved; what may we WRITE?', () => {
  it('MG7 — a stale LOWER tier landing on a higher one is NOT granted (nobody is demoted by a payment)', () => {
    expect(decideSettlement({ current: proUntil('2027-08-25'), paidTier: 'PLUS', today: TODAY })).toEqual({
      grant: false,
      reason: 'WOULD_DOWNGRADE',
    })
  })

  it('MG7 — and a refusal carries no day count: nothing about the live row may be recomputed from it', () => {
    const d = decideSettlement({ current: proUntil('2027-08-25'), paidTier: 'PLUS', today: TODAY })
    expect(d).not.toHaveProperty('carryOverDays')
  })

  it('an UPGRADE landing is granted and carries the days left, exactly like the door promised', () => {
    expect(decideSettlement({ current: plusUntil('2027-08-25'), paidTier: 'PRO', today: TODAY })).toEqual({
      grant: true,
      carryOverDays: 364,
    })
  })

  it('MG8 — the SAME tier IS granted here, unlike at the door — this is ฟีม paying twice for PLUS', () => {
    // 🔴 The door refuses this (you would be paying for nothing). At the webhook the money is already gone,
    // so the honest outcome is to ADD the time it bought. Refusing here would rebuild the original bug:
    // 1,580 บาท for one year.
    expect(decideSettlement({ current: plusUntil('2027-08-25'), paidTier: 'PLUS', today: TODAY })).toEqual({
      grant: true,
      carryOverDays: 364,
    })
  })

  it('a first purchase (holding nothing) is granted with nothing carried', () => {
    expect(decideSettlement({ current: free, paidTier: 'PLUS', today: TODAY })).toEqual({
      grant: true,
      carryOverDays: 0,
    })
  })

  it('a LAPSED member is granted with nothing carried — they held nothing when the money landed', () => {
    expect(decideSettlement({ current: lapsed, paidTier: 'PLUS', today: TODAY })).toEqual({
      grant: true,
      carryOverDays: 0,
    })
  })

  it('a LEGACY member has no rank, so nothing can rank below them: granted, days carried', () => {
    expect(decideSettlement({ current: legacyUntil('2026-12-04'), paidTier: 'PLUS', today: TODAY })).toEqual({
      grant: true,
      carryOverDays: 100,
    })
  })
})

describe('remainingDays — no silent ceiling (ตู๋ ①)', () => {
  it('a 10-year span is counted in full, not truncated to a cap', () => {
    // 20ADMINMUMATE26 is a 10Y package sitting inactive. The previous implementation walked day by day and
    // returned 4000 on hitting its own limit, with no error and no log.
    expect(remainingDays('2026-08-26', '2036-08-26')).toBe(3653) // 10 years incl. leap days 2028/32/36
  })
  it('and a date that does not exist is refused rather than rolled over', () => {
    expect(remainingDays('2026-08-26', '2026-02-31')).toBe(0)
  })
})
