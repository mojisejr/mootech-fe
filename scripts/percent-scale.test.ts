// PERCENT-SCALE — the guard that ONE-NUMBER structurally cannot be (มุน 2026-08-05).
//
// ONE-NUMBER asserts the tile, the sentence and the ring show the same figure. All three read the same
// `detail.percent`, so a scale leak at the source appears in all three at once, they still agree, and the
// gate stays green. I proved that live on #175: onePercentAgree('0.57%','0.57%','0.57%') === true. An
// agreement-invariant over same-source values cannot detect that source's error — by construction.
//
// So this checks a DIFFERENT axis: is the number even on the scale the screen assumes? That is a question
// about the value itself, not about whether two renders of it match, which is why it can catch what the
// other cannot.
//
// In scripts/, not harness/, because CI runs scripts/*.test.ts. The other half of PERCENT-SCALE — the true
// cross-layer comparison of the API's number against the painted glyph — needs a browser and lives in
// harness/archive/run-percent-scale.ts (🗄️ archived by #321 — run by hand only); its raw output is attached to the PR.
//
// WHAT THIS PROVES
//   SCALE-GUARD  — a 0–1 fraction is rejected, and specifically NOT rounded into a plausible-looking "0".
//   REAL-VALUES  — every percent observed in real bazi payloads is accepted (no false alarms on live data).
//   ONE-ROUNDING — percentText is the only rounding site, and it is deterministic: the same input can never
//                  produce two different strings, which is what keeps 57 from appearing beside 58.
//   HONEST-GAP   — an unusable value renders as "—", never as a confident wrong number.
//
// TEETH
//   • mut-fraction-passes — #mut-fraction-passes · accept the (0,1) interval → SCALE-GUARD trips. THIS is
//                           the leak ONE-NUMBER waves through; it is the whole reason this file exists.
//   • mut-round-fraction  — #mut-round-fraction · format an implausible value instead of returning "—" →
//                           HONEST-GAP trips: 0.4083 would render "0%", a plausible-looking terrible day.
//   • mut-floor-not-round — #mut-floor-not-round · floor instead of round → ONE-ROUNDING trips on the .5 case.
//
// VERIFY-THE-INSTRUMENT: a guard that rejected everything would pass SCALE-GUARD vacuously, so REAL-VALUES
// runs first on percentages taken from real man-vs-day responses. If the guard cannot accept live data, the
// rejections below prove nothing.
import assert from 'node:assert'
import { isPlausiblePercent, percentText } from '../features/v2-calendar/components/percent-display'
import { crossCheckPercents, harvestIsMeaningful } from './_helpers/percent-crosscheck'

