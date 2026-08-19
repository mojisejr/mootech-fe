// Mutant proof for the shared grade scale (lib/v2/grade-scale.ts) — M-C.
//
// DELIBERATELY in scripts/ and not harness/: the CI hard-gate runs scripts/*.test.ts and does NOT run
// harness/*. I learned that the expensive way on #179 — a harness anchor for the service hub had been RED
// for a week and nobody knew, because nothing runs it. Everything here is pure logic, so it can live where
// it will actually be enforced. The one invariant that genuinely needs a browser (the selected day cell
// must paint sapphire, not its tier tint) stays in harness/archive/run-calendar-month.ts (🗄️ archived by #321 — nothing runs it) and is named there.
//
// WHAT THIS PROVES
//   ZONE-MAP    — all 13 wire levels (lib/v2/api-grade.ts) land in the intended zone, nothing falls through.
//   NO-ORPHAN   — every ApiGrade is covered; a new wire level cannot silently vanish into a default.
//   SEPARABLE   — every PAIR of zones clears ΔE2000 ≥ 10 under normal vision, deuteranopia AND protanopia.
//                 Not just adjacent pairs: the facet list shows four grades at once and they are not sorted.
//   INK         — the dark-ink exception belongs to the ZONE (fair), not to the letter C+.
//
// TEETH
//   • mut-zone-drift    — #mut-zone-drift · move one grade to a neighbouring zone → ZONE-MAP trips.
//   • mut-unreadable    — #mut-unreadable · nudge a zone colour toward its neighbour → SEPARABLE trips.
//   • mut-ink-by-letter — #mut-ink-by-letter · key the dark ink off the letter C+ instead of the zone →
//                         INK trips for any other grade that ever joins `fair`.
//
// VERIFY-THE-INSTRUMENT: ΔE2000 is checked against a known pair first (black vs white must read ~100, and a
// colour against itself must read 0). A metric that cannot tell those apart would make every check vacuous.
import assert from 'node:assert'
import { API_GRADES } from '../lib/v2/api-grade'
import { gradeTier, TIER_COLOR, TIER_INK, TIER_SOFT, type GradeTier } from '../lib/v2/grade-scale'

