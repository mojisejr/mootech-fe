# verify-evidence — Zone 5 ทักซินแส (333:6989) + home page-end + whole-page continuity

Co-located proof for `features/v2-home/components/sections/SinseSection.tsx`, the page-end wiring in
`V2HomeScreen.tsx`, and the anchors `harness/run-zone5-sinse.ts` + `harness/run-page-end.ts`. This is Zone 5/6
**PR 3 of 3** — the last home section + the page close-out. Also removes the two now-dead placeholder frames
(`ServiceSection`, `SinseCard`) — git history preserves them (บอง: Rule 1 governs the team trail, not repo dead code).

## capability → gate
Zone 5 is a full-bleed sapphire banner where **exactly one** thing moves (the fire) and one big asset is **static**
(the mascot) — a motion/asset truth the className can lie about. The page-end is where the last content can slip
**behind the fixed nav** if the `pb-36` clearance is wrong — invisible to tsc/console, only rendered geometry catches it.

## Phase-0 asset pairing (image-verified — the Zone-4 lesson: prove by picture, not filename/coords)
| needed | resolution | verdict |
|---|---|---|
| big mascot (333:6997) | downloaded BOTH raw fills of the node — both are the **水-owl mascot** (`z5-raw1` 1.74MB byte-identical to the prior `mascot-big.png`; `z5-raw2` a lower-res copy of the same character) | **REUSE `zone4/mascot-sian.png`** — same source, **no new export** |
| fire sprite (333:7023) | raw export is **byte-different** from every zone4 asset | **NEW** → `public/images/v2/zone5/sprite-fire.png` (176×220, **43 KB**) |
| white mound (Frame 7) | — | **CSS/SVG** (cream wave), no export |

A **clipped 220px node thumbnail** of `333:6997` first *looked* like a star-emblem different mascot; the full-res
source fills corrected that — **verify the asset, not the thumbnail**. **1 new file, 43 KB** ≪ the 20-file / 5 MB tripwire.

## proof-of-teeth (executed against real /v2/home-preview → both 🟢 PASSED)

