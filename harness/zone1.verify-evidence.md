# verify-evidence — Zone 1 daily-fortune (home)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` (ScoreRingCard, prop-driven) +
`harness/run-verdict-color.ts`.

## capability → gate
The daily-fortune card is now DATA-driven (goo's `useHomeFortune`). A field can be wired-but-wrong —
most visually, the ring COLOUR must reflect the verdict (good=green / neutral=yellow / caution=orange).
A wrong/collapsed mapping renders fine to console/AST but lies to the user. Ground-truth = the arc pixel.

## invariant + anchor
The score ring's colour reflects the verdict AND the three verdicts are visually DISTINCT. Anchor:
render each verdict @393, sample the top-of-arc pixel hue, assert good∈[150,210]° · neutral∈[40,90]° ·
caution∈[10,45]° and all three distinct.

## proof-of-teeth (run-verdict-color.ts, executed)
| case | result |
|---|---|
| clean mapping | good **189°** · neutral **67°** · caution **24°** → each in-band + distinct ✓ |
| mutant `mut-verdict-collapse` (force one colour) | all → **213°** → not distinct → 🦷 CAUGHT |

## completeness-pass (the visual state-space — enumerated, not one cell)
Zone-1 state-space rendered + verified @393 (overflowX=false, 0 console errors each):
`good · neutral · caution` (3 verdict colours) · `loading` (skeleton) · `empty` (graceful "ยังไม่มีข้อมูล").
Data-variants exercised: long headline + long best/worst text (caution) wrap without overflow.
**Forcing-question answered**: no other viewport (320/430) or interaction state (calendar-link is kept-not-wired per ฟีม) left unverified for THIS zone; those are A2 (multi-viewport) / out-of-scope (skip).

ANCHOR: harness/run-verdict-color.ts#mut-verdict-collapse

## adversary sign-off
Cross-oracle, I do NOT self-certify. Dispatched to goo (runtime/data) + too (static):
- **goo** — a verdict value the hook can emit that the ring can't colour / a percent out of 0–100 / a
  best-worst that's null when fortune is present.
- **too** — a hardcoded value re-introduced into the card (regression of "no placeholder"); a state
  branch that renders blank.
- **PENDING** run-proven attempts (attach what was tried).

## honest scope (Zone 1 only)
One zone (daily-fortune box) @393. Other zones + other viewports + the calendar-wire = out of this zone
(frozen). Anchor covers verdict→colour; goo's `fortune-fields-complete` covers the data-side completeness.
