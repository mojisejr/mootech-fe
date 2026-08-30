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
 *  0. 🔑 THE ORDER BELOW IS UNCONDITIONALLY SAFE, AND IT WAS NOT ALWAYS. Recorded because the thing that
 *     made it conditional is gone, and a later reader has no way to discover that it was ever load-bearing.
 *     Until mootech-fe#533 `0f23974`, `outOfSpan` before `loading` only differed from the reverse in the
 *     state `loading && outOfSpan`, which nothing prevented — it merely never happened, because
 *     useDayDetail cleared the flag before every fetch. That was a promise living in a different file from
 *     the code leaning on it, and ตู๋ measured that breaking it stayed green in all three lanes. `0f23974`
 *     stamps the date into the hook's own state and reads a mismatch as `loading` there, which deletes the
 *     promise rather than documenting it. The order below now holds on its own.
 *
 *  1. `outOfSpan` first — FAIL CLOSED. A response carrying both a detail and the wall flag is a
 *     contradiction that should not arise (the route answers `{ detail: null, outOfSpan: true }`), but if
 *     it ever does, painting the detail would serve paid content past the wall. Refusing to sell is
 *     recoverable; leaking what someone did not buy is not.
 *  2. `detail` before `loading` — the same call calendar-view-state.ts:41 makes: data already on screen
 *     must not be replaced by a placeholder for it.
 *  3. `loading` — the spinner, which from here on only appears when something really is coming.
 *  🗄️ THIS RULE BRIEFLY TOOK A FOURTH INPUT, `identityResolved`, AND IT IS GONE ON PURPOSE.
 *     useDayDetail used to answer `{detail: null, loading: false}` for BOTH "the user row has not arrived"
 *     and "it arrived with no birthday", so this file guessed the difference from `isPaid !== null` and
 *     refused to say 'unavailable' while it looked unsettled. Measured in a browser, that guard cut the
 *     wrong-word window from 1560ms to 37ms and could not close it — `isPaid` settles before the row lands.
 *     mootech-fe#533 `9fa30dc` split the branch at the source instead, and the same trace now reads
 *     `loading → upgrade` with the guard and WITHOUT it, identically. A parameter that changes no
 *     measurement is not caution, it is a cross-file guess about another hook's timing, kept alive by
 *     nothing. The teeth that hold the real rule live where the branch does — the case named "while the
 *     user row is in flight the hook says LOADING" in scripts/calendar-refusal-reaches-screen.test.tsx,
 *     verified here by reverting that branch and watching 4 tests go red.
 *
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
