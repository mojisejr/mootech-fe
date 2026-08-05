# G-0c — useCalendarMonth on the REAL month pipe (grade deleted · single-fetch identity · wired)

**PR:** wave-1 G-0c · **Owner:** goo
**Ledger:** `harness/bug-ledger/` → `g0c-calendar-real-pipe`
ANCHOR: scripts/user-cache.test.ts#g0c-user-cache-dedup

## What lands (3 commits)
1. **delete `CalendarDay.grade`** — the vestigial grid grade + its 13→10 projection are gone (บอง: delete, not widen). tsc + tests green.
2. **`useV2User` single-fetch identity** — in-flight-only dedup (no stale row = no paid-user-stuck-on-free-gate), 13 adversarial assertions, `isPaid` unchanged for all 4 consumers.
3. **wire `useCalendarMonth` → `/api/v2/calendar-month`** (BFF → bazi man-vs-day + almanac) via the adapter + `useV2User`. State machine resolves every branch; a month change clears the old month FIRST (no stale); `alive`-guard drops stale responses.

## proof-of-teeth — RUNTIME on the real pipe (test-env, never prod)

Stack: pg `localhost:5433` (guard: all DB local), BE `:4000`, **bazi `:3100` from a pdf-dev worktree**
(`bazi-testenv` — `man-vs-day` grade enrichment lives on pdf-dev, and the main clone is another agent's
HEAD, never flipped), FE(g0c) `:3000`. **FE build @capture: `6e7a068`.**

**Browser** (`capture-route --route /v2/calendar --user default` = มิลา, dob 1980-04-05):
`harness/captures/v2-calendar__default__393.png` — **errors=0** (incl. hydration). Shows, on first open:

| Done-condition (ฟีม) | Observed @393 |
|---|---|
| open → **current month** | header `เดือน สิงหาคม · ปี พ.ศ. 2569` (August 2026) ✅ |
| highlight → **today** | grid cell **5** carries the selected fill ✅ |
| grid = **real bazi** | decimal percents (5=45.84%, 10=72.92%, 8=32.09%…), real ganzhi (5=辛亥), real วันพระ rings on **13/20/27** (not the mock's fixed 10/24) ✅ |

**Curl == screen** (บอง's "เลขทุกช่อง == ท่อคืน", 7-day sample). Same pipe, มิลา's REAL row
(`MALE, 08:48, remember_time` — pulled from the test DB; a wrong gender gives different percents, proving the
fortune is truly personalised):

```
POST /api/v2/calendar-month {person: มิลา, userId, month:"2026-08"}   (v2_access cookie)
day        | pipe overallPercent | screenshot | match
2026-08-01 | 51.25 | 51.25 | ✅      2026-08-14 | 73.33 | 73.33 | ✅
2026-08-05 | 45.84 | 45.84 | ✅      2026-08-22 | 72.09 | 72.09 | ✅
2026-08-08 | 32.09 | 32.09 | ✅      2026-08-28 | 28.75 | 28.75 | ✅
2026-08-10 | 72.92 | 72.92 | ✅
```
7/7 exact — the adapter maps pipe→grid with no scale leak. `grep mockCalendarMonth` in the ship path
(`useCalendarMonth`) = **0**. Also green: tsc 0 · all 60 `scripts/*.test.ts` (incl user-cache 13 + pipe) · arch.

## ⚠️ Known interim states this PR INTRODUCES (documented, NOT hidden — บอง's rule)

1. **The bottom card is STILL MOCK.** It shows `B- 71% · 戊子` (mockDayDetail) while grid day-5 shows the
   real `辛亥 45.84%` — they do **not** match. G-0c wired only the GRID/month; the card's ring/%/干支 comes
   from `useDayDetail` (mock), whose real wiring is **G-4 + μุน's M-B** (bind the card to the selected day's
   month cell + the day-detail pipe). Before this PR both were mock and matched; G-0c makes the grid real
   first, so the mismatch is expected and resolves when the card is wired. The card's **dateLine is correct**
   (`วันนี้ · 5 สิงหาคม 2569`).
2. **Blank while the month loads (~7s cold).** The real month is client-fetched, so `month` is null during
   the fetch → the page's minimal guard renders nothing until it arrives. μุน's skeleton (M-A/M-B) covers
   this; this PR does not add a designed loading screen (that is her lane). Goes away when M-A lands.

## adversary sign-off
- **Not yet reviewed** — awaiting ตู๋ (บอง flagged this as the round's heaviest review). Refute targets:
  1. Cross-user bleed in the identity cache? (claim: no — in-flight-only, userId-keyed; user-cache.test 13
     assertions incl. change-userId-never-serves-old-row.)
  2. Grid number ≠ pipe (scale leak)? (claim: no — 7/7 exact above.)
  3. Stale month on month-change? (claim: no — old month cleared before fetch; alive-guard drops stale.)
- goo self-adversarial: I own a diagnosis miss this session — I first concluded "man-vs-day is pdf-dev-only,
  main 404s" from ONE `find`; บอง showed main HAS the route (the real reasons were grade-on-pdf-dev + a
  clerk/node_modules mismatch). Fixed the method (git, not one grep). The card-mock interim above is called
  out precisely so this PR is not mistaken for a finished card.
