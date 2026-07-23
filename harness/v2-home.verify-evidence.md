# verify-evidence — v2 home shell (slice-2, scope B)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` + `harness/run-bg-continuity.ts`.

## capability → gate
Composing a long scrolling screen (~1892px) that layers a hero photo over the page background can leave
a **visible BG seam/break** where the image ends — ฟีม's headline requirement is that the BG is
CONTINUOUS. No other lens sees this (it renders fine to console/AST; CLS/computed don't measure a hard
visual seam). Ground-truth = the rendered image.

## invariant + anchor
The home BG must be **continuous through the full scroll** — no abrupt colour jump. Anchor: full-page
screenshot @393, sample the left-margin column (pure page-BG, x=6), assert max adjacent-row ΔRGB ≤ **90**
(budget; floor). BG01 hero gradient-fades into `bg-cream`, so the only colour change is a smooth gradient.

## proof-of-teeth (run-bg-continuity.ts, executed, neg-control-first)
| case | result |
|---|---|
| neg-control (verify-the-instrument) — clean home | **max-seam 10** → continuous, instrument valid |
| mutant `mut-bg-seam` (inject a hard full-width band) | **max-seam 472** ≥ 90 → 🦷 CAUGHT |

Run: `HARNESS_HOST=… npx tsx harness/run-bg-continuity.ts`. The neg-control (10) is what makes the
reading trustworthy — a continuous BG reads ~0-noise, so the 472 is a real seam, not instrument noise.
(First mutant injected *behind* the opaque page bg and read 10 — the control-first discipline exposed
the mis-injection; fixed to a visible in-page band before trusting teeth.)

Also verified @393 (both real character + fallback): overflowX=false, 0 console errors, scrollHeight
stable 1892px (real character vs fallback = no layout shift), safe-area, content clears the fixed nav.

ANCHOR: harness/run-bg-continuity.ts#mut-bg-seam

## adversary sign-off
Cross-oracle — I do NOT self-certify. Dispatched to goo (runtime/responsive) + too (static/structure):
- **goo** — try to sneak a BG break / responsive breakage past the anchor (a seam only at a non-sampled
  x / a scroll depth the fullPage misses / an overflow at a viewport other than 393).
- **too** — structural: a section that breaks the column at a different breakpoint / a hard-coded width.
- **PENDING** their run-proven attempts (attach what was tried, not a ✓). This anchor is not teeth-proven
  for merge on my say-so.

## honest scope (scope B — shell-first)
The anchor samples ONE column (left margin) at @393 — catches a hard horizontal seam there. A seam only
at a non-sampled x, or a break that appears only at another viewport width, is A2 (multi-column /
multi-viewport sampling). Feature content is placeholder; layout structure is complete.
