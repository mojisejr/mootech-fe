# G-0a + G-1 — calendar month pipe (pure): adapter · client-fetch · selection rule

**PR:** wave-1 G-0a/G-1 · **Owner:** goo · **Lane:** features/v2-calendar/hooks + scripts (no jอ, no hook-shape change)
**Ledger:** `harness/bug-ledger/` → `g0-month-pipe-adapter`
ANCHOR: scripts/calendar-month-pipe.test.ts#g0-month-pipe-adapter

## What this is (and is NOT)

The three PURE pieces the real hook-wiring will consume, built ahead per บอง's ruling (all sequencing
options use them identically → no rework):

- `hooks/month-adapter.ts` — BFF month day (`lib/v2-calendar/month` shape) → feature `CalendarMonth`.
- `hooks/fetch-month.ts` — client POST to `/api/v2/calendar-month`, total mapping (never throws).
- `hooks/selection.ts` — the selected-day RULE (today-in-view → today, else day 1).

**NOT in this PR (by บอง's ruling):** the real `useCalendarMonth` wiring (`month: CalendarMonth | null` +
`loading` + fetch). That lands **after** μุน's screen handles the 2 states (no-month / full-month), because
making `month` nullable now would red-tsc her `calendar.tsx` (`month.days` on a nullable) and crash it
(`cardDay = … ?? month.days[0]; useDayDetail(cardDay.date)` on empty). So this PR touches **no hook shape
and no type** — it is additive and cannot affect the live calendar page.

## proof-of-teeth — `scripts/calendar-month-pipe.test.ts` (22 assertions, runs in ci `scripts/*.test.ts`)

Negative controls that would flip RED under the bug they guard:

| Bug-class | Assertion (mutant sense) |
|---|---|
| Scoreless-day fabrication | `overallPercent:null → apiDayToFeatureDay = null` (dropped). Had null→0 been fabricated, `assemble` would keep 3 days not 2 and paint a real "0%". Tests: *"null overallPercent → null"*, *"assemble drops scoreless day (2 kept of 3)"*, *"scoreless day is NOT in the flat real-day list"*. |
| Selection ever empty | today-in-view → today; today-not-in-view → **day 1**; today null (pre-mount) → day 1. Had the old `month.days[13]` fallback survived, the not-in-view case would return the 14th, not day 1. |
| Grade 13→10 (vestigial) | 10-level identity (`B+`→`B+`); orphans project (`A+`,`A-`→`A`; `F`→`D-`); null-grade day dropped. Guards against squashing/ dropping the field silently. |
| Fetch not total | `!ok` and thrown fetch both → `{degraded:true, days:[]}` (no reject); success parses days + sends person/userId/month in the body. |

`tsc --noEmit` exit 0 · all 58 `scripts/*.test.ts` green · `verify-architecture.ts` pass · ledger integrity
on the 80-entry dir pass.

## ⚠️ One decision surfaced to บอง (not absorbed silently)

The grid cell's `grade` is **vestigial** — `MonthGrid` colours by `dayCellTier(percent)` and never renders
grade (grep-verified). But the shared `CalendarDay.grade` is the 10-level UI `Grade`, and bazi's day grade
is 13-level. Widening the type ripples into **non-lane** `fixtures.ts` (it reads a `CalendarDay`'s grade AS
a `Grade`) — so บอง's "don't touch the type" holds. The adapter therefore **projects** the 3 orphans
(`A+`/`A-`→`A`, `F`→`D-`) on this display-unused field, loudly commented, and the **authoritative** grade
for anything a user sees stays `DayDetail.grade` where the real 13-level decision is μุน's **M-C**. Flagged
for บอง to redirect if he wants a different call.

## adversary sign-off

- **Not yet reviewed** — awaiting ตู๋ (static/AST). Refute targets:
  1. Can a scoreless day sneak in as a real 0% cell? (claim: no — dropped; 3 assertions.)
  2. Does the selection rule ever return the old "day 14"? (claim: no — day-1 fallback; asserted.)
  3. Does `fetchCalendarMonth` ever reject to the caller? (claim: no — total mapping; 3 assertions.)
- goo self-adversarial: the grade projection IS a 13→10 map — I did not hide it; it is on a vestigial field
  only, documented, and flagged to บอง above. If ตู๋ finds a real consumer of grid `CalendarDay.grade`, this
  projection becomes user-visible and must be revisited (I grep'd and found none).
