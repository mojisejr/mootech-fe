# verify-evidence — shared `<HabitCard/>` + Zone 4 idle-motion (Zone 4/6 card, motion-debt payback)

Co-located proof for `features/v2-home/components/sections/HabitCard.tsx` (new shared card + 3-element cohort
motion) and `harness/run-zone4-motion.ts` (the motion anchor). The card is Figma `333:6889` (Zone 4 โหมดเซียน)
=== `375:14151` (Zone 6 เรียนปาจื่อ) — pixel-identical, only title lines + CTA variant differ (props). This PR
extracts the card out of `SianSection` and pays back the **idle-motion debt** the team accepted as "not free" when
Zone 4 shipped static (#125).

## capability → gate
The rendered pixels must tell the truth about MOTION — a facet AST/tsc/console are all blind to. Risks the pixels own:
(1) the motion **silently never attaches** → a `prefers-reduced-motion` guard "passes" vacuously (I hit this exact
vacuous-pass live on Zone 3); (2) reduced-motion strips the **base** transform, not just the animation → the sprite
un-flips/un-tilts at rest (the #128 bug, now on the SHARED card); (3) the cohort drifts out of **sync** (mismatched
duration/easing); (4) the motion **thrashes the main thread** (animating top/margin instead of transform → jank + CLS).
Ground-truth = `getAnimations()` + computed transform + long-task timing + the **rendered pixels**, never the className.

## proof-of-teeth (run-zone4-motion.ts, executed against real /v2/home-preview → 🟢 PASSED)
| invariant | result |
|---|---|
| liveness (no reduce) | **3/3** cohort els (`.hc-big`·`.hc-small`·`.hc-frame`) `getAnimations().length≥1` · `playState==='running'` · **duration 2000ms** |
| cohort-sync | single duration `{2000}` + **single easing** across all 3 → sync proven **declaratively** (no frame-grab) |
| reduced-motion | `getAnimations()` **empty** for all 3 (`[hc-big:0 hc-small:0 hc-frame:0]`) — motion truly stops |
| rest-transform (#128) | under reduce `.hc-small`/`.hc-frame` **keep their base** (non-identity matrix) **and** `.hc-big`'s inner static child keeps its flip — no un-flip/un-tilt |
| verify-instrument (**2-way**) | the `getAnimations` probe reads **NON-empty when live AND empty under reduce** — proves it is not vacuously always-empty (the check บอง flagged) |
| jank @ **4× CPU throttle** | **0 long tasks** (0ms) · rAF p50/p95/max = **17/18/19ms** over 120 frames → transform-only compositor path, no main-thread thrash |
| verify-instrument (jank) | a deliberate 250ms busy block **IS** observed as a long task → the "0 long tasks" reading is not vacuous |
| `mut-motion-never-attached` (`animation:none` in live mode) | liveness gate sees empty `getAnimations` → 🦷 **CAUGHT** |
| `mut-reduce-kills-transform` (re-add #128 `transform:none` under reduce) | rest-transform gate sees base lost → 🦷 **CAUGHT** |
| `mut-desync` (one element forced to 1.5s) | cohort-sync gate sees 2 durations → 🦷 **CAUGHT** |

The anchor deliberately does **not** assert keyframe degrees match Figma exactly — that is ฟีม's eye (the pixel
capture), not the anchor's job (บอง 2026-07-28). The anchor owns the bug-**class**; fidelity is the pixel-diff's job ↓.

## the "not-free" cost — PAID, and it caught a real regression
**Zone 4 pixel-identical before/after the refactor**, captured under `reducedMotion:'reduce'` (deterministic — the
new motion is removed so the two builds are directly comparable). `main` (`5b69c41`, inline card) on :3011 vs this
branch (shared `HabitCard`) on :3010, โหมดเซียน section clip @393×dpr2 (722×937):

| | changed px | verdict |
|---|---|---|
| first attempt | **3439 / 677236 = 0.5078%** | 🔴 whole **small mascot** reflected |
| after fix | **8 / 677236 = 0.0012%** | 🟢 pixel-identical within AA tolerance |

**Root cause (the pixel-diff caught what the anchor structurally cannot):** my first `hc-small` keyframe composed
`scaleY(-1) rotate(-151.216deg)` (scale-then-rotate), but the merged/Figma Tailwind `-scale-y-100 rotate-[-151.22]`
emits `rotate() scaleY(-1)` (rotate-then-scale). Because `scaleY(-1)·R(θ) = R(−θ)·scaleY(-1)`, the small mascot was
**mirror-reflected** (opposite off-diagonal signs → the whole sprite differs). Fixed to `rotate() scaleY(-1)` order
with `translateY` outermost (screen-space bob). Residual 8px = the 0.004° rounding (−151.216 vs −151.22), sub-pixel AA.
`.hc-big` (flip on an unchanged inner Tailwind child) and `.hc-frame` (single rotate, no order) were identical throughout
— confirmed by the diff image (only the small mascot region lit up).

**No Zone 4 regression:** the merged static anchor `run-zone4-sian.ts` is 🟢 **both before and after** the refactor
(asset-fidelity 5/5, readable/z, clickable, no-overflow-x @393/360/320, `mut-asset-missing` caught).

## real-route artifact
`HARNESS_HOST=http://localhost:3010 npx tsx harness/run-zone4-motion.ts` (branch FE on :3010, deterministic
home-preview — no BE needed; Zone 4 makes no API calls). Pixel-diff PNGs: `z4-before.png` / `z4-after.png` /
`z4-diff.png` (attached to the PR / sent to ฟีม·บอง). Live animated @393 render reproduces via `capture-route.ts`.

ANCHOR: harness/run-zone4-motion.ts#mut-reduce-kills-transform

## completeness-pass + honest scope (visual-lens clause — enumerated, not spot-checked)
**Bounded reference** = Figma `333:6889` motion-context + declared viewport 393. **Scaled stakes** = a shipping
user-facing card → core axes + the reference orientation.
1. **Spatial** — the diff sampled the **whole section clip** (722×937), not one region: header, card (both mascots +
   book-frame + text + CTA), 3-card row, tertiary CTA. The regression lived in the small-mascot region and the
   full-frame diff surfaced it.
2. **State-space** — rendered across **motion-live** (getAnimations running, jank@4×) **and** **reduced-motion** (empty
   + rest-transform) — the two temporal states this PR is about. Viewport: pixel-diff @393 (the Figma-exact width);
   the static anchor already covers 360/320 no-overflow.
3. **Reference parity** — orientation checked against the **merged/approved** Zone 4 (itself Figma-verified in #125)
   via the pixel-diff, which is what caught the mirror. Sync/easing parity vs `get_motion_context` (2000ms, one easing).

**Deviations logged (A2, not claimed covered):**
- **Exact per-frame sway path** (the ±5° / bob amplitudes) is **not** pixel-asserted mid-animation — proven only at
  rest + by declarative duration/easing sync. Mid-frame fidelity is ฟีม's eye by design; I do **not** claim it verified.
- Pixel-diff run **@393 only** (the small-mascot reflection is width-independent — it's a transform-order bug, not a
  layout bug — so 360/320 add no new information for *this* regression; the static anchor covers overflow at those widths).
- **Zone 6** uses this same card but is a **separate PR** (PR 2) with its own self-verify — not claimed here.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify (a trap I own is not trusted until a different lens attacks it).
- **ตู๋ (static/AST + D2 + Figma-deviation lens) — ⏳ PENDING** this PR. The two points ตู๋ called out at dispatch to
  attack: (1) does the motion make the pixel-anchor false-red? — mitigated: every anchor/diff capture runs under
  `reducedMotion:'reduce'` (goo's #126 freeze), so motion cannot flake the pixels; the *live* jank check is timing,
  not pixels. (2) Zone 4 regression from touching merged code — answered by the before/after pixel-diff (0.0012%) +
  `run-zone4-sian.ts` green both sides. (3) transform-only, no margin/top (CLS) — the jank gate ties to this: a
  layout-animating property would produce long tasks and trip it.
- **What I tried to refute myself (attached as attack, not a ✓):** I attacked the reduced-motion guard with
  `mut-reduce-kills-transform` (the #128 bug on the shared card) → caught; attacked the liveness check with
  `mut-motion-never-attached` (the vacuous-pass) → caught; attacked sync with `mut-desync` → caught; and I did **not**
  trust "reduced-motion = identical" — I pixel-diffed it and it **failed first** (the mirror), which is how the real
  bug surfaced. Still **unproven by me**: exact mid-animation sway fidelity (ฟีม's eye) and multi-width motion (only the
  static anchor covers 360/320) — logged A2 above, not claimed covered.
- **Completeness-adversary**: the cross-oracle pass IS the state-space enumerator — whatever temporal/viewport/region a
  lens finds I under-sampled → A2, never "covered".
