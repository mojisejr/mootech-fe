// harness/percent-crosscheck.ts — the CROSS-LAYER half of PERCENT-SCALE, as pure logic.
//
// The rule we agreed on (มุน→goo, #175): a scale leak cannot be caught by comparing the screen with itself.
// The tile, the sentence and the ring all read one `detail.percent`, so a leaked value appears in all three
// and they still agree. Catching it needs the API's number held against the painted glyph — two layers.
//
// WHY THE COMPARISON LIVES HERE AND NOT INSIDE THE BROWSER SCRIPT. A browser run can only exist in harness/,
// and CI does not run harness/ — the same trap that left the service hub unguarded for a week (#179) and the
// sapphire invariant unguarded since it was written. So the JUDGEMENT is a pure function that scripts/ can
// import and CI can enforce, and the browser script is reduced to a harvester: fetch one side, read the
// other, hand both to this.
//
//     this file                    → given API numbers and screen numbers, is the pair acceptable?  (CI)
//     harness/run-percent-scale.ts → go get the two sides from a live page                          (browser)
//
// ⚠️ TODAY THERE IS NO API SIDE TO HARVEST. useCalendarMonth and useDayDetail both still serve fixtures
// (mockCalendarMonth / mockDayDetail); G-0c is the change that swaps in the adapter. The harvester therefore
// ABORTS when it observes no API response rather than reporting a pass — an anchor that goes green because
// it found nothing to check is worse than no anchor, which is the lesson this whole file exists to encode.
// The judgement below is fully testable today regardless, and that is the half that can actually go wrong.

/** one day as the wire describes it. */
export type ApiPercent = { date: string; percent: number | null }
/** one day as the screen paints it — the DIGITS read off the glyph, e.g. "41" from "41%". */
export type ScreenPercent = { date: string; text: string }

export type CrossCheckIssue =
  | { kind: 'missing-on-screen'; date: string; api: number }
  | { kind: 'unexpected-on-screen'; date: string; text: string }
  | { kind: 'mismatch'; date: string; api: number; text: string; expected: string }
  | { kind: 'implausible-api'; date: string; api: number }

/**
 * Hold the two layers against each other.
 *
 * The comparison is `Math.round(api) === Number(text)`, which is deliberately the SAME rounding the screen
 * is supposed to have applied (percentText). Anything else — comparing raw to raw, or allowing a tolerance —
 * would let a scale leak through: 0.4083 and 41 are not "close", they are two different scales, and a
 * tolerance is exactly how that gets waved past.
 *
 * A null API percent is a legitimate "no score": the screen must show the em dash, not a number.
 */
export function crossCheckPercents(api: ApiPercent[], screen: ScreenPercent[]): CrossCheckIssue[] {
  const issues: CrossCheckIssue[] = []
  const byDate = new Map(screen.map((s) => [s.date, s.text]))

  for (const a of api) {
    const text = byDate.get(a.date)
    if (a.percent === null) {
      // no score → the screen must not invent one
      if (text !== undefined && text !== '—') issues.push({ kind: 'unexpected-on-screen', date: a.date, text })
      continue
    }
    // an API value off the 0–100 scale is a finding in its own right, before any comparison
    if (!Number.isFinite(a.percent) || a.percent < 0 || a.percent > 100 || (a.percent > 0 && a.percent < 1)) {
      issues.push({ kind: 'implausible-api', date: a.date, api: a.percent })
      continue
    }
    if (text === undefined) {
      issues.push({ kind: 'missing-on-screen', date: a.date, api: a.percent })
      continue
    }
    const expected = String(Math.round(a.percent))
    if (text !== expected) issues.push({ kind: 'mismatch', date: a.date, api: a.percent, text, expected })
  }

  // a day painted on screen that the wire never mentioned is fabricated data
  const apiDates = new Set(api.map((a) => a.date))
  for (const s of screen) if (!apiDates.has(s.date)) issues.push({ kind: 'unexpected-on-screen', date: s.date, text: s.text })

  return issues
}

/** true when the harvest is worth judging at all — see the ABORT note at the top of this file. */
export function harvestIsMeaningful(api: ApiPercent[], screen: ScreenPercent[]): boolean {
  return api.length > 0 && screen.length > 0
}
