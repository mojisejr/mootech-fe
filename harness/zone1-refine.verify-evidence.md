# verify-evidence — Zone 1 refine (#1 header · #3 date · #4 icons+dividers)

Co-located proof for `features/v2-home/components/V2HomeScreen.tsx` (Greeting, ScoreRingCard, FortuneChip)
+ `utils/formate-date-thai.ts` (formatThaiLongDate) + `harness/run-zone1-refine.ts`.

## capability → gate
ฟีม's live-verify found 4 gaps vs Figma 333-6545. My compose (#1/#3/#4 — #2 is goo's data wire):
- **#1 header** — h1 was text-2xl (big, wraps on long names) + no upgrade slot → smaller (text-xl) +
  truncate + [อัพเกรด] badge (Figma 477:4543, navy-on-lime). Long name must not overflow or push the cluster.
- **#3 date** — API returns raw ISO "2026-06-01"; the user must read "1 มิถุนายน 2569" (Buddhist era).
- **#4 icons + dividers** — ⭐/⚠️ emoji → ✓ check-circle / ✗ x-circle SVG (Figma 333-6585/6596);
  solid `<hr>` → DASHED dividers (2 horizontal + 1 vertical between chips).
Each renders fine to console/AST but can silently regress the pixels. Ground-truth = rendered glyphs +
computed style + geometry.

## invariant + anchor (`run-zone1-refine.ts`)
Render @393 and assert: date matches พ.ศ. Thai (`\d+ <thai-month> 25xx`, no "-"); in-card divider computed
`border-style === dashed`; card has ≥3 SVGs (donut + 2 chip icons) and no ⭐/⚠️; a long name truncates the
h1 (scrollWidth > clientWidth) with no document horizontal overflow.

## proof-of-teeth (run-zone1-refine.ts, executed, neg-control-first)
| case | result |
|---|---|
| neg-control clean | date **"1 มิถุนายน 2569"** · divider **dashed** · svgInCard **3** · emoji **false** → all ✓ |
| #1 long name | h1 truncates (**true**) + overflowX (**false**) ✓ |
| `mut-date-iso` (formatter dropped → raw ISO "2026-06-01") | พ.ศ. gate rejects → 🦷 CAUGHT |
| `mut-divider-solid` (border-dashed dropped → solid) | dashed gate rejects → 🦷 CAUGHT |

## completeness-pass (state-space @393, overflowX=false each)
Rendered + verified: `good` (date 2026-06-01 → 1 มิถุนายน 2569) · `caution` (2026-02-28 → 28 กุมภาพันธ์
2569, cross-month) · `long-name` (truncate). Date fed as RAW ISO in the mock (matches bazi /api/home).
Icons/dashed dividers eyeballed against the Figma 333-6567 reference (side-by-side).
**Forcing-question answered**: other viewports (320/430) = A2 (multi-viewport). Real authed /v2 render =
pending backend (bazi deploy + user session) — same real-route cell as Zone 1, NOT claimed until eyeballed.

ANCHOR: harness/run-zone1-refine.ts#mut-date-iso

## adversary sign-off
Cross-oracle, I do NOT self-certify. Requesting too (static + D2 gate) + goo (runtime) run-proven attempts:
- too — divider style / icon swap that AST-passes but paints wrong; long-name / RTL / empty-name edge.
- goo — a date the formatter mis-parses (short/invalid ISO, non-ISO) that leaks or blanks.
- **PENDING** run-proven attempts (attach what was tried). Did NOT touch goo's ElementLine/useHomeFortune.
