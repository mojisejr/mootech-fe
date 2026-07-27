# verify-evidence — Zone 4 โหมดเซียน (mindful-moments-section)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` (`SianSection` + `SIAN_CARDS`) and
`harness/run-zone4-sian.ts`. Figma `333:6885` (393×544) — **not** Zone 3's `421:826` (same name, different node).
Replaces the empty gray `ServiceSection('โหมดเซียน')`.

## capability → gate
STATIC UI (no data, no motion this round — ฟีม "UI only ก่อน"). The section is exported-asset-heavy: 2 mascots +
3 card icons + a CSS book-frame. Ground-truth = the **rendered pixels**, never the className. Risks the pixels
own: (1) an exported asset fails to paint (missing file → blank); (2) a clipped mascot covers the ซื้อเลย CTA /
title; (3) a CTA that isn't linked yet still submits/throws; (4) the mascots' offsets drift/overflow at narrow widths.

## Phase-0 asset pairing (image-verified — ฟีม's rule: prove by picture, not filename)
| needed | vs what exists | verdict |
|---|---|---|
| big mascot (water-rooster, red robe, holding a MuMate phone) | `characters/10_ระกา-น้ำ` = same face but a **blue-tie outfit, no phone**; `mascot/` hero (10) = **all dragons** | **export new** |
| small mascot (green leaf/wood sprite) | **not one of the 12 zodiac** · not in the hero set | **export new** |
| 3 card icons (heart #FF6800 · briefcase #1D9D9D · double-heart #FF0073) | not in `public/images/icons/` | **export new** |
| Group 5 (white book-frame) | — | **CSS** (`#F9F4F0` rounded-6 rotate `-9.15°`), from design-context — no export |

This **overturned** the framing assumption that both mascots came from the 60-char set — matching by filename
would have shipped the water-rooster in the **wrong costume** and passed review. Both mascots exported +
**compressed** to `public/images/v2/zone4/`: `mascot-sian` 1.74 MB → **121 KB** (14×), `mascot-leaf` 1.28 MB →
**49 KB** (26×) — total 3.0 MB → 171 KB, still ≥2× the display size. 5 export files ≪ the 20-file / 5 MB tripwire.

## proof-of-teeth (run-zone4-sian.ts, executed → 🟢 PASSED)
| invariant | result |
|---|---|
| asset-fidelity | **5/5 imgs paint** (2 mascots + 3 icons, naturalWidth>0), broken=[] |
| readable/z | ซื้อเลย CTA hit-tested **ON TOP**, big mascot behind (`pointer-events-none`) |
| clickable | both CTAs (ซื้อเลย · ดูบริการทั้งหมด) `type=button` + hittable — not-linked, no submit/throw |
| no-overflow-x | page not scrolling sideways @ **393 · 360 · 320** |
| `mut-asset-missing` (a card icon repointed to a 404 path) | asset-fidelity gate sees the broken img → 🦷 **CAUGHT** |

**verify-the-instrument**: an injected KNOWN-broken `<img>` reads `naturalWidth===0`, proving the fidelity probe
can actually see a missing asset (a blank card would otherwise pass vacuously).

## real-route capture (capture-route, full + vp-top + vp-bottom) — FE build `d1798c5` (clean worktree = the committed Zone-4 code)
`CAPTURE_HOST=http://localhost:3009 npx tsx harness/capture-route.ts --route /v2 --user default` — a zone4-worktree
FE on :3009 against the test-env BE. Shots: `harness/captures/v2__default__{393,360,320}{,__vp-top,__vp-bottom}.png`.
- **Zone 4 renders on the real /v2** (content-proof: โหมดเซียน + the blue habit-card + water-rooster/leaf mascots +
  3 icon cards cannot exist on the base commit, whose call-site is the empty gray `ServiceSection`). **vp-bottom @393**
  (the #185 shot) shows Zone 4's cards + CTA with the fixed nav correctly at the true bottom — no misplaced-nav artifact.
- **Zone 1-3 + Sinse + Pajeu not regressed** (all six sections present on the real route).
- ⚠️ **1 console error = test-env BE `/api/chinese-horoscope` **502 Bad Gateway** — infra flakiness, NOT Zone 4**
  (Zone 4 is static, makes no API calls; **no zone4 asset failed**; the deterministic home-preview render = **0**
  console errors). Flagged to บอง as a test-env BE hiccup, independent of this change.

ANCHOR: harness/run-zone4-sian.ts#mut-asset-missing

## completeness-pass + honest scope (visual-lens clause — enumerated, not spot-checked)
**Bounded reference** = Figma `333:6885` + declared viewports (393/360/320). **Scaled stakes** = shipping flow → the core axes.
1. **Spatial** — sampled the whole section: header, habit-card (gradient + book-frame + both mascots + text + ซื้อเลย),
   3-card row (3 icons + text), tertiary CTA. Not one region.
2. **State-space** — **viewports** 393 (Figma-exact) · 360 · 320 (all: no page overflow-x, no text truncation, both
   CTAs present). Zone 4 is **data-invariant** (static — identical for every user) and **motion-free this round**
   (idle motion deferred to a follow-up PR per ฟีม/บอง). missing-asset → caught by the anchor.
3. **Reference parity vs Figma 333:6885** — header (โหมดเซียน + 2-line desc) · habit-card (gradient · tilted CSS
   book-frame + shadow · water-rooster bottom-left clipped · leaf sprite top-over-book · หนังสือเล่มเดียวในโลก + desc +
   ซื้อเลย lime-on-sapphire) · 3 pastel-blue cards (correct icons + text, card-3 shorter) · outline CTA. Tokens are
   Figma-exact (v3-navy #0B305B, v3-sapphire #1455A4, v3-lime #E1FF00, v3-pastel-blue #C9E4F4, v3-lemon-chiffon #F9F4F0).

**Deviations logged (A2, not claimed covered)**:
- Mascot horizontal offsets converted from fixed px to **%-of-card** (−15.24% / 34.07%) — **exact at 393**, and at
  360/320 the small sprite tracks the book instead of colliding with the wrapping title (a fixed-px port would overlap).
- **Idle motion NOT implemented** (book-frame rotate/y + possible mascot float) — deferred to a follow-up PR (ฟีม
  "UI ก่อน" · motion can't be proven by a still capture anyway). Static rest-transform (-9.15° tilt) is baked in.
- Button/card destinations **NOT wired** (ฟีม) — clickable + no error, but no navigation.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do NOT self-certify (a trap I own is not trusted until a different lens attacks it).
- **too (static/AST + D2 gate + Figma-deviation lens) — SIGNED OFF PR #125** (`[ack:review-125]`, posted on GitHub).
  Ran the static gate (tsc compiles clean) and confirmed the three highest-risk claims held under attack: (1) the
  Phase-0 image-verification + compression (exported the real costume, not a filename guess, → 171 KB); (2) the
  %-of-card offsets genuinely fix the 360/320 overlap + overflow-x without drifting off-design at 393; (3) the
  `run-zone4-sian` anchor sharply catches `mut-asset-missing` and hit-tests the CTA-over-mascot occlusion. No anchor
  cracked; no visual regression got past.
- **This section's own completeness-adversary**: the cross-oracle pass IS the state-space enumerator — whatever
  viewport/variant/region a lens finds I under-sampled → A2, never "covered".
