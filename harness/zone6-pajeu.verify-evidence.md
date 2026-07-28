# verify-evidence — Zone 6 เรียนปาจื่อ (mindful-moments-section · Figma 375:14147)

Co-located proof for `features/v2-home/components/sections/PajeuSection.tsx` and `harness/run-zone6-pajeu.ts`.
Zone 6 **reuses** the shared `<HabitCard/>` (Figma `375:14151` === Zone 4's `333:6889` — the card, both mascots,
book-frame, and 3-piece cohort motion are already proven by `run-zone4-motion.ts`). This section = header +
that card, differing from Zone 4 **only** in: header copy · a 2-line card title (140-tall text box) · a **tertiary**
CTA (ดูรายละเอียดเพิ่มเติม, 171×36) · **no** 3-card row / no bottom CTA. New file per the sections/ split policy.

## capability → gate
The motion/card fidelity is inherited (anchored on the shared component). What is NEW — and what this anchor owns —
is every way a copy-paste of Zone 4 would be **silently wrong** for Zone 6 while className/tsc/console stay green:
wrong CTA variant (a filled sapphire pill instead of the bordered tertiary), a stray/duplicated pastel-blue card row,
a 1-line title (missing `<br/>`) that reflows the card, a mascot that doesn't paint, or the shared motion failing to
attach in *this* section. Ground-truth = computed style + rendered geometry + `getAnimations()`, never the className.

## Phase-0 asset pairing (image-verified — no new export)
The card's assets are `zone4/mascot-sian.png` + `zone4/mascot-leaf.png` **reused byte-for-byte** (บอง confirmed on the
branch; the card is the same component). The white book-frame is CSS. **0 new files** — well under the 20-file / 5 MB
tripwire. (Zone 5's big mascot is the one still-open pairing question — that is PR 3, not this PR.)

## proof-of-teeth (run-zone6-pajeu.ts, executed against real /v2/home-preview → 🟢 PASSED)
| invariant | result |
|---|---|
| cta-variant | single **TERTIARY** CTA (computed `border≥1` + transparent fill + `type=button`), label = ดูรายละเอียดเพิ่มเติม `[count=1]` |
| no-3-card-row | **0** `.bg-v3-pastel-blue` cards in the section (Zone 4 has 3) |
| title-2-line | card title renders on **2** line boxes (rendered height / line-height) |
| asset-fidelity | **2/2** mascots paint (naturalWidth>0), broken=[] |
| motion-in-context | shared cohort `.hc-big/.hc-small/.hc-frame` **attach a running animation in this section** `[✓✓✓]` — reuse is live, not decorative |
| no-overflow-x | page not scrolling sideways @ **393 · 360 · 320** |
| `mut-cta-filled` (strip border + fill the CTA → simulate a primary variant slipping in) | cta-variant gate rejects → 🦷 **CAUGHT** |
| `mut-card-row` (inject a pastel-blue card into the section) | no-3-card-row gate rejects → 🦷 **CAUGHT** |

## real-route artifact — rendered vs Figma reference @393
`HARNESS_HOST=http://localhost:3010 npx tsx harness/run-zone6-pajeu.ts` (branch FE on :3010, deterministic
home-preview — no BE needed; Zone 6 makes no API calls). Rendered section captured under reducedMotion @393
(`z6-render.png`) and set **side-by-side against the Figma `375:14147` screenshot** (`figma-zone6.png`, sent to
ฟีม·บอง): header (เรียนปาจื่อ + 2-line subtitle) · card (gradient · book-frame · water-rooster bottom-left · leaf
sprite over book top **in the correct orientation** — the PR-1 compose-order fix carries in via the shared card) ·
2-line title เรียนปาจื่อออนไลน์ / ในงบ 265 บาท · 2-line desc · sapphire-outline tertiary CTA · **no card row** —
faithful. The small-mascot-over-title-start overlap **matches Figma's own geometry** (metadata: mascot x177 sits over
the text-column x183), not a defect.

ANCHOR: harness/run-zone6-pajeu.ts#mut-cta-filled

## completeness-pass + honest scope (visual-lens clause — enumerated, not spot-checked)
**Bounded reference** = Figma `375:14147` + declared viewports (393/360/320). **Scaled stakes** = shipping card → core axes.
1. **Spatial** — sampled the whole section: header (title + 2-line desc), card (both mascots + book-frame + 2-line
   title + 2-line desc + tertiary CTA). Not one region.
2. **State-space** — **viewports** 393 (Figma-exact) · 360 · 320 (no overflow-x). Zone 6 is **data-invariant** (static
   copy, identical per user). **Motion** proven attaching (motion-in-context) — full motion behaviour is anchored on the
   shared component in PR 1 (`run-zone4-motion.ts`), not re-litigated here.
3. **Reference parity vs Figma 375:14147** — header · card title (2 lines) · card desc (2 lines) · tertiary CTA label ·
   absence of the 3-card row · both mascots present. Copy read from the Figma screenshot, not guessed.

**Deviations logged (A2, not claimed covered):**
- **Full-page seam** (Zone 5→6 spacing, last-content-not-under-nav) is **PR 3**, not verified here — this PR self-verifies
  the section in isolation (บอง: self-verify in-PR, don't defer the section's own gate; the page-end seam is a separate gate).
- Card **motion fidelity** (exact sway) is inherited from PR 1 + ฟีม's eye — this anchor only proves the motion **attaches**
  in Zone 6, not the degree values.
- The old generic `ServiceSection` placeholder is now **unused** (superseded, kept per Rule 1) — flagged to ฟีม/บอง for a
  removal decision; not deleted here.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ (static/AST + D2 + Figma-deviation lens) — ⏳ PENDING** this PR (stacked on PR #130, which ตู๋ signed 100%).
  Points to attack: (1) is the CTA genuinely the tertiary variant by *pixels*, not just className? — read from computed
  border + background; (2) did the reuse actually wire the motion, or is it a dead class? — motion-in-context asserts a
  running animation in this section; (3) any Zone 4 regression from a second card on the page? — both Zone 4 anchors
  green with Zone 6 present (scoped by heading).
- **What I tried to refute myself:** attacked the CTA check with `mut-cta-filled` (a primary pill slipping in) → caught;
  attacked the structure with `mut-card-row` (a stray card) → caught; and I did **not** trust "reuse = correct" — I
  pixel-compared the render to Figma and asserted the motion *attaches* in-context. **Unproven by me:** the full-page
  Zone 5→6 seam (PR 3) and exact motion-degree fidelity (ฟีม's eye) — logged A2, not claimed covered.
