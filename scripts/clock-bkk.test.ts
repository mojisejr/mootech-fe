// #358 Phase 3 — the origin every span is measured from, guarded.
//
// ANCHOR: scripts/clock-bkk.test.ts#current-month-is-bangkok-not-utc
// 🔴 THE BUG-CLASS THIS OWNS, and it is the reason the file exists at all. lib/v2/clock.ts shipped with
// FIVE specs importing the routes that use it, and every one of them mocks it — correctly, because they
// need a fixed "now". ตู๋ measured what that left behind: he replaced bkkDateStr with toISOString inside
// clock.ts and ran the whole lane. 1083 passed, rc=0, nothing moved. The function that decides which month
// "this month" is, which is the origin of every span comparison in the product, had nothing watching it.
//
// 🔴 THE WINDOW IT BITES IS REAL AND RECURS MONTHLY: the 1st of the month, between midnight and 07:00 in
// Thailand, UTC is still the previous month. A FREE member — whose entire entitlement is "the current
// month" — would be refused their own month for seven hours, once a month, and only in Thailand's morning.
// It is the shape that never shows up in a demo.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   Fired 2026-08-29 with a `git diff --numstat` guard. Measured, and ③ is not what I predicted:
//   MK1  currentMonthBkk uses toISOString().slice(0,7) instead of bkkDateStr  → ② ⑤   (2 of 5)
//        ③ stays GREEN and that is correct — at 23:30 Bangkok, UTC is 16:30 the SAME day, so both
//        readings agree. Only the hours after midnight Bangkok split them, which is exactly the window
//        the header describes. ③ earns its place by ruling out "always answer the next month", not by
//        catching MK1.
//   MK2  the slice takes (0,4)                                                → all five (5 of 5)
import { describe, it, expect } from 'vitest'
import { currentMonthBkk } from '@/lib/v2/clock'

describe('#358 currentMonthBkk — Asia/Bangkok, not the server clock', () => {
  it('① answers a bare YYYY-MM', () => {
    expect(currentMonthBkk(new Date('2026-08-15T05:00:00Z'))).toMatch(/^\d{4}-\d{2}$/)
  })

  // ② 🔴 MK1 — the seven hours that decide a FREE member's whole entitlement.
  it('🔴 ② at 00:30 on the 1st in Bangkok, the month is the NEW one even though UTC says the old one', () => {
    // 2026-08-31T17:30:00Z is 2026-09-01 00:30 in Bangkok.
    const instant = new Date('2026-08-31T17:30:00Z')
    expect(instant.toISOString().slice(0, 7), 'UTC still says August — this is the trap').toBe('2026-08')
    expect(currentMonthBkk(instant), 'Bangkok says September, and Bangkok is who we sell to').toBe('2026-09')
  })

  // ③ the mirror, so ② cannot pass by always answering "the next month".
  it('🔴 ③ at 23:30 on the last day in Bangkok, the month is still the OLD one', () => {
    // 2026-08-31T16:30:00Z is 2026-08-31 23:30 in Bangkok.
    const instant = new Date('2026-08-31T16:30:00Z')
    expect(currentMonthBkk(instant)).toBe('2026-08')
  })

  // ④ CONTROL — a plain midday instant, where UTC and Bangkok agree. If this ever disagreed with ② and ③
  // the helper would be shifting every date rather than handling the boundary.
  it('④ CONTROL — midday agrees with UTC, so ② and ③ are about the boundary and not a blanket shift', () => {
    const instant = new Date('2026-08-15T06:00:00Z')
    expect(currentMonthBkk(instant)).toBe('2026-08')
    expect(instant.toISOString().slice(0, 7)).toBe('2026-08')
  })

  it('⑤ crosses a YEAR boundary the same way', () => {
    expect(currentMonthBkk(new Date('2026-12-31T17:30:00Z')), 'Bangkok is already January').toBe('2027-01')
  })
})
