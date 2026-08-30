// features/v2-calendar/refusal-view.ts — "the server refused; which face does the screen wear".
//
// #529 (day route) and #530 (month route) are ONE behaviour split across two routes, and #530's own body
// records that doing them separately is how the two calendar gates drifted apart before #358 Phase 2. So
// the RULE lives here once, and both screens read the verdict rather than each re-deriving it.
//
// WHY A FUNCTION AND NOT A TERNARY IN THE PAGE — the same argument calendar-view-state.ts:5 makes for the
// month body, and it applies harder here: the branch that must never fire wrongly is an UPSELL. A ternary
// in JSX can only be checked by opening a browser as a walled user, which nobody will do again after the
// day this is written. Here CI can prove the mapping is total and that a genuine failure never reaches the
// sales branch.
import type { CalendarRefusalReason } from './hooks/fetch-month'

/** What the screen puts in front of the person. `null` = nothing special; render exactly as before. */
export type RefusalSurface =
  /** the package stops here → invite an upgrade (ฟีมเคาะ 2026-08-24) */
  | { kind: 'upgrade'; scope: 'month' | 'day' }
  /** we cannot tell who they are → the sign-in path, and NOT a sales pitch */
  | { kind: 'sign-in' }

/**
 * MONTH (#530). `refusal` is already narrowed to the two literals by fetch-month.ts:39 — an unrecognised
 * value became `undefined` there — so this maps the two the route can actually emit and nothing else.
 *
 * 🔴 `null` in ⇒ `null` out, and that is the load-bearing case, not the boring one. `month: null` has
 * always meant five different things (cursor resolving · anon · user errored · no birth profile · the
 * fetch failed) and every one of them still gets the neutral CalendarSkeleton face. Only a NAMED refusal
 * changes the screen. A `default:` that fell through to 'upgrade' would put a sales pitch in front of
 * somebody whose network just died.
 */
export function monthRefusalSurface(refusal: CalendarRefusalReason | null): RefusalSurface | null {
  if (refusal === 'out-of-span') return { kind: 'upgrade', scope: 'month' }
  if (refusal === 'no-identity') return { kind: 'sign-in' }
  return null
}

/** The four screens the day-detail body can be in. There is no fifth — see the test's TOTAL assertion. */
export type DayBodyState =
  /** a real day detail is in hand */
  | 'ready'
  /** the fetch is genuinely in flight — the spinner is telling the truth */
  | 'loading'
  /** #529 — this day is past what the package sells → invite an upgrade */
  | 'upgrade'
  /** settled, no detail, and NOT walled: a real failure, and it must read as one */
  | 'unavailable'

/** The minimum of the useDayDetail seam this rule needs — structural, so the test needs no DayDetail. */
export type DayBodyInput = {
  /** useDayDetail's `detail` */
  detail: unknown | null
  /** useDayDetail's `loading` */
  loading: boolean
  /** useDayDetail's `outOfSpan` (#529) */
  outOfSpan: boolean
}

/**
 * DAY (#529). ORDER IS THE DESIGN, so each step says why it sits where it does:
 *
 *  1. `outOfSpan` first — FAIL CLOSED. A response carrying both a detail and the wall flag is a
 *     contradiction that should not arise (the route answers `{ detail: null, outOfSpan: true }`), but if
 *     it ever does, painting the detail would serve paid content past the wall. Refusing to sell is
 *     recoverable; leaking what someone did not buy is not.
 *  2. `detail` before `loading` — the same call calendar-view-state.ts:41 makes: data already on screen
 *     must not be replaced by a placeholder for it.
 *  3. `loading` — the spinner, which from here on only appears when something really is coming.
 *  4. everything else — settled with nothing to show. THIS BRANCH IS NEW BEHAVIOUR AND IT IS THE POINT.
 *     Before this file, pages/v2/calendar/[date].tsx:188 tested `!detail` alone and returned the spinner,
 *     so a walled day AND a genuinely failed one both spun forever with nothing left to stop them. A
 *     permanent spinner is worse than a blank screen — calendar-view-state.ts:16 and CalendarSkeleton.tsx:9
 *     both say so in writing — because blank reads as broken and they leave, while a pulse reads as "any
 *     second now" and they wait. #529's DoD asks for a control proving a genuine failure still reads as a
 *     failure; that control cannot pass while the failure case is an eternal spinner.
 */
export function dayBodyState({ detail, loading, outOfSpan }: DayBodyInput): DayBodyState {
  if (outOfSpan) return 'upgrade'
  if (detail) return 'ready'
  return loading ? 'loading' : 'unavailable'
}