let pass = 0
const ok = (name: string, cond: boolean, detail = '') => {
  assert.ok(cond, `FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  pass += 1
}

// ── colour maths (sRGB → Lab → ΔE2000) + colour-blind simulation (Viénot 1999) ──
const hex2rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toLin = (c: number): number => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
const toSrgb = (c: number): number => { const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255) }
function rgb2lab(rgb: number[]): number[] {
  const [R, G, B] = rgb.map(toLin)
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047)
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B)
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883)
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
}
function deltaE2000(l1: number[], l2: number[]): number {
  const [L1, a1, b1] = l1
  const [L2, a2, b2] = l2
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))))
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2)
  const hue = (x: number, y: number): number => { if (x === 0 && y === 0) return 0; const d = (Math.atan2(y, x) * 180) / Math.PI; return d < 0 ? d + 360 : d }
  const h1p = hue(a1p, b1), h2p = hue(a2p, b2)
  const dLp = L2 - L1, dCp = C2p - C1p
  const C12 = C1p * C2p
  let dhp = 0
  if (C12 !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360 }
  const dHp = 2 * Math.sqrt(C12) * Math.sin((dhp * Math.PI) / 360)
  const Lp = (L1 + L2) / 2, Cp = (C1p + C2p) / 2
  let hp = h1p + h2p
  if (C12 !== 0) hp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2
  const T = 1 - 0.17 * Math.cos(((hp - 30) * Math.PI) / 180) + 0.24 * Math.cos((2 * hp * Math.PI) / 180) + 0.32 * Math.cos(((3 * hp + 6) * Math.PI) / 180) - 0.2 * Math.cos(((4 * hp - 63) * Math.PI) / 180)
  const dTh = 30 * Math.exp(-Math.pow((hp - 275) / 25, 2))
  const Rc = 2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)))
  const Sl = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2))
  const Sc = 1 + 0.045 * Cp, Sh = 1 + 0.015 * Cp * T
  const Rt = -Math.sin((2 * dTh * Math.PI) / 180) * Rc
  return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh))
}
const RGB2LMS = [[0.31399022, 0.63951294, 0.04649755], [0.15537241, 0.75789446, 0.08670142], [0.01775239, 0.10944209, 0.87256922]]
const LMS2RGB = [[5.47221206, -4.6419601, 0.16963708], [-1.1252419, 2.29317094, -0.1678952], [0.02980165, -0.19318073, 1.16364789]]
const CVD: Record<string, number[][]> = {
  deuteranope: [[1, 0, 0], [0.494207, 0, 1.24827], [0, 0, 1]],
  protanope: [[0, 2.02344, -2.52581], [0, 1, 0], [0, 0, 1]],
}
const mul = (M: number[][], v: number[]): number[] => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])
const simulate = (rgb: number[], kind: string): number[] => mul(LMS2RGB, mul(CVD[kind], mul(RGB2LMS, rgb.map(toLin)))).map(toSrgb)
const dE = (h1: string, h2: string, kind?: string): number => {
  let a = hex2rgb(h1), b = hex2rgb(h2)
  if (kind) { a = simulate(a, kind); b = simulate(b, kind) }
  return deltaE2000(rgb2lab(a), rgb2lab(b))
}

// ── VERIFY-THE-INSTRUMENT — a metric that can't separate black from white proves nothing below ──
console.log('— instrument check (before trusting any number below) —')
ok('ΔE(black, white) reads ~100 (the metric is alive)', dE('#000000', '#FFFFFF') > 95, dE('#000000', '#FFFFFF').toFixed(1))
ok('ΔE(colour, itself) reads 0 (no phantom difference)', dE('#2E7D32', '#2E7D32') < 0.001)
ok('colour-blind sim actually changes a red/green pair', dE('#2E7D32', '#B71C1C') !== dE('#2E7D32', '#B71C1C', 'protanope'))

// ── ZONE-MAP + NO-ORPHAN — all 13 wire levels, nothing falls through ── #mut-zone-drift
console.log('\n— ZONE-MAP: every wire level lands in its intended zone —')
const EXPECT: Record<string, GradeTier> = {
  'A+': 'best', A: 'best', 'A-': 'best',
  'B+': 'good', B: 'good', 'B-': 'good',
  'C+': 'fair',
  C: 'weak', 'C-': 'weak',
  'D+': 'poor', D: 'poor', 'D-': 'poor', F: 'poor',
}
for (const g of API_GRADES) ok(`ZONE-MAP ${g} → ${EXPECT[g]}`, gradeTier(g) === EXPECT[g], `got ${gradeTier(g)}`)
ok('NO-ORPHAN: the expected map covers exactly the wire list', Object.keys(EXPECT).length === API_GRADES.length)
ok('unknown grade degrades to poor, never throws', gradeTier('Z!') === 'poor' && gradeTier(null) === 'weak' && gradeTier(undefined) === 'weak')

// ── SEPARABLE — every PAIR of zones, in every vision type ── #mut-unreadable
console.log('\n— SEPARABLE: every pair of zones, all three vision types (ΔE2000 ≥ 10) —')
const ZONES: GradeTier[] = ['best', 'good', 'fair', 'weak', 'poor']
const THRESHOLD = 10
let worst = { v: Infinity, label: '' }
for (let i = 0; i < ZONES.length; i++) {
  for (let j = i + 1; j < ZONES.length; j++) {
    const [z1, z2] = [ZONES[i], ZONES[j]]
    const vals = [dE(TIER_COLOR[z1], TIER_COLOR[z2]), dE(TIER_COLOR[z1], TIER_COLOR[z2], 'deuteranope'), dE(TIER_COLOR[z1], TIER_COLOR[z2], 'protanope')]
    const min = Math.min(...vals)
    if (min < worst.v) worst = { v: min, label: `${z1}↔${z2}` }
    ok(`SEPARABLE ${z1}↔${z2}`, min >= THRESHOLD, `worst-vision ΔE ${min.toFixed(1)}`)
  }
}
console.log(`  ↳ tightest pair overall: ${worst.label} = ΔE ${worst.v.toFixed(1)} (threshold ${THRESHOLD})`)

// ── INK — the dark-ink exception is a property of the ZONE, not of the letter ── #mut-ink-by-letter
console.log('\n— INK: the dark-ink exception belongs to the zone, not the letter —')
ok('fair zone uses dark ink', TIER_INK.fair === '#374151')
for (const z of ZONES) if (z !== 'fair') ok(`${z} zone uses white ink`, TIER_INK[z] === '#FFFFFF')
ok('C+ inherits dark ink through its ZONE (not a letter special-case)', TIER_INK[gradeTier('C+')] === '#374151')
ok('every zone has a soft ground', ZONES.every((z) => /^#[0-9A-F]{6}$/i.test(TIER_SOFT[z])))

console.log(`\n✅ grade-scale.test.ts — ${pass} assertions passed`)
