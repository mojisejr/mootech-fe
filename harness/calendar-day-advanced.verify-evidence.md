# verify-evidence — ปฏิทินดวง day-detail ADVANCED mode (Figma 634:8752) — calendar Phase 3b

Co-located proof for `pages/v2/calendar/[date].tsx` (toggle restored default-ON + 4 advanced sections wired),
`features/v2-calendar/components/day-detail/{MyChart,Dithi,EightGates,EightDeities}.tsx` + `content.ts`
(extended), and `harness/run-calendar-day-advanced.ts`. Phase 3b of the calendar dispatch: 4 advanced-only
sections appear when the toggle is ON (§5 ดวงของฉัน · §9 ดิถี · §12 8 ประตู 八門 · §13 8 เทพ 八神); toggling OFF returns
the **exact** 3a normal frame (634:8194). goo's hooks/routing/contract are **unchanged** — the page only reads
`useAdvancedMode` (default ON) + `detail.pillars` (goo's PillarCell 3-layer, #138). **No API touched**.

## capability → gate
Two things this screen lives or dies on that className/tsc are blind to: (1) the toggle is a **real 2-way state**,
not two static images — OFF must genuinely unmount the 4 sections AND leave 3a un-distorted (บทเรียน #130
การ์ดร่วม); (2) §5 must **bind goo's `detail.pillars`**, not hardcode glyphs (the DAY วัน column carries the day's
real ganzhi). Plus: the frame is ~2× taller than 3a, so **off-screen-motion + overflow are RE-checked here** —
3a's green does NOT cover this height. Ground-truth = the rendered DOM/computed-style + request-level network.

## §5 binds real data · §12 tints are DESIGN.md tokens (no new hex)
`MyChart` reads `detail.pillars` (PillarColumn[] of goo's PillarCell{stem,branch,element}): MAN draws 1 layer,
DAY draws 3 (stem/branch/ธาตุ) — the anchor asserts every rendered stem == `mockDayDetail(date).pillars`.
§9/§12/§13 copy is Figma-frozen in `content.ts` (+ TODO → adapter, same as 3a). **Colours are all DESIGN.md
tokens**: §12 gate tints reuse §CALENDAR day-cell tiers (the Figma pixel tints ≈ good #E2F4F6 / medium #FEF1E0 /
bad #FEE7E4 by the gate's auspiciousness), the day's own direction (財 · ทิศ W) is the sapphire highlight
(SELECTED #1455A4); §9 dot colours reuse the tier text; §5 block bgs are palette tints (endeavour-100 #E3ECFB /
lemon-chiffon #F9F4F0). **No color was invented** — nothing entered DESIGN.md.

## proof-of-teeth (run-calendar-day-advanced.ts against /v2/calendar/2026-07-14 → ✅ PASSED)
| invariant | result |
|---|---|
| no-app-fetch + console | **0 / 0** without a backend |
| toggle DEFAULT ON | §5 · §9 · §12 · §13 **all present** |
| **§5 binds detail.pillars** | rendered MAN stems `庚戊甲丙` + DAY stems `壬丁丙丙` **== `mockDayDetail(date).pillars`** (day column = real ganzhi) |
| §12 grid | **9 gate cells**, **exactly 1** sapphire highlight (財 · ทิศ W) |
| off-screen-motion (tall frame) | **0 running animations** on the **3840px** screen (`getAnimations()==0`) |
| no-overflow-x @393 (tall frame) | ✓ (RE-checked — 3a didn't cover this height) |
| **toggle 2-way** | OFF → §5/§9/§12/§13 **all GONE** (real unmount) → click ON → **return** |
| **OFF == 3a (no-regression, #130)** | OFF → the **10 base sections remain** · C+ badge **#374151** still holds · 0 overflow · 0 animations · height **2339px == 3a exactly** |
| `mut-hardcode-pillar` (hardcode a §5 glyph instead of `detail.pillars`) | §5 binding gate rejects → 🦷 **CAUGHT** live |

## real-route artifact — rendered vs Figma @393, BOTH modes
`npx tsx harness/capture-3b.ts` → `compare-3b-advanced.png` (rendered advanced ON | Figma 634:8752 — all 14
sections: §5 pillars, §9 dithi, §12 3×3 gates w/ navy 財 highlight, §13 8-deity list, faithful) +
`compare-3b-normal.png` (toggle OFF | Figma 634:8194 — identical to the merged 3a). Per-day values are goo's
illustrative mock; the SHAPE + section + colour-token fidelity are what this PR proves. tsc clean.

ANCHOR: harness/run-calendar-day-advanced.ts#mut-hardcode-pillar

## completeness-pass + honest scope (visual-lens clause)
**Bounded reference** = Figma `634:8752` (advanced) + `634:8194` (the toggle-OFF target) + viewport 393.
1. **Spatial** — the whole 3840px advanced column: all 14 sections rendered + looked at (not a hero spot-sample).
2. **State-space** — captured in **both** UI-states (advanced ON + toggle OFF); the toggle transition is exercised
   live (ON→OFF→ON), not assumed. Data-invariant (deterministic mock, hydration-safe).
3. **Reference parity** — advanced frame enumerated vs 634:8752 (all 4 new sections present + faithful); the
   OFF state enumerated vs 634:8194 + the merged 3a (10 sections + C+ #374151 + no-overflow — proven no-regress).

**Deviations logged (A2, NOT claimed covered):**
- **§5 DAY block** renders stem/branch/ธาตุ per goo's `PillarCell`; per-column **values** are goo's illustrative
  fixtures (day column = real ganzhi, rest illustrative) — differ from Figma's illustrative glyphs.
- **§12 gate tints** map each gate's auspiciousness → DESIGN.md day-cell tiers (the Figma pixel tints are within a
  few RGB of the tokens); if the design later wants bespoke per-gate hues, that's a DESIGN.md proposal (not this PR).
- **§13** "8 เทพ" header + 8 rows per the frame; keyword copy verbatim from Figma.
- §1 header bell (bell glyph vs Figma mascot) carried over from 3a — minor chrome, deferred.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) is the toggle real 2-way or 2 static images? — the anchor clicks
  OFF→ON and asserts unmount+return; (2) does OFF distort 3a? — asserts the 10 base sections + C+ #374151 +
  0-overflow + height==2339 in the OFF state (no-regression, #130); (3) does §5 hardcode glyphs? —
  `mut-hardcode-pillar` bites, stems asserted == `mockDayDetail.pillars`; (4) off-screen motion on the taller
  frame? — `getAnimations()==0` on the 3840px screen (static, no framer-motion); (5) new colours? — every hue is
  a DESIGN.md token, none entered DESIGN.md.
- **goo** — §5 consumes his `PillarCell` (#138) directly from `types.ts`, no contract touched.