### run-zone5-sinse.ts
| invariant | result |
|---|---|
| asset-fidelity | mascot-sian + sprite-fire **paint** (2 imgs, broken=[]) |
| fire-only-motion | fire runs **2000ms** · big mascot **STATIC** (getAnimations empty) |
| reduced-motion | fire animation removed (getAnimations 0) — identity rest is **correct** here (no base transform to preserve, unlike hc-small/hc-frame) |
| verify-instrument (2-way) | fire reads running live **AND** empty under reduce (not vacuous) |
| secondary-cta | single **lime-FILLED** Secondary CTA (computed bg, not outline), label ทักซินเเสเพื่อจอง |
| full-bleed | banner spans **393px @393** (breaks out of the 361 content column) |
| mound | cream wave svg present at section bottom |
| no-overflow-x | @ **393 · 360 · 320** (mascot overflows the CARD, clipped, page doesn't scroll) |
| `mut-mascot-animates` (give the static mascot an animation) | fire-only-motion gate rejects → 🦷 **CAUGHT** |
| `mut-fire-reduce-runs` (re-enable fire under reduce) | reduced-motion gate rejects → 🦷 **CAUGHT** |

### run-page-end.ts
| invariant | result |
|---|---|
| zone-continuity | all **6** zones present + in order (greeting → มานิเฟส → ดวงสมพงค์ → โหมดเซียน → ดูดวงส่วนตัว → เรียนปาจื่อ) |
| nav-clearance | scrolled to bottom, last content (เรียนปาจื่อ) sits **+74px ABOVE** the fixed nav @ **393/360/320** |
| no-overflow-x | full page @ **393 · 360 · 320** |
| `mut-shrink-pad` (drop the pb-36 clearance) | last content slides under the nav → nav-clearance gate rejects → 🦷 **CAUGHT** |

**Page-end (closed by บอง/ฟีม):** the content column already has `pb-36` (144px); Zone 5/6 live **inside** it (flow),
and there is **no hardcoded 140px gap** (grep-verified) — the Figma ~140px is the existing nav allowance, not a spacer.
144 > 94 (nav) → clears even with a device bottom inset.

## real-route artifact — rendered vs Figma @393
`HARNESS_HOST=http://localhost:3010 npx tsx harness/run-zone5-sinse.ts` + `harness/run-page-end.ts` (branch FE on
:3010, deterministic home-preview — no BE). Captures sent to ฟีม·บอง: `z5-render.png` (Zone 5 @393 vs
`figma-zone5-full.png`) and `vp-bottom-393.png` (Zone 4→5→6 flow + nav clearance). Faithful: full-bleed sapphire
banner · title · 2-line desc · lime Secondary CTA · 水-owl mascot overflowing bottom-right (clipped) · fire sprite ·
cream mound wave. **No neighbor regression**: `run-zone3-somphong` · `run-zone4-sian` · `run-zone4-motion` ·
`run-zone6-pajeu` all green with Zone 5 present.

ANCHOR: harness/run-zone5-sinse.ts#mut-mascot-animates
ANCHOR: harness/run-page-end.ts#mut-shrink-pad

## completeness-pass + honest scope (visual-lens clause — enumerated, not spot-checked)
**Bounded reference** = Figma `333:6989` + declared viewports 393/360/320. **Scaled stakes** = shipping section + the page close-out.
1. **Spatial** — Zone 5: header text block, Secondary CTA, big mascot (overflow-clipped), fire sprite, mound — whole
   banner sampled. Page-end: the full column scrolled to its true bottom, last-content-vs-nav measured (not spot-checked mid-page).
2. **State-space** — **viewports** 393/360/320 (no overflow-x, nav-clearance holds at all three). **Motion**: fire live
   (running 2000ms) + reduced (empty); mascot static (both states). Data-invariant (static copy).
3. **Reference parity vs Figma 333:6989** — banner · title · 2-line desc · Secondary CTA · mascot placement (overflow
   top/right) · fire sprite position · mound. Continuity vs the page: Zone 4→5→6 in order, Zone 1-3 not regressed.

**Deviations logged (A2, NOT claimed covered):**
- **BE-up real-/v2 console-clean pass (done-condition #6) — NOT executed by me.** The section/page anchors are the
  gate and run against the deterministic preview (no BE). Booting the testenv BE for the real-data console pass is a
  **runtime/infra seam** (goo/ฟีม's domain): the testenv status shows the BE **outbound SMS/LINE pipe is currently
  🔴 live (real provider)**, so I did **not** boot it unilaterally (Golden Rule — no risky external side-effects;
  บอง — seams needing data/runtime → stop, tell บอง). **Routed to บอง** for goo to boot (pipe safed) or ฟีม at merge.
- **Exact fire sway degrees** (the flicker amplitudes) are ฟีม's eye — the anchor proves the fire *animates* and is the
  *only* animated element, not the per-frame path.
- Pixel-diff-vs-Figma is a **visual side-by-side**, not a numeric pixel diff (Figma-render vs browser-render differ in
  AA/font — a numeric diff would false-red; the reference is the design, not a prior browser capture as in PR 1).

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ (static/AST + D2 + Figma-deviation lens) — ⏳ PENDING** this PR (ตู๋ signed #130 + #131 100%). Points to attack:
  (1) is the mascot genuinely STATIC and the fire the only mover? — fire-only-motion asserts fire running + mascot
  getAnimations empty, `mut-mascot-animates` proves the gate bites; (2) full-bleed banner without page overflow? —
  measured 393@393 + no-overflow-x @3 widths; (3) does the page end actually clear the nav, or did I eyeball it? —
  nav-clearance measures +74px at max scroll @3 widths, `mut-shrink-pad` proves the gate bites.
- **What I tried to refute myself:** I did **not** trust the reused mascot by name — I downloaded the node's raw fills
  and confirmed by image (and caught my own thumbnail misread); I did **not** trust "the fire is the only motion" —
  I asserted the mascot is static and attacked it; I did **not** eyeball nav-clearance — I measured it and attacked
  the padding. **Unproven by me:** the BE-up console-clean pass (routed to บอง, above) and exact fire-sway fidelity
  (ฟีม's eye) — logged A2, not claimed covered.
