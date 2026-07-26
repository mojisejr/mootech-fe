# verify-evidence — Zone 3 ดวงสมพงค์ (mindful-moments-section)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` (`SomphongSection`, `SomphongCard`,
`SomphongMound`, `Zone3Mascot`, `SomphongKeyframes` + the `COLLEAGUE_*` constants) and
`harness/run-zone3-somphong.ts`. Figma `421:826` (393×390). Replaces the empty gray `ServiceSection('ดวงสมพงค์')`.

## capability → gate
The section is FIXED art (not user-data-driven — ฟีม decision #3, the opposite of Zone 2): 2 cards, **10
elements animating** in a 2s loop (2 rats + heart + 7 colleagues), a full-bleed bubble bg, and exported
radial/heart SVGs. Ground-truth = the **rendered pixels**, never the className. Four silent-regression risks:
(1) the 10-element animation is heavier than Zone 2 → a dropped `prefers-reduced-motion` guard janks low-end
phones and is invisible to tsc/console; (2) a big mascot covers a card title; (3) an asset (bg/radial/heart/
mascot) fails to paint — a className pointing at a missing file paints nothing; (4) the wide `-mx` mascot
clusters + full-bleed bg push the page sideways at narrow widths.

## proof-of-teeth (run-zone3-somphong.ts, executed → 🟢 PASSED)
| invariant | result |
|---|---|
| motion-guard | under `prefers-reduced-motion:reduce` **all 10/10** animated els → `animation-name:none` + `opacity 1` |
| occlusion | both card `<h3>` titles **z-10 > mascot cluster z-5** (title readable over any mascot) |
| asset-fidelity | **14 imgs paint** (naturalWidth>0), broken=[] — bg + 2 radial groups + heart + 9 mascots |
| graceful | a mascot whose file 404s → **hero fallback `01.png`** (never a broken-image gap) |
| no-overflow-x | page not scrolling sideways @ **393 · 360 · 320** |
| `mut-motion-runs` (re-enable animation under reduce, higher-specificity → simulates a dropped @media guard) | motion-guard sees `animation-name≠none` → 🦷 **CAUGHT** |
| `mut-title-behind` (title z below mascot cluster) | title no longer on top → occlusion gate → 🦷 **CAUGHT** |

**verify-the-instrument** (two negative controls, both green):
1. *motion probe not vacuous* — WITHOUT reduce, the probe reads `animation-name≠none` (the animation really IS
   running), so "all none under reduce" is a real stop, not an animation that was never applied. (I hit the
   vacuous-probe failure live once — a measure that read the at-rest value for everything until a control moved it.)
2. *asset probe not blind* — a deliberately-injected broken `<img>` reads `naturalWidth===0`, proving the
   fidelity probe can actually see a missing asset (a blank card would otherwise pass vacuously).

## real-route capture (capture-route, auto-hash) — FE build `9fc5857` (the committed Zone-3 code commit, clean worktree)
`CAPTURE_HOST=http://localhost:3008 npx tsx harness/capture-route.ts --route /v2 --user default` — a zone3-worktree
FE (`/Users/non/ghq/github.com/mojisejr/mootech-fe-wt-zone3`) booted on :3008 against the test-env BE
(:4000/:3100/:5433). PNGs (team-standard dir): `harness/captures/v2__default__{393,360,320}.png`.
- **real /v2 · default** @393/360/320 — **0 console errors** each. Zone 1 renders REAL data (มิลา · ธาตุ **ดิน** ·
  score **B+ 70%** · 26 กรกฎาคม 2569 · real เหมาะ/เลี่ยง), Zone 2 = REAL earth mascot card. **Zone 3 renders on the
  real route** with the correct fixed art (คู่รัก: ไฟ-left/ไม้-right + heart · เพื่อนร่วมงาน: 7-mascot huddle · border
  CTA). Real-user data drives Zone 1/2 but **not** Zone 3 (data-invariant by design). Zone 1 + Zone 2 not regressed.
- **provenance** — the capture was re-run on the **committed, clean `9fc5857`** (the commit that introduces the
  Zone-3 code), so the auto-hash MATCHES the reviewed code — the hash proves the pixels came from that commit, not a
  dirty tree. (Doc-only edits to THIS evidence file may land in a later commit on top; they touch no
  `V2HomeScreen`/asset, so the `9fc5857` render stands.) The first capture during build ran pre-commit and recorded
  the base `e98a82e`; **superseded** by this committed re-capture per บอง's provenance ask — the record is not
  rewritten, it is strengthened. Content-proof independently holds: ดวงสมพงค์ + the two cards + the 7/2 mascots
  cannot exist on `e98a82e`, whose call-site is the empty gray `ServiceSection`.
- ⚠️ **known capture artifact (NOT a Zone-3 bug)**: capture-route uses `fullPage:true`, so the *fixed* bottom nav
  paints at its viewport-top position and lands over the mid-page Zone-3 title. The real layout is proven by the
  nav-hidden section shots. This is บอง's logged blind-spot → the queued capture-route viewport-only shot.

ANCHOR: harness/run-zone3-somphong.ts#mut-motion-runs

## completeness-pass + honest scope (visual-lens clause — enumerated, not spot-checked)
**Bounded reference** = Figma `421:826` + the contract's declared viewports (393/360/320). **Scaled stakes** =
shipping user-facing flow → exhaustive on the 3 core axes.
1. **Spatial** — sampled the whole section: title, description (2 fixed lines), both cards (bg + radials + titles +
   mascots + heart), the CTA, top+bottom cream mounds, and the full-bleed bg. Not a single-region check.
2. **State-space** — **viewports** 393 (7/7 mascots fully inside) · 360 (7/7) · 320 (5/7 fully inside, 2 edge-tucked
   inside the tight-huddle intent, **0 page overflow-x**, no text truncation — description wraps to 3 lines, all
   visible). **temporal** — reduced-motion (anchor, all-stopped) + motion-on (jank measured, below) + first-paint
   (assets-ready gate). **data-variant** — N/A by design: Zone 3 is fixed art, identical for every user (verified the
   real /v2 default user renders the same 9 mascots as home-preview). **missing-asset** — graceful 404→hero (anchor).
3. **Reference parity vs Figma 421:826** — title/desc (2 fixed lines) · คู่รัก (**ไฟ-left / ไม้-right** order, heart at
   chest, 2 radial groups) · เพื่อนร่วมงาน (7-mascot huddle, 1 radial group) · border CTA `#1455A4` · cream mounds
   top+bottom · bubble bg. Colors/text/spacing/inset (16px, `px-4`) match.

**animation performance** (dispatch's biggest ⚠️ — "วัดบนมือถือจริง ไม่กระตุก"): measured rAF frame intervals with a
**4× CPU throttle** (CDP, mid-tier-mobile proxy) over ~2.5s of the 10-element loop → **p50 16.7ms · p95 18.5ms ·
max 18.6ms · 0 frames >32ms** = a clean 60fps (pure CSS transform/opacity runs on the compositor, off the main
thread). Instrument verified: a control busy-loop spiked the same probe to p95 51ms / 134 long-frames, so the clean
reading is real evidence, not a vacuous zero. *(Caveat: headless-chromium@4× is a proxy, not a physical phone.)*

**Remaining nuances → logged A2, not claimed covered**:
- The two คู่รัก rats lean slightly less *inward* than Figma (the exact lean/arm pose is baked into the source PNG
  art; order/size/heart-position match). Cosmetic; not a contract break.
- @320, 2 of the 7 colleague mascots are ~85% visible (tight-huddle edge-tuck) — within the design intent (Figma's
  cluster is also edge-tight), zero page overflow, all mascots present.
- Button/card destinations NOT wired (ฟีม decision #4 — "เอา UI ให้เป๊ะก่อน").

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do NOT self-certify (a trap I own is not trusted until a different lens attacks it).
- **too (static/AST + D2 gate) — SIGNED OFF PR #116** (`[ack:review-116]`). Engaged the specifics, did not
  rubber-stamp: confirmed the **occlusion** holds (content `z-10` decisively beats mascot `z-[5]`), the **404→hero
  fallback** is tight, and — in the Subjective-Judgment lens — backed the `@320` **edge-tuck** (2 mascots ~85%
  visible, 9px crop) as the correct trade-off: it **keeps scale/dimension** rather than shrinking the mascots to a
  stunted size, and the `-mx-[16px]` cluster proportioning. No anchor cracked.
- **goo (runtime lens)** — complementary/open: real-data render + the test-env asset path + on-device motion perf
  (the 4× throttle here is a proxy, not a physical phone). Not a blocker; a widening pass if goo finds a gap.
- **This section's own completeness-adversary**: the cross-oracle pass IS the state-space enumerator — whatever
  viewport/variant/region a lens finds I under-sampled → A2, never "covered".
