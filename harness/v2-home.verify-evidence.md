# verify-evidence — v2 home shell (slice-2, scope B)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` + `harness/run-bg-continuity.ts`.

## capability → gate
Composing a long scrolling screen (~1892px) that layers a hero photo over the page background can leave
a **visible BG seam/break** where the image ends — ฟีม's headline requirement is that the BG is
CONTINUOUS. No other lens sees this (renders fine to console/AST; CLS/computed don't measure a hard
visual seam). Ground-truth = the rendered image.

## invariant + anchor
The home BG must be **continuous through the full scroll** — no abrupt colour jump. Anchor: full-page
screenshot @393, sample the **left BG margin** column (x=6, pure page-BG), assert max colour delta —
**row-to-row AND skip-8** (so a soft gradient seam can't hide) — ≤ **90** (budget; floor).

## proof-of-teeth (run-bg-continuity.ts, executed, neg-control-first)
| case | result |
|---|---|
| neg-control (verify-the-instrument) — clean home | **max-seam 19** ≤ 90 → continuous, instrument valid (no over-block) |
| hard full-width band | **472** ≥ 90 → 🦷 CAUGHT |
| too#3 soft/gradient seam (full-width) | **675** ≥ 90 → 🦷 CAUGHT (skip-8, not just adjacent-row) |

The neg-control (19) is what makes the reading trustworthy. (First mutant injected *behind* the opaque
page bg and read 10 — the control-first discipline exposed the mis-injection before trusting teeth.)

Also verified @393 (real character + fallback): overflowX=false, 0 console errors, scrollHeight stable
1892px (real char vs fallback = no layout shift), safe-area, content clears the fixed nav.

ANCHOR: harness/run-bg-continuity.ts#BG-CONTINUITY

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do NOT self-certify. Both goo (runtime/responsive) and too (static)
attacked and **converged on the same holes** (= real):
- **too — the critical catch**: my first widen added a right-margin + left-vs-right comparison to catch
  right/center seams; it **OVER-BLOCKED the clean page** (read 106–164 > 90) because the home has a legit
  greeting decoration (sparkle) + left/right BG asymmetry. An over-blocking gate is useless →
  **reverted to left-margin only** (clean back to 19). too's over-block finding is what kept the anchor honest.
- **goo — run-proven**: single-column sampling misses a seam that doesn't touch the sampled margin
  (`left:120px right:0` → x=6 reads 10 BLIND while x=200 = 621 visible); + responsive (320/430/tablet)
  + sub-budget soft seam (fixed here via skip-8).
- **Outcome**: teeth = the **primary full-width horizontal seam class** (the BG01→cream transition — ฟีม's
  actual concern) + soft gradients. The rest is **A2, logged** (see below). Neither oracle certified blindly.

## honest scope (scope B) — A2 boundaries (run-proven, logged, not silent)
- **side/center-gap seam** (touches no left margin) → A2 = grid/multi-column sampling (right margin can't
  be used as-is: legit decoration over-blocks it).
- **responsive** (break only at a non-393 viewport) → A2 = multi-viewport capture.
The anchor catches the primary class without false-positives; feature content is placeholder, layout complete.
