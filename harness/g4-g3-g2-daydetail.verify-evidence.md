# G-4 + G-3 + G-2-foundation — day-detail fields · chips · client fetch (DRAFT — not done)

**PR:** wave-1 G-4/G-3/G-2 (DRAFT) · **Owner:** goo · branch off g0c (G-0c #186)
**Ledger:** `harness/bug-ledger/` → `g4-g3-g2-daydetail`
ANCHOR: scripts/day-detail-fetch.test.ts#g2-day-detail-fetch-total

## ✅ What is DONE (3 chunks) — proof-of-teeth

### G-4 — expose the day-detail bottom-half fields (`1d4f013`)
The feature `DayDetail` now carries the ครึ่งล่าง fields so μุน's **M-D** can migrate content.ts → detail.*:
- กอง 1 (direct): `compatAreas · advice · insight · dayDeity · spirits · wanPhra`
- กอง 2 (RAW, no transform): `luckyColors` (Thai names, no hex) · `gates` (no good/bad level — ตำราไม่มี) · `dithi` (text)
Sub-types defined in the feature contract (types.ts), matching B-5's lib pipe shapes. mockDayDetail fills
illustrative values → shape is live now.

### G-3 — chips: officer + luckyDirection, cut 財 (`98dce27`)
`luckyDirection` was **not mapped** by our pipe — man-vs-day emits it per day from the `lucky_dir` almanac
column (real ตำรา data, NOT a ranking of the 8 gates; บอง traced it in `src/lib/bazi/manvsday.ts`). Added the
mapping (`lib/v2-calendar/day-detail.ts` + feature `DayDetail.luckyDirection`), sent RAW. The **財 chip is CUT**
— bazi's 8 gates (開休生傷杜景死驚) have no 財 (ฟีม order) — documented as intentional, not forgotten.
`day-detail.test.ts` asserts `luckyDirection ← man-vs-day` (22 assertions total).

### G-2 foundation — day-detail client fetch (`96bdce2`)
`fetchDayDetail(person, userId, date)` → POST `/api/v2/day-detail` → the trimmed lib `DayDetail`. TOTAL
mapping (always resolves; `detail:null + degraded` on any failure; never throws — the anti-latch hook won't
have to catch). Grade-independent. `scripts/day-detail-fetch.test.ts` — 5 assertions (success parse · body
carries person/userId/date · cached passthrough · !ok → degraded · throw → degraded).

Every commit: `tsc --noEmit` 0 · all `scripts/*.test.ts` green · `verify-architecture` pass.

## 🔴 What is NOT done (gated — verified, not predicted)

**G-2 real wiring** couples to two of μุน's pieces on the same v2 surface:
1. **13-level grade → M-C.** The lib→feature adapter must emit `detail.grade`/`yams.grade` as 13-level
   `string|null`, and the card ring's *instant* grade returns to `CalendarDay` as 13-level (บอง's fix after
   his one-consumer grade-delete). Both change the type μุน's `ScoreRing`/`GradeBadge`/`CompatList` read via
   `GRADE_COLORS[grade]` → they compile only once M-C's `gradeColors(string)` code is on main.
2. **Card loading → M-B.** Wiring `useDayDetail` to the async fetch makes `detail` nullable + adds `loading`
   (the anti-latch seam) — the card must handle that state, exactly like the month seam (G-0b). That is μุน's
   M-B, not this PR's lane.

**So this PR is a DRAFT** — the grid/month is real (G-0c #186), the day-detail *fields + chips + fetch* are
ready, but the card does not yet render real day-detail data. Not a finished card.

## 📋 G-2 remaining plan — plug-in points for when M-C lands (so I start immediately)
1. `features/v2-calendar/types.ts` — `DayDetail.grade`, `YamSlot.grade` → `string | null`; add `grade: string|null`
   back onto `CalendarDay` (13-level, for the ring's จังหวะ-1).
2. `features/v2-calendar/hooks/month-adapter.ts` — carry `grade` again (raw string, no projection).
3. NEW `features/v2-calendar/hooks/day-detail-adapter.ts` — lib `DayDetail` → feature `DayDetail`
   (dayGanzhi→ganzhi, overallPercent→percent, grade raw, yams lib→feature, the กอง-1/กอง-2 fields pass through).
   Pure + tested.
4. `features/v2-calendar/hooks/useDayDetail.ts` — async: `useV2User` identity → `fetchDayDetail` → adapter,
   **alive-guard, NO doneRef latch** (mirror useHomeFortune / user-cache), re-fetch on `date` change, expose
   `loading`. **prefetch today** on load. Test: 3 date changes → 3 distinct results (the #97 6-round trap).
5. `pages/v2/calendar.tsx` (μุน M-B) — card ring grade from the month cell (จังหวะ 1), text from useDayDetail
   (จังหวะ 2), handle `loading`. Not goo's lane beyond a minimal compile-guard.
6. Browser verify: change date 3× → 3 sets, **measure real click→render time** (attach numbers), ring never
   blank while text loads.

## adversary sign-off
- **Not yet reviewed** — draft; ตู๋ can pre-read the 3 done chunks. Refute targets: (a) does `fetchDayDetail`
  ever reject to the caller? (claim: no — total, 2 assertions) (b) is the 財 cut a silent omission? (claim:
  no — commented as an intentional ฟีม-ordered cut) (c) does luckyDirection derive from ranking gates?
  (claim: no — raw `lucky_dir` column, บอง-traced).
- goo self-adversarial: I own a scope miss this session (declared wave-1 "done" while G-2/3/4 remained → now
  in the live task list) and a one-`find` bazi diagnosis (fixed by stating scope). The gated parts above are
  called out precisely so this DRAFT is not mistaken for a finished card.