let pass = 0
const ok = (name: string, cond: boolean, detail = '') => {
  assert.ok(cond, `FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  pass += 1
}

// ── VERIFY-THE-INSTRUMENT — real values first, or every rejection below is vacuous ──
// Sampled from live man-vs-day responses (2 people × 13 days, 2026-08): day totals and facet percents.
const REAL = [20.84, 33.33, 42, 43.33, 50, 52.92, 53.33, 55, 58.33, 65, 67.91, 68.33, 75, 80, 85, 88.34, 90, 93.33, 95, 96.67]
console.log('— instrument check: the guard must accept real data —')
for (const v of REAL) ok(`REAL-VALUES accepts ${v}`, isPlausiblePercent(v))
ok('REAL-VALUES: the boundaries are legal too (0 and 100)', isPlausiblePercent(0) && isPlausiblePercent(100))

// ── SCALE-GUARD — the leak ONE-NUMBER cannot see ── #mut-fraction-passes
console.log('\n— SCALE-GUARD: a 0–1 fraction is not a percentage —')
const FRACTIONS = [0.4083, 0.57, 0.6167, 0.8, 0.999, 0.01]
for (const v of FRACTIONS) ok(`SCALE-GUARD rejects ${v} (fraction leak)`, !isPlausiblePercent(v))
ok('SCALE-GUARD rejects out-of-range', !isPlausiblePercent(-1) && !isPlausiblePercent(101))
ok('SCALE-GUARD rejects non-numbers', !isPlausiblePercent(NaN) && !isPlausiblePercent('57' as unknown) && !isPlausiblePercent(null))

// the whole point, stated as the pair that ONE-NUMBER conflates:
ok('the SAME reading at two scales is distinguishable here (40.83 ok · 0.4083 not)', isPlausiblePercent(40.83) && !isPlausiblePercent(0.4083))

// ── HONEST-GAP — an unusable value must not become a confident wrong number ── #mut-round-fraction
console.log('\n— HONEST-GAP: unusable renders as "—", never as a plausible wrong number —')
for (const v of FRACTIONS) ok(`HONEST-GAP ${v} → "—" (NOT "0")`, percentText(v) === '—', percentText(v))
ok('HONEST-GAP: null/NaN → "—"', percentText(null) === '—' && percentText(NaN) === '—')
ok('HONEST-GAP: a real 0 still prints "0", it is a legal score', percentText(0) === '0')

// ── ONE-ROUNDING — one site, deterministic ── #mut-floor-not-round
console.log('\n— ONE-ROUNDING: one site, same input can never give two strings —')
ok('rounds to nearest: 61.67 → 62', percentText(61.67) === '62', percentText(61.67))
ok('rounds to nearest: 40.83 → 41', percentText(40.83) === '41', percentText(40.83))
ok('rounds .5 up, not down: 57.5 → 58', percentText(57.5) === '58', percentText(57.5))
ok('integers pass through: 80 → 80', percentText(80) === '80')
for (const v of REAL) ok(`ONE-ROUNDING deterministic for ${v}`, percentText(v) === percentText(v))

// ── CROSS-LAYER — the half ONE-NUMBER structurally cannot do ── #mut-tolerance #mut-empty-passes
console.log('\n— CROSS-LAYER: the API number held against the painted glyph —')
const API = [{ date: '2026-08-02', percent: 80 }, { date: '2026-08-07', percent: 67.91 }, { date: '2026-08-14', percent: 65 }]
const GOOD = [{ date: '2026-08-02', text: '80' }, { date: '2026-08-07', text: '68' }, { date: '2026-08-14', text: '65' }]
ok('CROSS-LAYER clean when the screen rounds the API value exactly', crossCheckPercents(API, GOOD).length === 0, JSON.stringify(crossCheckPercents(API, GOOD)))

// the leak, stated across layers: the API says 80, the screen says 0.8 rounded to 1
const LEAKED = [{ date: '2026-08-02', text: '1' }, { date: '2026-08-07', text: '68' }, { date: '2026-08-14', text: '65' }]
const leakIssues = crossCheckPercents(API, LEAKED)
ok('CROSS-LAYER catches a scale leak the screen alone cannot see', leakIssues.some((i) => i.kind === 'mismatch' && i.date === '2026-08-02'), JSON.stringify(leakIssues))

// OFF-BY-ONE. The dramatic leak above is not enough: a tolerance would still flag 80-vs-1. What a tolerance
// actually hides is the SMALL wrong number — the screen flooring 67.91 to "67" when it should round to "68".
// That is the same bug as 57 sitting next to 58 on one card, which is what ฟีม's one-number ruling exists to
// prevent, and it is invisible to any comparison that allows slack. Adding it here because the mut-tolerance
// tooth did NOT bite on the first version of this file: my assertions covered the loud failure and not the
// quiet one, so a mutant that only loosens the comparison sailed through.
const FLOORED = [{ date: '2026-08-02', text: '80' }, { date: '2026-08-07', text: '67' }, { date: '2026-08-14', text: '65' }]
const floorIssues = crossCheckPercents(API, FLOORED)
ok('CROSS-LAYER catches an OFF-BY-ONE (67 where 67.91 must round to 68)', floorIssues.some((i) => i.kind === 'mismatch' && i.date === '2026-08-07'), JSON.stringify(floorIssues))

// an API value that is itself off-scale is a finding before any comparison happens
ok('CROSS-LAYER flags an implausible API value', crossCheckPercents([{ date: 'd', percent: 0.4083 }], [{ date: 'd', text: '0' }]).some((i) => i.kind === 'implausible-api'))
ok('CROSS-LAYER flags a day the screen invented', crossCheckPercents([], [{ date: 'ghost', text: '99' }]).some((i) => i.kind === 'unexpected-on-screen'))
ok('CROSS-LAYER flags a day the screen dropped', crossCheckPercents([{ date: 'd', percent: 55 }], []).some((i) => i.kind === 'missing-on-screen'))
ok('CROSS-LAYER: a null score must render the em dash, not a number', crossCheckPercents([{ date: 'd', percent: null }], [{ date: 'd', text: '0' }]).some((i) => i.kind === 'unexpected-on-screen'))
ok('CROSS-LAYER: a null score WITH the em dash is clean', crossCheckPercents([{ date: 'd', percent: null }], [{ date: 'd', text: '—' }]).length === 0)

// ── the guard that stops this anchor from ever going green on nothing ──
console.log('\n— ABORT-ON-EMPTY: an empty harvest is not a pass —')
ok('ABORT-ON-EMPTY: no API side ⇒ not meaningful', !harvestIsMeaningful([], GOOD))
ok('ABORT-ON-EMPTY: no screen side ⇒ not meaningful', !harvestIsMeaningful(API, []))
ok('ABORT-ON-EMPTY: both sides present ⇒ meaningful', harvestIsMeaningful(API, GOOD))
// stated plainly: an empty comparison reports zero issues, which is exactly why it must never count as a pass
ok('an empty comparison finds nothing — the reason ABORT-ON-EMPTY exists', crossCheckPercents([], []).length === 0)

console.log(`\n✅ percent-scale.test.ts — ${pass} assertions passed`)
