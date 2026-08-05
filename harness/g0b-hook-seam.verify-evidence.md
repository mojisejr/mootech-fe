# G-0b — useCalendarMonth → locked seam (mock) + minimal calendar.tsx compile-fix

**PR:** wave-1 G-0b (stacked on #181) · **Owner:** goo
**Ledger:** `harness/bug-ledger/` → `g0b-day-detail-requested-date`
ANCHOR: scripts/mock-day-detail.test.ts#g0b-day-detail-requested-date

## What lands here (บอง's re-sequence 2026-08-05)

1. **`useCalendarMonth` now returns the LOCKED seam** — `month: CalendarMonth | null` · `loading` ·
   `selectedDate` · `selectDay` · (unchanged: year · monthIndex · todayISO · goPrev/goNext/goToday). The
   `selection.ts` rule from #181 is now WIRED IN (it was two loose pure functions before — μุน binding to
   the seam then would have tsc-red'd, the deadlock บอง caught).
2. **Cursor starts `null`, resolves to Bangkok-TODAY's month post-mount** (option ก, my call — reasoning
   sent to บอง). Same hydration fence as `todayISO`: server + first client paint both see `null` → identical
   empty HTML → no clock-straddle mismatch. This also matches G-0c's reality (a personalised month is
   client-fetched, can never be SSR'd). **Done-condition met at this mock stage**: `mockCalendarMonth`
   generates any month deterministically, so cursor = ส.ค. → mock August → today in view → highlight +
   card = today. Only the NUMBERS are mock; real bazi arrives at G-0c.
3. **Two "day 14" fallbacks killed** — `month.days[13]` in `calendar.tsx` AND `MOCK_DAYS[13]` in
   `fixtures.ts` (บอง's second catch — a *separate* one). `mockDayDetail` now generates from the requested
   date's own month, so a selection always returns its own date, never a borrowed day.
4. **Minimal `calendar.tsx` compile-fix only** (บอง-authorized): guard `if (!month || !cardDay) return null`
   + drop the `[13]` chain. ❌ No layout, no skeleton — that is μุน's M-A/M-B.

STILL MOCK (finishes at G-0c): the grid/card NUMBERS are mock, not bazi. G-0c swaps `mockCalendarMonth` →
the #181 adapter+fetch and deletes the now-orphan `CalendarDay.grade`.

## proof-of-teeth — `scripts/mock-day-detail.test.ts` (8 assertions, in ci `scripts/*.test.ts`)

| Assertion (mutant sense) | Guards |
|---|---|
| `mockDayDetail('2026-08-05').date === '2026-08-05'` (day 5, ≠ 14) | the exact silent-wrong-day บอง caught — old code returned July-14's date |
| far-month `'2027-12-31'` returns itself · July still itself · asking the 14th returns the 14th | no borrowed identity, no July regression |
| empty/malformed date → no crash, no other day claimed | the page's pre-mount placeholder path |

Plus the selection rule (`#181` — today-in-view→today else day-1, kills the old `days[13]`) is now the
hook's actual selection source. `tsc --noEmit` exit 0 · all 60 `scripts/*.test.ts` green · `verify-architecture` pass.

## ⚠️ Evidence limit (honest — not "looks done")

- **Verified**: the SELECTION and DAY-DETAIL logic (unit tests above), the type/compile contract (tsc), and
  hydration safety **by construction** — server and first client paint both hit the `!month` early-return,
  emitting identical empty HTML, so there is no mismatch to hydrate (the same fenced pattern as `todayISO`,
  already proven on this app).
- **NOT run in a real browser here**: the end-to-end done-condition (open → current month painted, today
  highlighted, card = today, no console hydration error) needs the v2 auth gate + a running build, and the
  calendar page is **outside the CI pixel harness** (`design.contract`/`run.ts` cover the splash surface;
  `run-calendar-*.ts` are standalone, not wired to any workflow — grep-verified). So design-verify will NOT
  exercise this behaviour. A browser pass is the natural next check — I can run it, or it is covered when
  μุน renders M-A/M-B. Flagged so this is not mistaken for a runtime-verified claim.

## adversary sign-off

- **Not yet reviewed** — awaiting ตู๋. Refute targets:
  1. Does any path still return a different day's date as the requested one? (claim: no — generated from the
     requested month; 8 assertions.)
  2. Does the null-cursor first paint hydrate-mismatch? (claim: no — both sides render the early-return
     null; by construction.)
  3. Did the seam shape drift from บอง's lock? (claim: no — month|null · loading · selectedDate · selectDay,
     rest unchanged.)
- goo self-adversarial: I own two misses here — I first claimed "release μุน" when `selection.ts` was not
  wired into the hook (deadlock), and I killed only the *first* `[13]` (page) while `MOCK_DAYS[13]`
  (fixtures) silently survived. Both were caught by บอง reading the code, not by me. The evidence-limit
  section above is deliberately explicit for the same reason.
