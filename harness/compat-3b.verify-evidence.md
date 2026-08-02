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

## visual — full chain (storage → screen) @393 — EXECUTED 2026-08-02
First time the whole path connects: prod storage image → bazi endpoint shape → fe proxy (this change) → μุน's 3C hero slot.
`harness/capture-compat-3b.ts` drives `/v2/service/compatibility/result/*` @393. get-detail is intercepted with a fixture (persons carry `dayGanzhi`); the mascot resolves through the **REAL fe proxy** → a local bazi stub that returns `imageUrlV2` = the **REAL prod public URL** `…/mootech-v2/mascot/01_wood.png` (HTTP 200 image/png, verified). FE @ `99deb6f` + the uncommitted 3B working tree (next dev serves the working tree).

- **shows** (`harness/pixel-proof/compat-3b-shows.png`): persons 甲子 + 丙子 → **2 v2 mascots render** in the hero (มิลา wood + ก้อง fire), images sourced live from prod storage. Runner assert: `v2 mascot imgs on screen: 2`, first src = `…/mootech-v2/mascot/01_wood.png`.
- **hidden** (`harness/pixel-proof/compat-3b-hidden.png`): person b = 乙丑, whose stub row has a legacy `imageUrl` but **NO `imageUrlV2`** → the proxy returned `{ mascot: null }` → ก้อง's mascot card is **hidden with no empty frame** (name still shows); มิลา still renders. Runner assert: `v2 mascot imgs on screen: 1`. This is the no-fallback invariant proven LIVE (乙丑 had a legacy url; it did NOT leak).

## adversary sign-off
- **Owner (goo, runtime/logic lens)**: proxy mapping is teeth-proven pure (mutant above); full-chain visual proven with the real prod image.
- **Requested — ตู๋ (static/AST)**: try to sneak a legacy-`imageUrl` leak past the pure guard (aliasing / a second code path / a truthy-but-old value). Confirm `git diff` touches only the proxy + test + evidence + ledger.
- **Requested — มุน (visual/pixel)**: confirm the hero slot renders the v2 image at the intended geometry and the hidden case leaves NO empty frame at @393.
- Per charter: the owner does not self-certify teeth — ตู๋ + มุน run their lens before merge.
