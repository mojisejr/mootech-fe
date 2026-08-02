# Verify Evidence — 3B mascot v2 proxy swap (ดวงสมพงศ์ result screen)

**Slice**: 3B (ฟีม 2026-08-02) · **PR**: mootech-fe → main · **base**: 99deb6f
**Change**: `pages/api/bazi/mascot/[ganzhi].ts` reads bazi `imageUrlV2` **exclusively**; a row without it → `{ mascot: null }` (card hides). ❌ Never falls back to the legacy `imageUrl`.

ANCHOR: scripts/compat-mascot-proxy.test.ts#compat-3b-mascot-v2-proxy
ANCHOR: pages/api/bazi/mascot/[ganzhi].ts#imageUrlV2

## What changed (scope)
- **Only** the proxy mapping. Extracted a PURE `mascotFromBaziResponse(data, ganzhi)` that reads `imageUrlV2` and returns `{mascot:null}` on absence.
- `CompatMascotCard` / `CompatResultHero` / `useCompatibilityResult` — **untouched** (they already render `mascot.imageUrl`; the proxy now sources that from the v2 field).
- **NO** `pages/matching/**`, **NO** `constants/api/api-user-matching-*` (git diff = 0).

## proof-of-teeth
The invariant ฟีม cares about: **v2 must never show the old set.** A `imageUrlV2 || imageUrl` fallback is the exact silent regression — a row that has only the legacy image (pointing at paused DEV storage) would leak into v2.

- **Neg-control first (clean)**: `npx tsx scripts/compat-mascot-proxy.test.ts` → **9/9 passed**, including:
  - `imageUrlV2 AND legacy imageUrl both present → uses V2, never legacy`
  - `ONLY legacy imageUrl, no imageUrlV2 → mascot null (old set alone must HIDE)`
- **MUTANT** (re-introduce the forbidden fallback) — `const v2 = data?.imageUrlV2?.trim()` → `... || data?.imageUrl?.trim()`:
  - test drops **9 → 8 passed**; the `ONLY legacy imageUrl → null` assertion trips (returns the OLD url instead of `null`) → **CAUGHT**.
- **Restore** (cp snapshot back) → **9/9 passed** GREEN. No leftover (grep `const v2 =` shows the single-source line).

Mutant method: `cp` snapshot → `perl` mutate → run (RED) → `cp` restore → run (GREEN). Executed 2026-08-02.

## visual — @393, mascot resolved through the REAL chain (EXECUTED 2026-08-02)
The mascot path is exercised against the **live bazi prod deployment — NOT a stub**: fe (real 3B proxy) → `BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app` → prod storage image. Only `/user-matching/detail` (the compat-calc/BE side, out of 3B scope) is intercepted with a fixture that carries the two persons' `dayGanzhi`.

**PROVEN (real, no stub):**
- **The live bazi prod endpoint returns `imageUrlV2`** — the last hop บอง flagged, now closed with the real domain, not assumed:
  - goo (2026-08-02, read-only): `GET https://bazi-sft-dataset.vercel.app/api/bazi/mascot/甲子` → `imageUrlV2: https://soxsccdlsycaevusndro.supabase.co/…/mootech-v2/mascot/01_wood.png` (also 乙丑 · 癸亥).
  - **บอง (2026-08-02, independent — ไม่สุ่ม): ยิง endpoint จริงครบ 60/60 กะจื่อ — `imageUrlV2` ตรงกับ DB ทุกใบ, ทุกตัวชี้ `soxsccdlsycaevusndro/mootech-v2/mascot/`, และ `imageUrl` เดิมครบไม่ถูกแตะ.** ⇒ ท่อนสุดท้ายปิดสมบูรณ์.
  - (The OLD domain `bazichart.mumate.co` still returns only `imageUrl`, no v2 — that deployment is stale; the fe guardrail already forbids it.)
- **Prod storage image loads** (HTTP 200 image/png).
- **The fe 3B proxy is in the loop** (real server route, not mocked) and drives the render.
- **shows** (`harness/pixel-proof/compat-3b-shows.png`): 甲子 + 丙子 → **2 v2 mascots render** in μุน's hero (มิลา wood + ก้อง fire). Runner assert: `v2 mascot imgs on screen: 2`, src = `…/mootech-v2/mascot/01_wood.png`.
- **hidden** (`harness/pixel-proof/compat-3b-hidden.png`): person b = an UNKNOWN ganzhi `甲甲` → the live bazi prod returns **404** → proxy `{ mascot: null }` → ก้อง's card **hidden with no empty frame** (name shows); มิลา still renders. Runner assert: `v2 mascot imgs on screen: 1`.

**NOT covered here (stated plainly, not hidden):**
- `/user-matching/detail` (compat calc + persons/`dayGanzhi`) is **fixture-injected** — that is the BE/matching flow, needs a real matching + burns quota, out of this PR's scope. So the capture proves the mascot half of the screen end-to-end, not the get-detail half.
- The **"a row has legacy `imageUrl` but NO `imageUrlV2` → hide, no fallback"** branch is NOT reproducible on prod (all 60 rows carry v2) — it is proven by the **unit test + mutant** above instead (the authoritative proof of the no-leak invariant).

FE @ `c305dba` + the uncommitted 3B working tree · `BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app` (evidence-records-its-code-version).

## adversary sign-off
- **Owner (goo, runtime/logic lens)**: proxy mapping is teeth-proven pure (mutant above); the mascot half is rendered end-to-end through the REAL bazi prod endpoint + real prod storage (get-detail fixture-injected, stated above — no full-chain overclaim).
- **Requested — ตู๋ (static/AST)**: try to sneak a legacy-`imageUrl` leak past the pure guard (aliasing / a second code path / a truthy-but-old value). Confirm `git diff` touches only the proxy + test + evidence + ledger.
- **Requested — มุน (visual/pixel)**: confirm the hero slot renders the v2 image at the intended geometry and the hidden case leaves NO empty frame at @393.
- Per charter: the owner does not self-certify teeth — ตู๋ + มุน run their lens before merge.
