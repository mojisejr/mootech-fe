# EYE PROOF — ดวงสมพงศ์ hero: floating corner element sprites (Figma 636:19061 + motion spec)

**Anchor:** `harness/run-compat-sprites.ts` (asset-fidelity + decoration + motion, 2 teeth)
**PR:** feat/v2-compat-hero-sprites · base = main (`2e60b8f`)
**Ledger:** `harness/bug-ledger/` → `compat-hero-sprites`

ANCHOR: harness/run-compat-sprites.ts#mut-motion-runs-under-reduce

## What ฟีม asked (2026-08-03)
ต่อจาก #159: ใส่ sprite ธาตุมุมกรอบ + animation ให้ตรง Figma. เคาะ: asset → repo `public/images/v2/compat/`, "ตรง Figma = OK", dispatch.

## What this is
6 มินิมาสคอตธาตุ (ไฟ/ไม้/น้ำ/ดิน/ทอง) ลอยที่มุมกรอบ hero — cluster ซ้าย 5 + ขวา 1. **ประดับล้วน** (ไม่ผูก user data → กฎ 4 ไม่เกี่ยว). asset export Figma-exact @4x → `public/images/v2/compat/` (120KB รวม).

## Source of truth (read the node · captured the motion spec — not guessed)
- **positions/sizes** = `get_metadata(636:19061)` (each sprite's x/y/w in the 361-wide frame → left as %)
- **motion** = `get_motion_context(636:19061, recursive)` → 6 sprites, cohort loop 2000ms:
  `y: 0→-7→0` · `scale: 1→1.03→1` · `rotate: base±2°` (base per sprite: fire/wood 10.24° · metal/water -13.79° · earth 5.09° · wood-lg -10.65°) · ease `cubic-bezier(0.45,0,0.55,1)`
- **cards/donut/avatar = STATIC** in the spec (only the 6 sprites animate) — confirmed to ฟีม.

## How it's built
- `CompatResultHero`: a `pointer-events-none absolute inset-0 z-0` sprite layer (aria-hidden) UNDER a `relative z-10`
  content wrapper; section is `relative overflow-hidden` so the sprites are **clipped by the frame**, never push the page.
- `styles/globals.css`: `@keyframes compat-sprite-float` + `.compat-sprite`. The **base rotation lives on the element**
  (`transform: rotate(var(--sprite-rot))`), OUTSIDE the keyframe → removing the animation falls back to the exact
  static base, not a snap to 0°. `@media (prefers-reduced-motion: reduce){ .compat-sprite{animation:none} }`.

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app next dev -p 3099
CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-compat-sprites.ts   # 11/11
```

## proof-of-teeth (run-compat-sprites.ts → ✅ 11/11)
| invariant | result |
|---|---|
| all 6 sprites present | ✓ |
| every sprite paints (naturalWidth > 0) | ✓ (asset-fidelity) |
| sprite layer decorative (aria-hidden + pointer-events-none) | ✓ |
| **MOTION on** — sprites animate (getAnimations ≥ 6) | ✓ (negative-control for the reduce check) |
| no page overflow-x @393 / @360 / @320 | ✓ (frame clips them) |
| **reduced-motion** — sprites still paint, animation STOPS (getAnimations = 0) | ✓ |
| 🦷 `mut-sprite-missing` (a sprite → 404) | **naturalWidth 0 → fidelity CAUGHT** |
| 🦷 `mut-motion-runs-under-reduce` (force animation on under reduce) | **getAnimations ≥ 6 → motion CAUGHT** |

**verify-the-instrument:** the reduce=0 assertion is proven non-vacuous by the SAME `getAnimations` probe reading ≥6
with motion on (run first). The fidelity probe is proven live by `mut-sprite-missing` reading 0.

## Pixel proof @393 (real route · reduced-motion capture = deterministic base positions)
- `harness/pixel-proof/compat-hero-sprites-after.png` — full result with sprites in place.
- `harness/pixel-proof/compat-hero-sprites-vs-figma.png` — beside Figma 636:19061: cluster upper-left + wood on the
  right, clipped at the edges, matching the reference.

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**`, **NO** `constants/api/api-user-matching-*`.
`tsc --noEmit` ✓ · `scripts/*.test.ts` ✓ · ledger-integrity ✓ · run-compat-sprites 11/11 ✓ · run-compat-3c still 17/17
(hero restructured — content wrapped in a z-10 layer; the 3C invariants unchanged).

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING.** Attack points: (1) asset-fidelity — do all 6 really paint, or is one a dead slot? → `mut-sprite-missing`
  bites naturalWidth 0. (2) does the reduced-motion guard actually stop it, or is it decorative? → getAnimations=0 under
  reduce, and `mut-motion-runs-under-reduce` proves the gate catches a dropped guard. (3) do the sprites push the page
  sideways? → 0 overflow-x @393/360/320 (frame overflow-hidden). (4) are they interactive/blocking taps? → aria-hidden +
  pointer-events-none + z below content. (5) forbidden paths? → 0 files.
- **goo** — the sprite art is the same mascot family as the imageUrlV2 pipeline; these are FIXED decoration committed to
  `public/` (ฟีม's call), not from the pipeline. **ฟีม** — chose repo-public + dispatched; positions/motion are Figma-exact.
