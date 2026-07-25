# verify-evidence — Zone 1 daily-fortune (home)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` (ScoreRingCard, prop-driven) +
`harness/run-verdict-color.ts` (colour) + `harness/run-fortune-fidelity.ts` (data-binding/bounds/empty).

## capability → gate
The daily-fortune card is DATA-driven (goo's `useHomeFortune`). "Renders the fortune" is not one thing —
the cross-oracle adversary proved it is a bug-CLASS with ≥3 facets: (1) the ring COLOUR must reflect the
verdict; (2) the grade/pct must be BOUND to the data (not a fixed literal) and in [0,100]; (3) the facet
chips must not render bare. Each renders fine to console/AST but can lie to the user. Ground-truth = the
rendered surface (arc pixel hue + the glyphs on screen).

## invariant + anchor (two anchors, complementary facets)
- **colour** (`run-verdict-color.ts`): render each verdict @393, sample top-of-arc hue, assert
  good∈[150,210]° · neutral∈[40,90]° · caution∈[10,45]° and all three distinct.
- **fidelity** (`run-fortune-fidelity.ts`): read the RENDERED text (glyphs, not source/data-attrs) —
  every state renders its own grade/pct (data-bound + distinct), out-of-range pct clamps to ≤100, empty
  facets render a graceful "—".

## proof-of-teeth (executed, neg-control-first)
`run-verdict-color.ts`
| case | result |
|---|---|
| clean mapping | good **189°** · neutral **67°** · caution **24°** → each in-band + distinct ✓ |
| mutant `mut-verdict-collapse` (force one colour) | all → **213°** → not distinct → 🦷 CAUGHT |

`run-fortune-fidelity.ts` (widened after goo+too — each mutant is the exact hole an oracle exploited)
| case | result |
|---|---|
| neg-control clean | good **A/88** · neutral **C+/62** · caution **D/34** → data-bound + distinct ✓ |
| `mut=hardcode` (too — grade='A' pct=99, ignore data) | collapse + mismatch → 🦷 CAUGHT |
| unclamped 150% (goo รู1) | bounds gate rejects >100 → 🦷 CAUGHT · real overflow clamps to **100%** ✓ |
| blanked chip (goo รู2) | empty gate rejects zero-length → 🦷 CAUGHT · real empty renders **"—"** ✓ |

## completeness-pass (the visual state-space — enumerated, not one cell)
Zone-1 state-space rendered + verified @393 (overflowX=false, 0 console errors each):
`good · neutral · caution` (3 verdict colours) · `loading` (skeleton) · `empty` (graceful "ยังไม่มีข้อมูล") ·
`overflow` (pct=150 → clamps to 100%, ring full) · `empty-facet` (pct present, facets "" → chips "—").
Data-variants: long headline + long best/worst text (caution) wrap without overflow.
**Forcing-question answered**: no other viewport (320/430) or interaction state (calendar-link is kept-not-wired per ฟีม) left unverified for THIS zone; those are A2 (multi-viewport) / out-of-scope (skip).

ANCHOR: harness/run-verdict-color.ts#mut-verdict-collapse
ANCHOR: harness/run-fortune-fidelity.ts#mut=hardcode

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do NOT self-certify. Both goo (runtime/data) and too (static) attacked and
**converged on the same root**: my verdict-colour anchor saw ONE facet (hue); the bug-class has more.
- **too — the critical catch**: hardcoded `grade="A" pct={99}` sailed through the colour gate GREEN —
  colour is blind to DATA-binding. This is the owner-blind-to-own-bug-class shape the seam exists to catch.
- **goo — run-proven, 2 holes**: รู1 out-of-range pct (150) overflows the label the colour gate never
  reads; รู2 empty facets (`""`, not null) render a bare icon. (goo **DEFENDED** the verdict facet: he
  clamps verdict→good/neutral/caution at the BFF, so the hook can't emit an uncolourable value.)
- **reconcile** (cross-lens division, none self-certifies): **too**=no hardcoded literal in render path
  (static/AST) · **goo**=pct∈[0,100] + facets non-empty at source (`fortune-fields-complete`) · **me**=
  colour + data-binding/bounds/empty-fallback (component clamp + `—` fallback + `run-fortune-fidelity.ts`).
  The three lenses **compose** to cover the class — that is the completeness-pass for this zone.

## honest scope (Zone 1 only)
One zone (daily-fortune box) @393. Other zones + other viewports + the calendar-wire = out of this zone
(frozen, A2). Both anchors green + all teeth proven; goo's data-side anchor is the source-of-truth half.
