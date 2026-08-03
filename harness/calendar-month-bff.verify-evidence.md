# verify-evidence — v2 calendar-month BFF (paid personalised fortune + วันพระ overlay)

goo · 2026-08-03 · branch `calendar-month-bff` · lane = logic/BFF (มุน owns the calendar UI; this replaces
her mock `useCalendarMonth` data source — see `harness/calendar-month.verify-evidence.md`).

**What shipped**: two FE BFF routes + one shared lib so the v2 ปฏิทินดวง grid can read per-day data.
- `pages/api/v2/calendar-month.ts` — POST `{person, month, userId}` → **PAID** personalised fortune per day (`resolveMembership` gate) → `{allowed, days:[{date,dayOfMonth,dayGanzhi,overallPercent,wanPhra}]}`. Upstreams (bazi man-vs-day + almanac) run in **parallel**; cached per `(user,month)`.
- `pages/api/v2/almanac-month.ts` — GET `?month=YYYY-MM` → **UNGATED** วันพระ overlay for BOTH tiers (the single วันพระ source — ฟีม answer C = bazi-computed).
- `lib/v2-calendar/month.ts` — pure `parseMonth` · `isWanPhraDay` · `mergeCalendarMonth` · `almanacWanPhraDays` + cached fetchers.

Did **NOT** touch `pages/api/chinese-calendar/month.ts`, μุน's `calendar.tsx`/`grade-colors.ts`, or any sibling (git diff origin/main = only new files).

## proof-of-teeth

Bug-class owned: **วันพระ miscategorisation**. bazi almanac `specialDays[]` mixes religious วันพระ
(`thai-buddhist` · `chinese-religious`) with government holidays (`government`) and secular festivals
(`festival-chinese`). Fixtures are REAL rows curl'd from `bazi-sft-dataset.vercel.app` for 2026-08.

Mutants (cp-snapshot → mutate → run → restore), each must turn the suite RED:

| mutant | change | result |
|---|---|---|
| any-special-day | `isWanPhraDay` → `specialDays.length > 0` | 🔴 RED — `FAIL: government holiday is NOT วันพระ` (2026-08-12 Mother's Day flagged) |
| index-join | `mergeCalendarMonth` joins wanPhra by array index not by date | 🔴 RED — `FAIL: merge joins wanPhra BY DATE not index` |
| (restore) | — | 🟢 `18 assertions passed` |

Neg-control (instrument not vacuous): 18 assertions pass on the real code, incl. `festival+religious`
(2026-08-27, วันพระ hidden behind สารทจีน) = true and `festival-only` = false.

ANCHOR: scripts/calendar-month.test.ts#calendar-month-wanphra-category

## adversary sign-off

Cross-oracle, not self-certified. Claims I want ตู๋ (static/AST) + มุน (contract) to try to REFUTE:
- **category gate** — construct an almanac `specialDays` where a non-religious day flags as วันพระ, or a real วันพระ is missed (co-occurrence / unknown category / casing / non-array). `isWanPhraDay` filters by exact `category ∈ {thai-buddhist, chinese-religious}` Set.
- **by-date join, not index** — the two upstreams (man-vs-day days[], almanac days[]) can differ in length/order; merge keys wanPhra by `date`. A day present in almanac but absent in the fortune (08-12) must NOT leak its flag onto a fortune day.
- **paid fence** — `resolveMembership(userId).isFree` gates server-side; free/expired/unknown/error → `{allowed:false, days:[]}` with **no** bazi call (fail-closed on membership error). A direct hit by a free user must not reach the paid engine.
- **graceful, never 5xx** — bazi unreachable/timeout/4xx → `{degraded:true, days:[]}` (200); almanac miss on the paid path degrades to fortune-without-วันพระ, not a failure.

## evidence limits (what each artifact proves — and does NOT)

**Proven with real data:**
- pure logic — 18 assertions + 2 teeth mutants (above); tsc `--noEmit` exit 0; all 53 `scripts/*.test.ts` green; `verify-architecture` PASS.
- real bazi upstreams curl'd LIVE 2026-08-03: `man-vs-day` month = HTTP200 · 6.8s cold / 3.7s warm · days[] `{date,dayOfMonth,weekday,dayGanzhi,overallPercent,dayStrength}`; `almanac` month = HTTP200 · 3.5s · `specialDays[]` categories confirmed.
- **`almanac-month` handler end-to-end vs REAL bazi** (handler invoked directly, no server): HTTP200 · 3.15s · 31 days · **2026-08-12 (government) wanPhra=false · 08-13 (chinese-religious)=true · 08-27 (festival+religious)=true** · INVARIANT PASS · 2nd call cached = **0ms**. The ungated วันพระ path proven on the real ship path, including the cache.

**NOT covered here (proven by parts, flagged honestly — know-your-evidence-limits):**
- the **paid `calendar-month` route through a booted Next server was NOT curl'd**. Local `next dev` forces `MAINTENANCE_MODE` (middleware rewrites every route → `/maintenance`; env override did not take under local `.env` precedence), and `resolveMembership` needs Supabase + a paid `member_payment` row not available locally. The paid path is proven by its parts: man-vs-day upstream (real curl) + merge (unit+2 mutants) + gate (`resolveMembership`, covered by `usage-core.test.ts` 29 assertions + `home-profile` rule-C 7). **Recommend one curl through a staging/preview deploy with a real paid userId before μุน wires the paid path** — the assembled route + DB gate has not run as a whole on a server.
- **latency**: first view of a new month ≈ 6.8s (upstream man-vs-day) even with parallelism — a product cost (paid users wait; free users get instant chinese_calendar averages). Flagged to ฟีม via μุน; mitigated by per-(user,month) cache (re-view instant) but not eliminated. Proposed as a separate bazi-side optimize task, not blocking this phase.
