# verify-evidence — pixel lens (visual ground-truth) · webgang v2 A1

Co-located proof for `harness/pixel-anchor.ts` + `harness/run-pixel.ts`. Closes **D1's 3rd lens** for the
**persistent same-position** class — a divergence no other lens sees.

## capability → gate
A change that renders a **persistent same-position divergence** (pixels change, layout does NOT move,
change persists into the settled frame — opacity / colour / same-box swap held) → the **pixel lens**.
Runtime is blind (no layout-shift, no console signal); static is blind (real render, not a code shape).

## invariant + anchor
After assets-ready, a settled screen must be **pixel-stable**: two post-assets-ready viewport
screenshots of the real /v2 @393, `pixelmatch` diff, budget = **absolute 300px** (a flash is absolute,
not a % of screen — the adversary insight). gate_layer = visual/pixel; injection = css-inject.

## proof-of-teeth (run-pixel.ts, all executed, neg-control-first)
| case | result |
|---|---|
| neg-control (verify-the-instrument) — clean /v2 | **0px** → instrument valid, no false-positive |
| core `mut-persistent` (recolour/dim held) | **285,540px** CAUGHT · CLS **0.0002** (< gate) · console clean |
| sub-budget 40×40 box (goo#3 / too#2 — the %-budget miss, now **fixed** by %→px) | **5,423px** CAUGHT |

`pixel-proof/04-mutant-diff-caught.png` — red = changed pixels on the mascot/heading/CTA in their
**original positions**. The neg-control (0px) is what makes the readings trustworthy.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do NOT self-certify. Both a runtime lens (goo) and a static lens (too)
attacked and mapped this lens's boundary precisely; every case was executed, not eyeballed.

- **goo (runtime/timing)** attempted to refute by running mutants against `pixelStability`: transient
  flicker (#1), state-specific (#2), sub-budget 40×40 (#3), legit-motion over-block (#4). Result:
  **found holes** on 4 axes → magnitude fixed here, the rest documented as A2/capability-scope.
- **too (static)** attempted to refute: pre-settle/entrance (#1), sub-budget 10×10 (#2), legit-motion
  over-block (#3). Result: **found holes** → same reconciliation.
- **Outcome accepted by both** (run-proven): the `%→absolute-px` magnitude fix is verified (sub-budget
  now CAUGHT), the claim is cut to *persistent same-position divergence*, and the remaining boundaries
  are logged (not silent). Neither oracle certified the anchor blindly; the boundary is what they mapped.

ANCHOR: harness/run-pixel.ts#mut-persistent

Detail of every case, executed:

**FIXED (widened, not accepted):**
- **magnitude / sub-budget** (too#2 10×10 = 0.024%, goo#3 40×40 = 0.403% — both < the old 1% budget) →
  switched budget from **% to absolute pixels**. A 40×40 flash is now 5,423px ≥ 300px → CAUGHT. The
  adversaries proved the *unit* was wrong; the fix follows their insight.

**ACCEPT-RISK / A2 (documented in `bug-ledger.json#pixel-lens-scope-boundaries`, not silent):**
- **transient flicker** (goo#1, the deepest) — a 2-frame diff **aliases** a flash that resolves between
  the frames (opacity 1→.2→1 @260ms → 0px BLIND). My core mutant was **persistent, not transient** — the
  same "owner blind to a dimension of their own bug-class" shape I caught in goo's crawl. Honest: this is
  a *persistent* same-position anchor. **A2 = burst/temporal sampling.**
- **pre-settle/entrance** (too#1) — a flash removed before frame A → 0px BLIND. **A2 = first-paint capture.**
- **state-specific** (goo#2) — one auth state captured → an authed-only flash is missed. **A2 = route×state.**
- **over-block on legit motion** (goo#4 / too#3) — continuous animation trips the anchor (275,611px) →
  **capability-scoped to STATIC-after-settle routes**; animated routes need per-route budget/masking.
- **below-fold** — viewport capture (fullPage crashes pixelmatch on injection-changed height). **A2 = scroll capture.**

## verdict (honest)
The pixel lens catches the **persistent same-position divergence** class — real, valuable, and invisible
to console+CLS+AST (that is its worth). Its scope is **< "all visual flashes"** along 3 axes
(temporal/magnitude/state); magnitude is **fixed**, the rest are documented A2. Ships as v1's 3rd lens
with its boundary mapped by the adversary round, not claimed as universal.
