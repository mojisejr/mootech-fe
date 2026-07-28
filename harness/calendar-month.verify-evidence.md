# verify-evidence — ปฏิทินดวง month view (Figma 375:16710) — calendar Phase 2

Co-located proof for `pages/v2/calendar.tsx` (designed month UI), `features/v2-calendar/components/grade-colors.ts`
(the shared color system), and `harness/run-calendar-month.ts`. Phase 2 of the calendar dispatch: the grade grid +
legend + score card + CTA replace goo's Phase-0 scaffold; goo's hooks/routing (`useCalendarMonth` · `dayCellTier` ·
`/v2/calendar/[date]`) are unchanged. **No API touched** (mock hooks).

## capability → gate
The month view lives or dies on **which color a cell is** (className/tsc are blind to a wrong hex) and on the
promise that it reaches **no backend** (done-condition 8). Ground-truth = computed pixel color + request-level
network capture, never the className.

## the shared color system (done-condition 6)
`grade-colors.ts` is the single source: `GRADE_COLORS` (10-step) + `DAY_CELL_COLORS` (3-tier) + `SELECTED` +
`CALENDAR_MARKER`, **every hex copied verbatim from DESIGN.md** (§GRADE + §CALENDAR day-cell), not eyeballed from
Figma. The C+ contrast-exception (`#374151`) is encoded once. Cells pick their tint via goo's `dayCellTier(percent)`;
the score ring picks its accent via `GRADE_COLORS[grade]`. No hex is hardcoded anywhere else.

## proof-of-teeth (run-calendar-month.ts against /v2/calendar → 🟢 PASSED)
| invariant | result |
|---|---|
| no-app-fetch (done-cond 8) | **0 app-fetch** → console-0 **without booting BE** — proven with goo's shared `trackAppFetches` (request-level, one code path both lenses) |
| tier-fidelity | **31/31** cells' computed bg = the DESIGN.md tint for their percent (or the selected sapphire) |
| selected + marker | today cell **sapphire-filled**; **2 วันพระ** cells carry the `#9D85DA` ring |
| no-overflow-x | @ **393 · 360 · 320** |
| `mut-hardcode-tier` (repaint a cell an off-DESIGN color) | tier-fidelity gate rejects → 🦷 **CAUGHT** |

## real-route artifact — rendered vs Figma @393
`HARNESS_HOST=http://localhost:3014 npx tsx harness/run-calendar-month.ts` (v2-gated; deterministic mock — no BE).
`cal-render.png` set side-by-side with `figma-cal-month.png` (Figma 375:16710): month nav · the grade grid (tier
tints · grade badges · %) · day-28 selected (sapphire) · วันพระ rings (10/24) · legend (≥60/40-59/<40/วันนี้) · green
score-ring **B / 75%** + headline + date · sapphire "ดูรายละเอียดวันนี้" CTA — faithful. tsc clean · prod build clean.

ANCHOR: harness/run-calendar-month.ts#mut-hardcode-tier

## completeness-pass + honest scope (visual-lens clause)
**Bounded reference** = Figma `375:16710` + declared viewports 393/360/320.
1. **Spatial** — whole screen: nav row · the full 6×7 grid (every cell tier-checked, not a spot-sample) · legend ·
   score card · CTA.
2. **State-space** — the mock month (goo's constant, hydration-safe) @ **393/360/320**; today-marker fenced (null
   until mount, like goo). Data-invariant (mock).
3. **Reference parity** vs Figma 375:16710 — grid/tiers/markers/legend/score-ring/CTA.

**Deviations logged (A2, NOT claimed covered):**
- **NAV SEAM (flagged to บอง, not resolved unilaterally):** goo's `AppShell` renders an **icon-tab nav with NO Mate
  AI**, but Figma's calendar bottom menu is the **CalendarMenu (state Normal, WITH Mate AI)**. This nav-integration
  seam also intersects ฟีม's pending tab-icon decision — surfaced for coordination, out of Phase-2 (grid) scope.
- **Date selectors** are prev/next arrows + month/พ.ศ. display (goo's cursor API: `goPrev`/`goNext`/`goToday`), vs
  Figma's month/year **dropdowns** — a functional adaptation of the hook that exists (a picker would need more state).
- **Score-card day** defaults to today-if-in-view else the month's reference day (goo's month hook exposes no
  "selected day" for the month view); the CTA routes to that day's detail (Phase 3).
- Exact **per-day ganzhi/%/grade values** are goo's illustrative fixtures (his note) — reconciled cell-by-cell vs
  Figma when the real values land; the SHAPE + color-fidelity are what this PR proves.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) are cell colors truly DESIGN.md-sourced or eyeballed? — tier-fidelity
  checks all 31 computed bgs vs the DESIGN.md constants, `mut-hardcode-tier` bites; (2) does the mock really reach 0
  backend? — goo's request-level `trackAppFetches` (his ECONNREFUSED sharpening) proves it; (3) the nav seam — I
  flagged it rather than paper over it.
- **What I tried to refute myself:** I did not trust "colors look right" — I compared every cell's computed bg to the
  DESIGN.md constant; I did not trust "0 network" by eyeballing the tab — I used goo's request-level tracker; I did
  not silently ship a nav that mismatches Figma — I flagged the AppShell-vs-CalendarMenu seam. **Unproven by me:**
  exact per-day fixture values (goo's, reconciled later) + the nav seam resolution (coordination) — logged A2.
