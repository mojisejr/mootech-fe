# G-4 + G-3 + G-2 — day-detail fields · chips · client fetch + anti-latch hook

**PR:** wave-1 G-4/G-3/G-2 · **Owner:** goo · branch `feat/g4-g2-g3-daydetail` (rebased on main = M-C present)
**Ledger:** `harness/bug-ledger/` → `g4-g3-g2-daydetail`
ANCHOR: scripts/day-detail-fetch.test.ts#g2-day-detail-fetch-total

_(second anchor: `scripts/day-detail-cache.test.ts#g2-day-detail-cache` — the cross-user/anti-stale cache proof.)_

## ✅ What is DONE — proof-of-teeth

### G-4 — expose the day-detail bottom-half fields (`1d4f013`)
Feature `DayDetail` carries the ครึ่งล่าง fields so μุน's **M-D** can migrate content.ts → detail.*:
กอง-1 `compatAreas · advice · insight · dayDeity · spirits · wanPhra` · กอง-2 RAW `luckyColors` (Thai names) · `gates` (no good/bad level) · `dithi`. Sub-types match B-5's lib pipe → pass through structurally.

### G-3 — chips: officer + luckyDirection, cut 財 (`98dce27`)
`luckyDirection` mapped from man-vs-day's `lucky_dir` almanac column (RAW ตำรา, บอง-traced in `src/lib/bazi/manvsday.ts`). **財 chip CUT** — bazi's 8 gates (開休生傷杜景死驚) have no 財 (ฟีม order), documented intentional. `day-detail.test.ts` 22 assertions.

### G-2 foundation — day-detail client fetch (`96bdce2`)
`fetchDayDetail(person, userId, date)` → POST `/api/v2/day-detail` → trimmed lib `DayDetail`. TOTAL mapping (never throws; `detail:null + degraded` on failure). `scripts/day-detail-fetch.test.ts` 5 assertions.

