// Mutant proof for the calendar body's three-screen rule (features/v2-calendar/components/calendar-view-state.ts).
//
// The bug this exists to stop is not hypothetical and not new: a skeleton that never resolves. goo's seam
// settles with `{month: null, loading: false}` for an anon user, a failed user row, and — the common one —
// an account with no birth date. Every one of those reads `!month`, so the natural `if (!month) <Skeleton/>`
// pulses at them forever. ตู๋ already caught this shape once on the home screen.
//
// In scripts/, not harness/, on purpose: CI runs scripts/*.test.ts. Same reasoning as day-cell-style.test.ts.
//
// WHAT THIS PROVES
//   NO-DEAD-SKELETON — nothing that has finished loading may render as 'loading'. This is the whole point.
//   NO-PREMATURE-EMPTY — the reverse error: telling someone "nothing to show" while the fetch is in flight.
//   READY-WINS       — a month in hand always paints, so a refetch can never blank a painted screen.
//   TOTAL            — the input space here is exactly 2×2, so it is ENUMERATED, not sampled. Every cell is
//                      asserted and every returned value is one of the three declared states.
//
// TEETH
//   • mut-skeleton-on-null   — #mut-skeleton-on-null · `if (!month) return 'loading'` → NO-DEAD-SKELETON
//                              trips on the settled-empty cell. THIS IS THE SHIPPED BUG SHAPE.
//   • mut-empty-while-loading— #mut-empty-while-loading · `if (!month) return 'unavailable'` → NO-PREMATURE-
//                              EMPTY trips: a user waiting on a fetch is told there is nothing.
//   • mut-loading-wins       — #mut-loading-wins · check `loading` before `month` → READY-WINS trips when a
//                              refetch holds the old month (a painted screen collapsing to a placeholder).
//
// VERIFY-THE-INSTRUMENT: the three states must be three DIFFERENT strings, or every assertion below is
// vacuously satisfiable. Asserted first, before any behavioural claim is trusted.
import assert from 'node:assert'
import { calendarViewState, type CalendarViewState } from '../features/v2-calendar/components/calendar-view-state'

let pass = 0
const ok = (name: string, cond: boolean, detail = '') => {
  assert.ok(cond, `FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  pass += 1
}

const STATES: CalendarViewState[] = ['loading', 'unavailable', 'ready']
const MONTH = { year: 2026, month: 8, days: [], weeks: [] } // any truthy month-shaped value

// ── VERIFY-THE-INSTRUMENT ──
console.log('— instrument check —')
ok('the three states are three distinct strings (else every assertion below is vacuous)', new Set(STATES).size === 3, STATES.join(' '))

// ── TOTAL — the input space is 2×2, so enumerate it. Nothing here is a spot check. ──
console.log('\n— TOTAL: all four (month × loading) cells —')
const CELLS: { month: unknown | null; loading: boolean; expect: CalendarViewState; why: string }[] = [
  { month: null, loading: true, expect: 'loading', why: 'cursor/fetch in flight — the month is coming' },
  { month: null, loading: false, expect: 'unavailable', why: 'anon · user errored · no birth date — settled, nothing coming' },
  { month: MONTH, loading: false, expect: 'ready', why: 'the month arrived' },
  { month: MONTH, loading: true, expect: 'ready', why: 'refetch holding the old month — never blank a painted screen' },
]
for (const c of CELLS) {
  const got = calendarViewState({ month: c.month, loading: c.loading })
  ok(`[month=${c.month ? 'yes' : 'null'} loading=${c.loading}] → ${c.expect} (${c.why})`, got === c.expect, got)
  ok(`[month=${c.month ? 'yes' : 'null'} loading=${c.loading}] returns a declared state`, STATES.includes(got), got)
}

// ── NO-DEAD-SKELETON — the assertion this file exists for ── #mut-skeleton-on-null
console.log('\n— NO-DEAD-SKELETON: finished loading ⇒ never a skeleton —')
for (const month of [null, MONTH]) {
  const got = calendarViewState({ month, loading: false })
  ok(`[month=${month ? 'yes' : 'null'}] settled input never renders as 'loading'`, got !== 'loading', got)
}
// stated the other way round too, because this is the invariant and not a coincidence of the table above:
// a user with no birth date sits in EXACTLY this cell, and a skeleton there pulses at them forever.
ok("the no-birth-date user (null, settled) gets 'unavailable', not a forever-skeleton", calendarViewState({ month: null, loading: false }) === 'unavailable')

// ── NO-PREMATURE-EMPTY — the mirror error ── #mut-empty-while-loading
console.log('\n— NO-PREMATURE-EMPTY: still loading ⇒ never "nothing to show" —')
ok("an in-flight fetch is never reported as 'unavailable'", calendarViewState({ month: null, loading: true }) !== 'unavailable')

// ── READY-WINS — a month in hand always paints ── #mut-loading-wins
console.log('\n— READY-WINS: a month in hand always paints —')
for (const loading of [true, false]) {
  ok(`[loading=${loading}] a month in hand paints`, calendarViewState({ month: MONTH, loading }) === 'ready')
}

console.log(`\n✅ calendar-view-state.test.ts — ${pass} assertions passed`)
