# EYE PROOF — ดวงสมพงศ์ ก้อน 2G · "ดูดวงสมพงศ์ล่าสุด" (history list, placeholder → real)

**Anchors:** `harness/run-compat-2g.ts` (visual, browser) + `scripts/compat-recent.test.ts` (pure rule-4/D43, CI-executed)
**PR:** feat/v2-compat-2g-recent · base = main · **stacks conceptually after 2F (#154)** — merge order 2F → 2G (บอง-locked)
**Ledger:** `harness/bug-ledger/` → `compat-2g-recent-list` + `compat-recent-rule4-seam`

ANCHOR: harness/run-compat-2g.ts#mut-fake-friend-name
ANCHOR: scripts/compat-recent.test.ts#compat-recent-rule4-seam

## Why 2G exists (ฟีม-ordered)
2F makes the calc wait VISIBLE, so a user who bails mid-wait has **spent the quota but got no result** — and couldn't get back because "ดูดวงสมพงศ์ล่าสุด" was a `ComingSoon` placeholder. 2G is the **safety net**: a reachable history list that re-opens the already-computed result.

## What shipped
- **D37** new route `/v2/service/compatibility/recent` + the same server v2 gate (not-authed → `/v2`).
- **D38** the picker's "ดูดวงสมพงศ์ล่าสุด" button — was `ComingSoon`, now opens the list (**1-line onClick change** in `CompatibilityScreen.tsx`, to keep the 2F overlap minimal — see rule compliance).
- **D39** `useCompatibilityRecent` reads v1 `UserMatchingGetApi(user_id)` (imported, never edited). State-table: no userId → resolved-empty · list → cards · **empty → "ยังไม่มีประวัติ"** · **error → honest fallback** · never an infinite spinner.
- **D40** card = two avatars + type chip + "คุณ & <ชื่อ>". Rule 4: missing name → **"คุณ"** (NOT v1's fabricated `"คุณ & เพื่อน"`); missing avatar → an **initial-letter** placeholder (not a fake photo).
- **D41** a card opens the **already-computed** result — `router.push('/result/<id>')`, NO re-calculate (v1's `onSelectLog` re-calculates → a second quota hit; 2G does not).
- **D42** deep-link into the result from history has no `sessionStorage` carry → the shared result header hides the birthdate line quietly (verified on the result screen from main).
- **D43** a legacy `matching_type` v2 dropped (`BOSS`/`EMPLOYEE`) → the chip is **hidden**, the card still renders + is clickable, the screen does **not** crash.

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; next dev -p 3024
CAPTURE_HOST=http://localhost:3024 npx tsx harness/run-compat-2g.ts    # baseline → 13/13
npx tsx scripts/compat-recent.test.ts                                  # 12/12 (CI-executed)
# tooth: recentCardTitle → return `คุณ & เพื่อน` when name absent (v1's bug) → rule-4 checks TRIP → revert
```
`UserMatchingGetApi` (GET `/user-matching`) + the result read (GET `/user-matching/detail`) are route-mocked → no BE. `pages/matching/**` + `api-user-matching-*` are import-only, never edited.

## proof-of-teeth
**visual (run-compat-2g.ts → ✅ 13/13):**
| invariant | result |
|---|---|
| **D43** all 4 mixed rows render (legacy BOSS did NOT crash the screen) | 4 cards |
| **D40** LOVE chip = "คู่รัก" · FRIEND chip = "เพื่อนร่วมงาน" | exact |
| **D43** legacy BOSS chip HIDDEN (v2 unsupported → no fake label) | chip count = 0 |
| **D40** title with name = "คุณ & ก้อง" | exact |
| **D40** rule-4: missing friend name → "คุณ" (NOT "คุณ & เพื่อน") | exact |
| **D40** rule-4: no fabricated "เพื่อน" anywhere on the screen | ✓ |
| console errors = 0 (incl. **hydration** — see instrument note) | ✓ |
| **D41** card opens the result (navigated to `/result/R-LOVE`) | ✓ |
| **D42** deep-link (no carry) → birthdate line HIDDEN, not fabricated | count = 0 |
| **D39** empty history → "ยังไม่มีประวัติ" (no spinner) | ✓ |
| **D39** error (non-array/`{error}`) → honest fallback (no spinner) | ✓ |
| **D39** no userId → resolved-empty (never stuck on loading) | ✓ |

**pure (scripts/compat-recent.test.ts → ✅ 12/12, CI-executed):** matchTypeLabel (LOVE/FRIEND labelled, BOSS/EMPLOYEE/unknown → undefined = chip hidden), recentCardTitle (name → "คุณ & name"; absent/whitespace → "คุณ", never "เพื่อน"), parseRecentMatches (array → items minus id-less rows; `{error}`/null → `ok:false` fallback).

🦷 **mut-fake-friend-name** — make `recentCardTitle` return `"คุณ & เพื่อน"` when the name is absent (exactly v1's fallback). Both rule-4 checks TRIP (the browser assertion `title === "คุณ"` and the "no fabricated เพื่อน" scan) → **CAUGHT**. Baseline clean → mutant trips only the rule-4 checks (isolated).

## 🔬 instrument note — a real hydration bug the anchor caught
First run: the card click was intercepted by a `<nextjs-portal>` (the **dev error overlay**) and `console errors` showed *"Expected server HTML to contain a matching <span> in <div>"* — a **hydration mismatch**. Root: `useState(!!userId)` — `react-cookie` reads the id cookie differently SSR vs client, so the server rendered one branch (empty) and the client another (loading skeleton). Fixed by starting `loading` **unconditionally true** (the effect resolves the no-userId case), matching the sibling `useCompatibility`. The console-error probe is what surfaced it — a "harmless" warning that was actually blocking every click. Re-run after the fix: console errors = 0, clicks land.

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**` and **NO** `constants/api/api-user-matching-*` (v1 `UserMatchingGetApi` imported+called, never edited). Modified: `CompatibilityScreen.tsx` (**1 line** — the "ล่าสุด" button onClick; kept minimal because 2F edits the same file and merge order is 2F→2G with a rebase, not a hand-resolve — บอง-locked). New: `compatibility-recent.ts` · `hooks/useCompatibilityRecent.ts` · `components/CompatibilityRecentScreen.tsx` · `pages/v2/service/compatibility/recent.tsx` · `harness/run-compat-2g.ts` · `scripts/compat-recent.test.ts` · this evidence. `tsc --noEmit` ✓ · `scripts/*.test.ts` ✓ · ledger-integrity ✓ · architecture ✓ · prod build ✓.

## screenshot
`harness/pixel-proof/compat-2g-1-list.png` (@393) — ‹ ดูดวงสมพงศ์ล่าสุด · 4 cards: คู่รัก/คุณ & ก้อง · เพื่อนร่วมงาน/คุณ & มาลี · (no chip)/คุณ & หัวหน้า [legacy BOSS] · คู่รัก/คุณ [no name → "?" avatar, no fake].

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING.** Points to attack: (1) does a card re-CALCULATE (second quota hit) like v1? — no, `router.push` to the existing result, no calculate call. (2) rule-4 — any fabricated name/avatar/type? — `mut-fake-friend-name` bites; BOSS chip hidden; missing name → "คุณ"; missing pic → initial letter. (3) D43 — does a legacy type crash the list? — 4/4 render, BOSS chip hidden. (4) infinite spinner on empty/error/no-userId? — state-table resolves all three. (5) forbidden paths? — 0 files in pages/matching + api-user-matching (button = 1-line onClick). (6) hydration / identity read? — `useCompatibilityRecent` reads userId via `useCookies([MEMBER_ID])` **exactly like the merged sibling `useCompatibility`** (the architecture guard bans `useCookies` only *inside* `pages/v2/` files, not feature hooks; verify-architecture ✓). The hydration mismatch was from branching the *initial* state on userId — fixed with `loading=true` (matching `useCompatibility`'s `loadingPerson1=true`), console-errors=0 proven. If webgang wants feature hooks moved to `useV2AuthGate`/`useCurrentUser` for identity, that's a broader sweep touching `useCompatibility` too — flagged, not silently diverged.
- **บอง** — locked merge order 2F→2G + the rebase-not-hand-resolve rule for the shared `CompatibilityScreen.tsx` + `bug-ledger/`.
