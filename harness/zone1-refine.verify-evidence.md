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

## +1 (บอง): the ground-truth ดิถี vocab must NEVER be clipped
ฟีม found on prod (old layout): the element line clipped at ≤360px. **Root cause** = the element line
shared the greeting row with bell+avatar (size-10 each), so it only had ~150px and `truncate` ellipsised
"ดิถีแข็งเกินไป". **Primary fix = the #1 layout restructure** — the element line now sits on its OWN
full-width row BELOW the name+cluster, so at 320 it has ~254px and the worst real vocab renders in **228px
on one line** (measured), fully visible. **Also removed `truncate` → wrap** (defensive: any future longer
vocab wraps to 2 lines instead of clipping — the vocab is a bounded 5-band set, so real cases fit 1 line).

## proof-of-teeth (run-zone1-refine.ts, executed, neg-control-first)
| case | result |
|---|---|
| neg-control clean | date **"1 มิถุนายน 2569"** · divider **dashed** · svgInCard **3** · emoji **false** → all ✓ |
| #1 long name | h1 truncates (**true**) + overflowX (**false**) ✓ |
| +1 worst vocab @360 & @320 | element line NOT clipped (228px), full **"ดิถีแข็งเกินไป"** present, no overflowX ✓ |
| `mut-date-iso` (formatter dropped → raw ISO "2026-06-01") | พ.ศ. gate rejects → 🦷 CAUGHT |
| `mut-divider-solid` (border-dashed dropped → solid) | dashed gate rejects → 🦷 CAUGHT |
| `mut-overflow-clip` (forced over-long line + truncate @320) | clip-detector bites (verify-the-instrument) → 🦷 CAUGHT |
| **formatter reject set** (goo's catch: 2026-06-31 · 2026-06-99 · 2026-13-01 · 2026-02-30 · 2026/06/01 · short) | all → `''` (Date round-trip + shape guard), no "99 มิถุนายน" leak ✓ |
| **@baddate DOM** (date "2026-06-31" → render) | date renders **empty**, NOT raw ISO nor "31 มิถุนายน" → no-leak ✓ |

## completeness-pass (state-space — viewports × data, overflowX=false each)
Rendered + verified: `good` (2026-06-01 → 1 มิถุนายน 2569) · `caution` (2026-02-28 → 28 กุมภาพันธ์ 2569,
cross-month) · `long-name` (truncate) · **worst vocab (ดิน · ดิถีแข็งเกินไป) + long name @393 / @360 / @320**
(บอง's narrowest-readable set — full vocab, not clipped). Date fed as RAW ISO in the mock (matches bazi
/api/home). Icons/dashed dividers eyeballed side-by-side with Figma 333-6567.
**Forcing-question answered**: @430 and other data-variants = A2. Real authed /v2 render = pending backend
(bazi deploy + user session) — same real-route cell as Zone 1, NOT claimed until eyeballed.

ANCHOR: harness/run-zone1-refine.ts#mut-date-iso

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do NOT self-certify.
- **too (static/AST + completeness + D2 gate) — SIGNED OFF 2026-07-25**, ran on `mootech-fe-wt-refine`,
  attacked all 5 + D2, none broke through:
  1. date formatter — confirmed `formatThaiLongDate` returns `''` (no NaN throw) on non-10-char / unparseable
     ISO, and `… || fortune.date` degrades to the raw string → **zero blank-leak**.
  2. dashed divider — `getComputedStyle().borderTopStyle === 'dashed'` is a real tooth (AST-pass ≠ paint);
     mut-divider-solid CAUGHT.
  3. icons — no ⭐/⚠️ leak (`/[⭐⚠️]/` gate); Figma 333-6585/6596 SVG, tone via currentColor.
  4. name edges — long-name truncates with overflowX false; **empty/whitespace name → avatar 'F'**
     (`name.trim().charAt(0) || 'F'`) — an edge I had NOT enumerated (too's catch, holds).
  5. vocab-clip @320/360 — `at320.clipped === false`, overflowX false, full "ดิถีแข็งเกินไป" preserved.
  **D2 gate + refine anchor PASS (6/6 + 3 teeth).** Did NOT touch goo's ElementLine/useHomeFortune.
- **goo (runtime lens) — RUN-PROVEN, found 2 real date leaks (fixed)**:
  1. `formatThaiLongDate` only checked `!day` (0/NaN) → day 32–99 and impossible dates leaked
     ("2026-06-31" → "31 มิถุนายน 2569"). **Fixed**: strict shape guard + `new Date` round-trip rejects
     all out-of-range / impossible / non-ISO to `''`.
  2. caller `… || fortune.date` leaked the RAW ISO when the formatter returned `''` (malformed ISO) —
     violated my own invariant #3. **Fixed**: an ISO-shaped-but-invalid string → hidden (`''`); only a
     non-ISO (already-formatted) string passes through. Anchor widened (formatter reject set + @baddate DOM).
  goo also verified I did NOT touch ElementLine / element prop (reads `element.elementTh` intact).
- **base**: merged origin/main (#106 compute-source) — clean, no conflict; too re-ran harness on the merged
  tree (element row present) + I re-verified @393/360/320 post-merge. (บอง corrected his own "must rebase /
  would regress" over-claim — the merge is clean either way; keeping it since it's verified.)
