// Unit gate for mockDayDetail's date identity (goo · G-0b). Plain tsx + node:assert (ci `scripts/*.test.ts`).
//
// ANCHOR: scripts/mock-day-detail.test.ts#g0b-day-detail-requested-date
// Bug-class this owns: SILENT WRONG-DAY. mockDayDetail used to `?? MOCK_DAYS[13]` (the fixed July fixture's
// 14th) for any date not in July, and RETURNED that day's date. Once the calendar cursor resolves the
// CURRENT month (G-0b), selecting 2026-08-05 → mockDayDetail('2026-08-05') → not in July → returned "14
// กรกฎาคม" while the user picked 5 สิงหาคม — the card shows the wrong day with NO error (worse than a crash).
// The fix generates from the requested date's own month; the returned `date` must always equal the input.
import assert from 'node:assert'
import { mockDayDetail } from '../features/v2-calendar/fixtures'

let pass = 0
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

// The exact case บอง caught: an August date (outside the fixed July fixture) must return itself, not July 14.
const aug = mockDayDetail('2026-08-05')
ok('August date returns ITS OWN date, not July 14', aug.date === '2026-08-05')
ok('August date returns its own day-of-month (5)', aug.day === 5)
ok('August detail is not the July-14 fixture (day ≠ 14 unless asked)', aug.day !== 14)

// A December date in a leap-ish far month — still itself.
const dec = mockDayDetail('2027-12-31')
ok('far-month date returns itself', dec.date === '2027-12-31' && dec.day === 31)

// A July date (inside the original fixture) still works — no regression.
const jul = mockDayDetail('2026-07-10')
ok('July date still returns itself', jul.date === '2026-07-10' && jul.day === 10)

// Genuinely asking for the 14th returns the 14th (not a coincidence of the old fallback).
const the14th = mockDayDetail('2026-08-14')
ok('asking for the 14th returns the 14th of the asked month', the14th.date === '2026-08-14' && the14th.day === 14)

// Malformed / empty date (the page's pre-mount placeholder) must not crash and must not borrow another day.
const empty = mockDayDetail('')
ok('empty date does not crash and does not claim another day', empty.date === '')

// The detail is internally consistent (yams present, facet lists present) regardless of month.
ok('detail carries yams + suitable/avoid for any month', aug.yams.length > 0 && aug.suitable.length > 0 && aug.avoid.length > 0)

console.log(`✅ mock-day-detail.test.ts — ${pass} assertions passed`)