### G-2 grade — grade back on `CalendarDay`, cut `yams.grade` (`0b6640a`)
Ring reads grade **instant from the month cell** (จังหวะ-1) → `CalendarDay.grade: string` (raw 13-level; month-adapter DROPS null-grade days so every survivor's grade is non-null). `YamSlot.grade` cut (bazi luckyHours emits no per-yam quality — traced, no honest source). μุน's M-C `gradeColors(string)` on main consumes the raw level. `calendar-month-pipe.test.ts` updated (grade carried raw / null-grade dropped).

### G-2 hook — `useDayDetail` async, anti-latch + resolved cache + adapter (`3cd49de`)
- **`useDayDetail`** — async: `useV2User` identity → `fetchDayDetail` → `libDayDetailToFeature`. **Anti-latch: per-effect `alive`, NO doneRef** (the #97/#175 6-round trap). Re-fetch on `[date]`, **prefetch today** on mount, returns `{detail, loading}`.
- **`day-detail-adapter`** — lib→feature (rename fields, drop yams grade, omit advanced pillars). G-4 sub-shapes pass through; RAW preserved.
- **`day-detail-cache`** — resolved+inflight. A **RESOLVED** cache is safe here (a day's fortune is deterministic in user+birth+date) — unlike the user row (payment flips = money bug); documented inline. Key = `userId:birthSig:date` (no cross-user leak, no cross-birth stale). Failure never cached. `clearDayDetailCache` (logout) clears BOTH maps.
- **Minimal compile-guards** (บอง-approved, same as G-0b, commented as *not* designed loading states): `calendar.tsx` card ring `detail?.grade ?? cardDay.grade` (month-cell fallback = จังหวะ-1); `[date].tsx` early-returns a bare spinner while `detail` null.
- **`scripts/day-detail-cache.test.ts` — 23 assertions**: cross-user isolation (บอง cond 3 — user-B never served user-A's day), cross-birth key, dedup (concurrent same-key = 1 fetch), resolved-hit-no-refetch, failure-not-cached-retryable, logout-clears-both.

Every commit: `tsc --noEmit` 0 · full `scripts/*.test.ts` suite green · `verify-architecture` pass.

## proof-of-teeth — browser (real ship path) + unit (FE build `3cd49de`, worktree `feat/g4-g2-g3-daydetail`, 0 console errors)
Command: `npx tsx harness/capture-daydetail-g2.ts` · test-env stack booted from THIS worktree (FE cwd verified = `mootech-fe-wt-g4`, DB `localhost:5433` anonymized — not dev/prod; ground-truth checked via `"user"` table, not stack.sh status). User = fake `5c7befb3` (dob 1980-04-05).

**A · ring-first-frame (`g2-ringfirst__detail-pending.png`)** — with `/api/v2/day-detail` STALLED, the calendar card ring painted **grade "C" · 46% · 辛亥** while the **headline sentence was empty** (`headline=""`). Asserted both-at-once (`ring-has-grade=true ∧ text-empty=true`). Ring 46% = the day-5 month cell's 45.84% rounded → ring comes from the month cell, NOT day-detail. After releasing the stall the headline filled ("วันนี้พอไปได้ ไม่หวือหวา (เหมาะ 46%)"). ⇒ จังหวะ-1 is real, not asserted-in-code-only.

**B · anti-latch, 3 distinct sets + real click→render timing** — real DayStrip `<Link>` clicks (client nav = same mounted `[date]` page → `useDayDetail(date)` re-runs):
| date | via | click→render | rendered |
|---|---|---|---|
| 08-05 | initial mount | — | C · 45.84% |
| 08-06 | link-click | **601 ms** | C+ · 51.67% |
| 08-07 | link-click | **413 ms** | B- · 55.41% |

3/3 distinct (grade/%/干支/date all differ). The `B- · 55.41% · 癸丑` ring matches the month grid's day-7 → real detail is self-consistent across surfaces.

**C · latch teeth (`g2-latch__final-should-be-17.png`)** — delayed 08-15's response 2500 ms **past** fast 08-17, fired 15→16→17 back-to-back, held 3.5 s (> the delay). Final url = `/v2/calendar/2026-08-17` and its text == a clean 08-17 read ⇒ the slow-15 response was **dropped** by the alive-guard. A doneRef-latch OR a stale-wins race would have shown 15. The guard has teeth against out-of-order responses, not just against re-firing.

## 🔴 Honest scope — what this PR does NOT do (verified, not hidden)
- **Card-follows-selectedDate = μุน's M-B.** On `/v2/calendar` the card's date is still fixed at today (my minimal compile-guard); clicking a month day does not yet re-point the card. So the anti-latch is proven on the **`[date]` screen** (route-param nav), where it is genuinely reachable — NOT on the card. Once M-B wires `useDayDetail(selectedDate)`, the same guard covers the card.
- **DayStrip shows MOCK %/干支 = μุน's M-D.** In `g2-antilatch__2026-08-07.png` the DayStrip top row reads day-7 as `43% · 庚寅`, inconsistent with the real ScoreRing (`55.41% · 癸丑`, which matches the month grid). DayStrip is not fed the real month yet — a μุน wiring gap, **not** a G-2 defect. G-2's real detail (ScoreRing/summary/date/ganzhi) is correct.
- **Advanced/compat sections** (ความเข้ากัน 5 ด้าน, ดิถี, 8 ประตู/เทพ) still read mock `getDayFortuneContent` — M-D migrates them onto the G-4 fields.

## adversary sign-off
- Refute targets for ตู๋ (static/AST) + มุน (visual): (a) does the cache ever serve one user's day to another? — no, key prefixes `userId`; 23-assertion test incl. explicit cross-user case. (b) is the resolved cache a money-bug like the user row? — no, day-detail is deterministic in user+birth+date (documented); the user row wasn't. (c) does the anti-latch actually drop a stale response, or does it just pass because responses happen to arrive in order? — Part C forces out-of-order (slow-15 last) and the guard drops it. (d) is "ring-first-frame" real or an artifact of a fast fetch? — Part A stalls the fetch so the transient state stands still; asserts grade-present ∧ text-empty. Try to sneak a bug-class past these on a real run + attach what you tried to refute.
- goo self-adversarial: the DayStrip mock-vs-real inconsistency is called out above so the screenshot is not read as a G-2 bug; the card/M-B boundary is stated so this is not mistaken for a finished card.
