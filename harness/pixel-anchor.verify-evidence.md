# verify-evidence — pixel lens (visual ground-truth) · webgang v2 A1

Co-located proof for `harness/pixel-anchor.ts` + `harness/run-pixel.ts`. Closes **D1's 3rd lens**: the
same-position flash that runtime (goo crawl) and static (too AST) are blind to.

## capability → gates fired
A change that can render a **transient visual flash without moving layout** (opacity / transform /
same-box content swap — e.g. SSR shows the wrong state, then JS flips it in place) → the **pixel lens**.
Runtime is blind (no layout-shift, no console signal); static is blind (real render, not a code shape).

## invariant
After assets-ready, a screen must be **visually stable** — two post-settle frames of the real route
@393 must be pixel-identical within budget (**1%**, a floor; per-route re-ratify).

## ground-truth artifacts (screenshots of the REAL /v2 route @393)
- `pixel-proof/01-clean-settled.png` — clean settled frame (baseline)
- `pixel-proof/02-mutant-frameA-before-flash.png` — mutant, frame A (before the injected flash)
- `pixel-proof/03-mutant-frameB-after-flash.png` — mutant, frame B (after the same-position flash)
- `pixel-proof/04-mutant-diff-caught.png` — pixelmatch diff: **red = changed pixels** (mascot dimmed,
  heading + CTA recoloured) in their **original positions** — a same-position flash, caught.

## proof-of-teeth (capability-scoped: visual/pixel class)
Run: `npx tsx harness/run-pixel.ts` (server on :3000; env-overridable for CI).
| state | result |
|---|---|
| neg-control (verify-the-instrument) — clean /v2 | **0.000%** pixel-diff → instrument valid, no false-positive |
| mutant `mut-pixel-silent-flash` (recolour/dim in place) | **21.3%** pixel-diff ≥ 1% budget → 🦷 CAUGHT |
| CLS-blind proof (same run) | flash **CLS 0.0002** < 0.015 gate + console clean → console+CLS could NOT see this |

The negative control is what makes the reading trustworthy: a stable route reads ~0, so the 21.3% is a
real flash, not instrument noise. (A `page.setContent`-based probe silently read 0 for everything until
the control exposed it — the measure itself must be shown to move.)

## adversary sign-off (cross-oracle — I do NOT self-certify)
**PENDING** — goo (runtime) + too (static) to try to sneak a visual flash **past** the pixel anchor and
record what they tried, e.g.:
- a flash **during the entrance/settle window** (before frame A is taken) — the honest known scope gap;
- a change too small to clear 1% but still perceptible (sub-budget flash);
- a route with legitimate post-settle motion that the 1% budget false-positives on (needs per-route budget/masking).
Per the frame, this anchor is not "teeth-proven" for merge on my say-so; it needs a cross-lens attempt.

## honest scope (D1 close = core only)
One anchor, one route (/v2), catches a flash **after** visual-settle. A flash **during** the entrance
window is deliberately out of scope this round (distinguishing a bug-flash from a designed entrance
animation by pixels alone is future work). Not claimed as universal — this closes the CLS-blind
same-position class for the stable-after-settle case.
