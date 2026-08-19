// Mutant proof for the selected-day-cell MODE (features/v2-calendar/components/day-cell-style.ts) — M-A.
//
// This exists because of a specific hole บอง found reviewing M-C: the rule "the selected cell paints
// sapphire, not its tier tint" is what licenses the calendar grid and the grade badge to use different
// colour languages at all (DESIGN.md §GRADE). It was enforced only by harness/archive/run-calendar-month.ts (🗄️ archived by #321 — nothing runs it) — and
// NOTHING ran that file. So the load-bearing invariant of a shipped design decision had no live guard.
//
// In scripts/, not harness/, on purpose: CI runs scripts/*.test.ts. Same reasoning as scripts/grade-scale.test.ts.
//
// WHAT THIS PROVES
//   SELECTED-MODE  — when selected, EVERY painted value comes from the sapphire set. Not "the background
//                    is sapphire" — all four, because a half-applied mode is dark ink on a sapphire fill.
//   TIER-RESPECTED — when NOT selected, the background and the percent follow the cell's tier.
//   NO-BLEED       — the sapphire values never leak into an unselected cell.
//   TOTAL          — all three tiers are covered in both states; no tier falls through.
//
// TEETH
//   • mut-selected-tint   — #mut-selected-tint · let the selected cell keep its tier tint → SELECTED-MODE
//                           trips. THIS IS THE ONE THE DESIGN ARGUMENT RESTS ON.
//   • mut-half-mode       — #mut-half-mode · flip the background but leave one text colour behind →
//                           SELECTED-MODE trips on that value alone (the bug a bg-only check cannot see).
//   • mut-tier-ignored    — #mut-tier-ignored · return a fixed tint for unselected cells → TIER-RESPECTED trips.
//
// VERIFY-THE-INSTRUMENT: the three tiers must not already share a tint, or TIER-RESPECTED would pass no
// matter what the function returned. That is asserted first, before any tier-dependent claim is trusted.
import assert from 'node:assert'
import { dayCellStyle } from '../features/v2-calendar/components/day-cell-style'
import { DAY_CELL_COLORS, SELECTED } from '../features/v2-calendar/components/grade-colors'
import type { DayCellTier } from '../features/v2-calendar/types'

let pass = 0
const ok = (name: string, cond: boolean, detail = '') => {
  assert.ok(cond, `FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  pass += 1
}

const TIERS: DayCellTier[] = ['good', 'medium', 'bad']

// ── VERIFY-THE-INSTRUMENT — if the tiers already looked alike, TIER-RESPECTED would be vacuous ──
console.log('— instrument check —')
const tints = TIERS.map((t) => DAY_CELL_COLORS[t].tint)
ok('the three tiers have distinct tints (else TIER-RESPECTED proves nothing)', new Set(tints).size === 3, tints.join(' '))
ok('sapphire fill differs from every tier tint (else SELECTED-MODE proves nothing)', !tints.includes(SELECTED.fill), SELECTED.fill)

// ── SELECTED-MODE — every value, not just the background ── #mut-selected-tint #mut-half-mode
console.log('\n— SELECTED-MODE: selected ⇒ every painted value is sapphire —')
for (const tier of TIERS) {
  const s = dayCellStyle(tier, true)
  ok(`[${tier}] selected bg is the sapphire fill`, s.bg === SELECTED.fill, s.bg)
  ok(`[${tier}] selected day number is sapphire ink`, s.dayText === SELECTED.text, s.dayText)
  ok(`[${tier}] selected 干支 is sapphire ink`, s.ganzhiText === SELECTED.text, s.ganzhiText)
  ok(`[${tier}] selected percent is sapphire ink`, s.pctText === SELECTED.text, s.pctText)
  // the half-applied case stated directly: NOTHING may still be carrying the tier
  ok(`[${tier}] no tier value survives selection`, ![s.bg, s.dayText, s.ganzhiText, s.pctText].some((v) => v === DAY_CELL_COLORS[tier].tint || v === DAY_CELL_COLORS[tier].text))
}
// the selected style must be the SAME whatever the tier — selection overrides, it does not blend
const selectedStyles = TIERS.map((t) => JSON.stringify(dayCellStyle(t, true)))
ok('SELECTED-MODE is identical across all tiers (selection overrides, never blends)', new Set(selectedStyles).size === 1)

// ── TIER-RESPECTED + NO-BLEED — unselected cells follow their tier and never borrow sapphire ── #mut-tier-ignored
console.log('\n— TIER-RESPECTED: unselected ⇒ background and percent follow the tier —')
for (const tier of TIERS) {
  const s = dayCellStyle(tier, false)
  ok(`[${tier}] unselected bg is the tier tint`, s.bg === DAY_CELL_COLORS[tier].tint, s.bg)
  ok(`[${tier}] unselected percent is the tier text`, s.pctText === DAY_CELL_COLORS[tier].text, s.pctText)
  // NO-BLEED, stated precisely. The first version of this assertion banned SELECTED.fill from ANY value and
  // failed immediately — because the resting 干支 ink IS #1455A4, the same sapphire as the selection fill.
  // That is not bleed, it is one hue doing two jobs, and banning it would have been the instrument being
  // wrong rather than the code. What actually must never happen: an unselected cell taking the sapphire
  // GROUND (it would read as selected) or the white ink (invisible on a pale tint).
  ok(`[${tier}] NO-BLEED: an unselected cell never takes the sapphire ground`, s.bg !== SELECTED.fill, s.bg)
  ok(`[${tier}] NO-BLEED: no white ink on a pale tint`, ![s.dayText, s.ganzhiText, s.pctText].some((v) => v === SELECTED.text))
}
// distinct tiers must stay distinguishable when unselected — the grid is a comparison surface
const restingBgs = TIERS.map((t) => dayCellStyle(t, false).bg)
ok('TOTAL: the three unselected tiers still paint three different backgrounds', new Set(restingBgs).size === 3, restingBgs.join(' '))

console.log(`\n✅ day-cell-style.test.ts — ${pass} assertions passed`)
