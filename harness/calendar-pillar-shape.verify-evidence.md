# verify-evidence — Calendar advanced-pillar 3-layer shape (goo · Phase 3 seam)

**Scope**: a CONTRACT-SHAPE fix on the calendar data layer — `PillarColumn.cells` changes from `string[]`
(one glyph per เสา) to `PillarCell[]` (`{stem, branch, element}` — the 3 layers Figma 634:8752 draws for the
DAY block). Logic/contract seam, NO network, NO designed UI (Lamun owns the advanced screen in 3b). The teeth
are on the shape + fixture self-consistency, not a pixel.

ANCHOR: scripts/calendar-pillar-shape.test.ts#pillar-cell-three-layer-and-stem-element

## Why this is goo's seam, and why now

Recon (มุน, via บอง) found the DAY block renders each of the 4 เสา (ปี/เดือน/วัน/ยาม) as **3 layers** —
天干 stem (top) / 地支 branch (bottom) / 五行 ธาตุ — while `cells: string[]` could hold only one glyph, dropping
2 of 3 layers. Decision (บอง เอน · goo ตัดสิน): **one shared shape**, not per-block, because the bazi engine
sends stem+branch+element for BOTH the natal (MAN) and day (DAY) charts — 四柱八字 is fully populated on both.
The MAN block drawing a single glyph is **presentation**, not a smaller data model; the UI picks how many layers
to draw per `kind`. Splitting the shape (`MAN: string[]`) would force a contract-rewrite the moment the real
bazi payload arrives — exactly the API-time rework this fixes ahead of time.

## proof-of-teeth

Shape tests: `npx tsx scripts/calendar-pillar-shape.test.ts` → **5/5 pass** (baseline). No regression:
`scripts/calendar-phase0.test.ts` stays **18/18**.

Mutation-proven (real source edits, reverted by hand — `git checkout` is a no-op on staged-but-uncommitted work,
lesson from Phase 0):

| # | mutation (real edit in `fixtures.ts`) | expected catch | result |
|---|---|---|---|
| A | `pillarCell` returns `element: ''` (drop the 3rd layer — the string[]-regression shape) | 3-layer-non-empty **and** 五行 tests go red | **CAUGHT — 3/5** |
| B | mislabel `庚 → 'ไฟ'` in `STEM_ELEMENT` (should be ทอง) | 五行 data-correctness test goes red (precise, only that one) | **CAUGHT — 4/5** |

Both reverted → back to **5/5**. `grep MUTANT` clean in `features/` (the only hits are the unrelated pre-existing
`verify-architecture.test.ts` fixtures).

The 五行 oracle in the test is defined **independently** of `fixtures.ts` (not imported), so a change to the
fixture's element map is checked against a second source, not tautologically against itself.

## adversary sign-off

Self-adversary pass (edges tried before hand-off — ตู๋ does the independent review):

- **shape regression (the core class)**: if `cells` silently reverts to `string[]`, `cell.stem` is `undefined` →
  the "all 3 layers as non-empty strings" test fails loudly. `typeof cell === 'object'` is asserted explicitly.
- **data-correctness**: every cell's `element` must equal the 五行 of its `stem` — a mislabel (mut-B) can't sail
  through green even though it is invisible to `tsc` (both are just `string`).
- **structure**: both MAN and DAY blocks present; each has exactly 4 เสา; the DAY block's วัน pillar (index 2) is
  wired to the day's real `ganzhi[0]/[1]` glyphs, not a hardcoded constant.
- **consumer breakage**: `pages/v2/calendar/[date].tsx` (the ONLY consumer of calendar `PillarColumn` on main —
  `calculator` has a separate same-named type, different import, unaffected) is updated to render the 3 layers so
  `tsc --noEmit` stays green. See the NOT-COVERED note below on why that file is temporary.
- **full CI gate reproduced locally**: `tsc --noEmit` clean · all `scripts/*.test.ts` green · ledger-integrity
  (anchor LIVE) · verify-architecture green · `npm run build` green.

**NOT covered (not hidden)**:
- **`pages/v2/calendar/[date].tsx` is a TEMPORARY tsc-guard hunk**, not durable work. On Lamun's #137 branch that
  file no longer references `pillars`/`cells` at all (she removed the advanced-pillars scaffold; §5 belongs to 3b).
  This hunk exists only so the scaffold on `main` does not `tsc`-break tonight. **Merge order matters: #137 first,
  then this PR.** After #137 merges, rebasing this PR drops the hunk (that branch removed the consumer) → the real
  change is 2 files: `types.ts` + `fixtures.ts`. (บอง owns commanding the merge order to ฟีม.)
- **Fixture VALUES are illustrative** (natal เสา glyphs are plausible, not a real chart); element is derived from
  stem so they are internally coherent, but real stem/branch/element arrive from bazi at API-time via the adapter.
- **This is one frame's worth of shape.** The full DayDetail↔6-frame reconciliation (the 5-life-area / lucky-color
  / day-deity gap surfaced on #137) is the deferred single-contract pass after Phase 3-6, not this PR.
