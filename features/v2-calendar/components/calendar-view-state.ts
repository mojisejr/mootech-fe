// features/v2-calendar/components/calendar-view-state.ts — "which of the three screens does the calendar
// body show right now": the skeleton, the nothing-to-show notice, or the real thing.
//
// WHY THIS IS A FUNCTION AND NOT A TERNARY IN THE PAGE. goo's useCalendarMonth (the seam บอง locked
// 2026-08-05) resolves EVERY branch, and three of them settle with no month at all:
//
//     anon                    → { month: null, loading: false }
//     user row errored        → { month: null, loading: false }
//     birth profile incomplete→ { month: null, loading: false }
//     cursor / fetch in flight→ { month: null, loading: true  }
//
// So `!month` is NOT "still loading". Reading it as one — which the obvious `if (!month) return <Skeleton/>`
// does — ships a skeleton that pulses forever for anyone without a birth date. That is the exact bug ตู๋
// caught on the home screen (see pages/v2/home-preview.tsx: "no loading: element comes from settled
// compute — too's dead-skeleton catch"), and it is strictly WORSE than the `return null` it replaces:
// a blank screen reads as broken, a permanent skeleton reads as "any second now" and the user waits.
//
// Putting the rule here means CI can prove that "settled" and "skeleton" can never be the same state
// (scripts/calendar-view-state.test.ts). A ternary in JSX could only ever be checked by opening a browser
// with a birth-date-less account, which nobody will do again after the day this is written.
//
// ⚠️ KNOWN GAP, PARTLY CLOSED 2026-08-30 — read both halves before trusting either.
// STILL TRUE HERE: the three settled-empty causes (anon · user-row errored · no birth profile) remain
// INDISTINGUISHABLE at this seam — all three are `{month: null, loading: false}`. So `unavailable` still
// says the calendar has nothing to show and not WHY, and writing "กรุณากรอกวันเกิด" here would still be
// asserting a cause this layer cannot see.
// NO LONGER TRUE: that NOTHING can say why. #533 widened the route and the hook with a named `refusal`
// (#530), and the two causes it names never reach this function any more — pages/v2/calendar.tsx routes
// them to CalendarRefusalCard through refusal-view.ts before the skeleton is considered. The widening
// this comment asked for happened; what is left is the three above, which no field names yet.

/** The three screens the calendar body can be in. There is no fourth — see the test's TOTAL assertion. */
export type CalendarViewState =
  /** the month is on its way — pulse, reserve the space, promise nothing */
  | 'loading'
  /** settled, and there is no month to draw. NOT a skeleton: nothing more is coming on its own */
  | 'unavailable'
  /** a real month is in hand */
  | 'ready'

/** The minimum of goo's seam this rule needs. Deliberately structural, so the test needs no CalendarMonth. */
export type CalendarViewInput = {
  /** goo's `month` — null until it resolves, and null forever in the three settled-empty branches */
  month: unknown | null
  /** goo's `loading` */
  loading: boolean
}

/**
 * `month` is checked FIRST, on purpose. goo clears the old month before every fetch, so
 * `{month: <something>, loading: true}` does not arise today — but if a later refetch ever keeps the old
 * month while loading, this order shows the real (if stale) month instead of blanking a painted screen
 * back to a skeleton. Data already on screen must not be replaced by a placeholder for it.
 */
export function calendarViewState({ month, loading }: CalendarViewInput): CalendarViewState {
  if (month) return 'ready'
  return loading ? 'loading' : 'unavailable'
}
