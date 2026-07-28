# verify-evidence — ปฏิทินดวง day-detail NORMAL mode (Figma 634:8194) — calendar Phase 3a

Co-located proof for `pages/v2/calendar/[date].tsx` (the designed day-detail body), the `features/v2-calendar/
components/day-detail/*` components + `content.ts` (Figma-frozen presentational content), the shared
`CalendarShell` (nav-seam), and `harness/run-calendar-day.ts`. Phase 3a of the calendar dispatch: the 10
normal-mode sections replace goo's Phase-0 scaffold body; goo's hooks/routing (`useDayDetail` ·
`useAdvancedMode` · `useReminders` · `menuStateForDay` · `/v2/calendar/[date]`) are **unchanged** — the page
only reads them. **No API touched** (mock hooks; 0 app-fetch proven).

## scope — enumerated against the REAL frame, not the brief
The dispatch's "14 sections" was the **advanced** frame's (634:8752) inventory mis-labelled as 3a. Reading the
real `634:8194` (crop-band, per the tall-frame how-to) it has **10 sections ending at เวลามงคล ~2600px** — §5
(ดวงของฉัน) · §9 (ดิถี) · §12 (8 ประตู 八門) · §13 (8 เทพ 八神 — not "9 ดาว") are advanced-only → **3b** (634:8752).
Ground-truth = the rendered reference; บอง confirmed + is fixing the brief/how-to.

## capability → gate
The day-detail screen lives or dies on **which color a grade badge is** (className/tsc are blind to a wrong
hex — esp. the C+ `#374151` contrast exception ตู๋ watches) and on the promise it reaches **no backend**.
Ground-truth = computed pixel color + request-level network capture, never the className.

## the data seam (บอง-approved, Lamun-owned)
Life-area compat rows (§6/§8), the insight line (§7), lucky-colour swatches + day-deity (§10) are **not** in
goo's `DayDetail`. Rather than touch goo's contract overnight, they live in a **Lamun-owned Figma-frozen module**
`features/v2-calendar/components/day-detail/content.ts` — typed in goo's style, with a **TODO header** that at
API-time these fold into the bazi→`DayDetail` adapter (a field-move, not a UI rewrite; mask-first). Lucky-colour
hexes are **sampled from the Figma pixels** (content, not a UI token → **not** added to DESIGN.md, per ฟีม/บอง).
grade/percent/ganzhi/summary/yams DO come from goo's `DayDetail`.

## proof-of-teeth (run-calendar-day.ts against /v2/calendar/2026-07-14 → ✅ PASSED)
| invariant | result |
|---|---|
| no-app-fetch | **0 app-fetch** + **0 console-error** → clean **without booting BE** — goo's shared `trackAppFetches` (request-level, one code path both lenses) |
| grade-badge fidelity | all 8 `[data-grade]` badges' **computed bg == `GRADE_COLORS[grade].accent`**; text white |
| **C+ contrast exception** | C+ badge computed text == **`rgb(55,65,81)` (#374151)** — DESIGN.md, ตู๋'s watch-item |
| off-screen-motion (battery) | **0 running animations** (`getAnimations()==0`) → nothing drains off-screen by construction (static screen, no framer-motion) |
| no-overflow-x @393 | scrollWidth == clientWidth (a day-strip min-width leak was **caught here** and fixed to `min-w-0 flex-1`) |
| 10 sections present | §1·§2·§3·§4·§6·§7·§8·§10·§11·§14 — **10/10** |
| `mut-hardcode-cplus-white` (flip GradeBadge's C+ text to `#FFFFFF`) | C+ fidelity gate rejects → 🦷 **CAUGHT** live |

**Verify-the-instrument (negative control):** before trusting green, the harness forces a live C+ badge to
white in the DOM and re-runs the probe to confirm it **trips** — the C+ check is not vacuous.

## real-route artifact — rendered vs Figma @393
`npx tsx harness/run-calendar-day.ts` + `harness/capture-day.ts` (v2-gated; deterministic mock — no BE).
`compare-day-3a.png` = rendered @393 (state 2 primary-cta, day 15) **side-by-side** with Figma `634:8194`: all 10
sections faithful — header · date strip · lime/navy hero ring + headline + chips + วันพระ · toggle · ความเข้ากัน
(4 rows, ⭐จุดแข็ง, grade-accent bars) · 💡 insight · 4 grade-tint prediction cards (A/B/C+/C-) · lucky colours +
พระกษิติครรภ์ · 5 ยาม + เพิ่มปฏิทิน · CalendarMenu. `day-3a-saved.png` shows §14 state 3 (saved). Per-day
ganzhi/%/grade/ยาม **values** are goo's illustrative mock (differ from Figma's illustrative values — the SHAPE +
section + color fidelity are what this PR proves). tsc clean.

ANCHOR: harness/run-calendar-day.ts#mut-hardcode-cplus-white

## completeness-pass + honest scope (visual-lens clause)
**Bounded reference** = Figma `634:8194` (normal frame) + viewport 393.
1. **Spatial** — whole 2339px column: every one of the 10 sections rendered + looked at, not a hero spot-sample;
   the day-strip overflow was found by sampling the *right edge* of every element (not just the BG).
2. **State-space** — §14 captured in **both** state 2 (primary-cta, a day with no mock reminder) **and** state 3
   (saved, day-14 has mock reminders); mock data, hydration-safe (deterministic route param, no "now").
3. **Reference parity** vs Figma 634:8194 — all 10 sections present + faithful (enumerated, not spot-checked).

**Deviations logged (A2, NOT claimed covered):**
- **§4 toggle default OFF (interim):** 3a uses `useAdvancedMode(false)` so the page renders the normal frame it
  actually builds; **3b restores ฟีม's default-ON** + builds §5/§9/§12/§13 the toggle reveals. The switch flips
  (2-way) but its advanced content is 3b — noted, not a bug.
- **§1 header bell** is a bell glyph; Figma uses the Mate AI mascot in the teal circle — minor chrome, deferred.
- **§14 CTA + §11 buttons** do a real per-ยาม quick-add (goo's `useReminders.add`, de-duped) → menu flips 2→3.
  The full save **sheet** (screen 5 · node 375:13316) is a **separate future screen**, not in 634:8194.
- **Per-day ganzhi/%/grade/ยาม values** are goo's illustrative fixtures — reconciled vs Figma when real bazi lands.
- **nav-seam (folded, ก):** the month view now also renders inside `CalendarShell` → shared CalendarMenu across
  the calendar flow; `AppShell`/`Menubar` untouched (→ /v2/service, /v2/shop unaffected); Phase-2 month anchor
  re-run — **no regression** (31/31 tier, no-overflow, teeth).

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) is the C+ badge truly `#374151` on the rendered pixels, or eyeballed?
  — grade-fidelity reads the **computed** color of every `[data-grade]`, the negative-control proves the probe
  trips, `mut-hardcode-cplus-white` bites; (2) does the mock really reach 0 backend? — goo's request-level
  `trackAppFetches` proves it without a BE; (3) does anything animate off-screen on the 4384-tall class of frame?
  — `getAnimations()==0` (static screen); (4) did I honor the goo seam? — hooks/routing/types untouched, the
  §6/§8/§10 content is in a Lamun-owned module with an API-time TODO, flagged to goo for a shape look.
- **goo — 👀 shape review requested** (บอง routed): `content.ts`'s `DayFortuneContent` shape (compatAreas /
  luckyColors / dayDeity) is the candidate for folding into `DayDetail` at API-time.
