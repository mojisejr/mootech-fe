// features/v2-calendar/components/percent-display.ts — the ONE place a percent becomes text on screen.
//
// WHY THIS EXISTS (มุน 2026-08-05). Reviewing goo's #175 I flagged that ONE-NUMBER — which asserts the tile,
// the sentence and the ring all show the same figure — cannot catch a scale leak, because all three read the
// same `detail.percent`. If the source hands over 0.57 instead of 57, all three agree on 0.57 and the gate
// stays green. An agreement-invariant over same-source values cannot detect that source's error; catching it
// needs a check across a DIFFERENT layer. That check is PERCENT-SCALE, and this file is its screen half.
//
// ⚠️ IT IS NEEDED NOW, NOT LATER. The plan pinned PERCENT-SCALE to M-B on the reasoning that M-B is "the
// first time real numbers reach the user". Opening the code showed that is false: useCalendarMonth still
// serves mockCalendarMonth, and it is G-0c that swaps in the adapter — turning all 31 cells real at once,
// with no UI change required. So the door is G-0c, not M-B, and the guard belongs on the door.
//
// WHAT A LEAK LOOKS LIKE. bazi speaks 0–100 with decimals (40.83 · 61.67 · 80). A fraction leak arrives as
// 0.4083. Rounded for display that becomes "0%", which is not obviously broken — it reads as a genuinely
// terrible day. That is the dangerous shape of wrong: plausible, not absurd.
//
// TWO JOBS, KEPT APART ON PURPOSE:
//   percentText()      — formatting. ONE rounding site, so the tile, the sentence and the ring cannot round
//                        differently and produce 57 next to 58 on one card (the bug ฟีม's one-number ruling
//                        exists to prevent). Agreed with goo: the pipe normalises the unit and does NOT
//                        round; the screen rounds, once, here.
//   isPlausiblePercent — judgement. Never called during render: a screen that throws on bad data is worse
//                        than one that shows it. It is what the tests and the cross-layer anchor assert on.

/** the value the wire promises: a percentage on a 0–100 scale (decimals allowed). */
export const PERCENT_MIN = 0
export const PERCENT_MAX = 100

/**
 * Is this number actually on the 0–100 scale the UI assumes?
 *
 * The tell for a fraction leak is the open interval (0, 1): a real "day strength" of 0.4 percent does not
 * occur — the observed floor across real data is ~20 — while 0.4083 is exactly what an un-normalised
 * fraction looks like. 0 and 100 themselves stay legal, so a genuine zero is never called a leak.
 */
export function isPlausiblePercent(raw: unknown): raw is number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return false
  if (raw < PERCENT_MIN || raw > PERCENT_MAX) return false
  if (raw > 0 && raw < 1) return false // fraction leak: 0.4083 instead of 40.83
  return true
}

/**
 * The single rounding site. Returns the digits only — callers add the '%' so the glyph stays next to the
 * markup that positions it. An unusable value renders as an em dash rather than a confident wrong number:
 * "—" tells the user we do not know, "0%" tells them today is terrible.
 */
export function percentText(raw: unknown): string {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return '—'
  if (!isPlausiblePercent(raw)) return '—'
  return String(Math.round(raw))
}
