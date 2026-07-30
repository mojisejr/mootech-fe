# EYE PROOF — ดวงสมพงศ์ (compatibility) Slice 2C, RESULT DATA lane (goo)

**Anchor:** `scripts/compatibility-result.test.ts` (pure parse seam, CI)
**PR:** feat/compat-slice2-fe-result-hook · **base:** main `60a4aca`
**Ledger:** `harness/bug-ledger.json` → `compat-slice2-result-parse-seam`
ANCHOR: scripts/compatibility-result.test.ts#compatibility-result-parse-seam

## What this PR is (and is not)
goo's lane only: the **result DATA seam** for the ดวงสมพงศ์ result screen — the hook + pure parser + mascot
proxy + the typed contract μุน's 2E screen renders. **No UI/pixels** (μุน's 2E). Deliverables:
- `features/v2-service/compatibility-result.ts` — PURE parse of the v1 get-detail response → the `CompatibilityResult`
  contract (overall / dimensions[] / persons.a·b / elementInteraction), + `mascotGanzhiPair`.
- `features/v2-service/hooks/useCompatibilityResult.ts` — reads `UserMatchingGetDetailApi`, parses, fetches the 2
  mascots (race-guarded, no-strand); + `calculateCompatibility` (thin v1-wrap → matching_id, closes the loop for μุน).
- `pages/api/bazi/mascot/[ganzhi].ts` — GET proxy to bazi's mascot endpoint (BAZI_BASE_URL is server-only; graceful).

Depends on **Slice 2B** (PR #14): the BE stores the whole pair-match blob as a JSON string under
`log_matching.result` as `{ me, you, result, pairMatch }`; the v1 get-detail wrapper returns it under `.result`
(v1 itself does `JSON.parse(response.result)` — we mirror that). The rich fields live under `.pairMatch`.

## Run commands (reproduced the FULL ci.yml gate locally — not just tsc+build)
```bash
npx tsc --noEmit                                        # ✓
for f in scripts/*.test.ts; do npx tsx "$f"; done       # ✓ incl. scripts/compatibility-result.test.ts (9/9)
npx tsx scripts/verify-ledger-integrity.ts harness/bug-ledger.json harness/compat-result.verify-evidence.md  # ✓ (bare, exit 0)
npx tsx scripts/verify-architecture.ts                  # ✓
npm run build                                           # ✓ (route /api/bazi/mascot/[ganzhi] present)
```

## D14 — seam verified BEFORE handing the contract to μุน (Slice 1's lesson)
- **mascot endpoint EXISTS** (opened the file): bazi `src/app/api/bazi/mascot/[ganzhi]/route.ts` → `{ ganzhi, nameTh,
  nameEn, imageUrl }`, 404 `{error}` when no mascot for that ganzhi. The proxy maps 404/5xx/timeout → `{ mascot: null }`.
- **rich fields EXIST at the seam**: they are exactly the fields Slice 2B stores under `pairMatch` (overall,
  dimensions, persons.{a,b} incl `fourPillars` + `timeKnown`, elementInteraction incl `aToB`/`bToA`) — verified against
  the 2A route response + the 2B mapper. The parser is unit-proven to extract them from the stored JSON string.
- **day-ganzhi for mascots** comes from `persons.{a,b}.dayGanzhi` (2A profile field) — present, non-fabricated.

## proof-of-teeth
### Pure parse seam (scripts/compatibility-result.test.ts → ✅ 9/9, mutant-proven)
| invariant | result |
|---|---|
| parses overall / persons / elementInteraction (+ fourPillars.element, timeKnown) from the get-detail JSON **string** | ✓ |
| **D12** dimensions pass through VERBATIM — same length + order (love=5 / colleague=4 as-is), `sising` untouched | ✓ |
| **D13** absent `dimensions` → **undefined** (NOT default `[]`) — screen can tell "no data" from "empty" | ✓ |
| **D13** absent overall / elementInteraction / persons.b → **undefined** (not '' / 0) | ✓ |
| `result` not a string / null / `{}` → **null** (no crash) | ✓ |
| malformed JSON string → **null** (no throw) | ✓ |
| legacy result with no `pairMatch` (non-bazi engine) → **null** (hook shows fallback, not a blank rich screen) | ✓ |
| `mascotGanzhiPair` extracts both dayGanzhi; absent / whitespace-only → **undefined** (no fabricated ganzhi) | ✓ |
| 🦷 **mut-A** `dimensions: pm.dimensions ?? []` (default the absent case) | **absent-dimensions test FAILS → CAUGHT** |
| 🦷 **mut-B** no-pairMatch returns a blank `{persons:{}}` instead of null | **legacy→null test FAILS → CAUGHT** |

Both mutants were RUN (not reasoned): each turned the suite red on exactly the assert that owns that behaviour, then
`compatibility-result.ts` was restored and the suite re-confirmed green (9/9). The teeth are not vacuous.

## 🔴 done-condition #15 — forbidden paths UNTOUCHED
`git diff --name-only origin/main...HEAD` contains **ZERO** `pages/matching/**` and **ZERO**
`constants/api/api-user-matching-*`. The v1 functions (`UserMatchingGetDetailApi`, `UserMatchingCalculateApi`) are
**imported and called**, never edited. (Command + output pasted in the PR description.)

## Reachability (built ≠ reached — stated, not hidden)
The hook + parser + proxy are the **seam for μุน's 2E result screen**; they are reachable the moment 2E imports
`useCompatibilityResult` and renders the contract (same goo→μุน split as Slice 1's skeleton). The mascot proxy route
is a real `pages/api` endpoint (reached at runtime by the hook's fetch). No page imports the hook yet — that is 2E.

## Runtime end-to-end (deferred, honestly)
The full path (real matchingId → real render of the rich screen + live mascots) needs **2B merged/deployed + μุน's 2E
screen + a running stack**. This PR proves the **data seam** (parse contract + mascot proxy + calculate wrap) at the
unit level and verifies the seam's data exists at the source. Same partial-path honesty as Slice 1 (logic proven; the
live render lands in μุน's UI PR).

## 🔎 dig findings → บอง (the 2 "ขุดระหว่างทาง" questions, answered)
1. **"สิ่งชี้นำสัญลักษณ์: เสือขาว"** comes from **`dimensions[].sising`** (`{ code, nameTh, summary }`, per-dimension) —
   NOT `persons.stageTh`. So it is a **per-dimension** hint, present only when that dimension's matrix cell has a
   `sisingCode`; `sising` is `null` otherwise → the block hides itself (rule 4). Contract carries it as
   `CompatDimension.sising`. μุน renders the hint from the dimension, not from the person.
2. **"ภาพรวม" ข้อความยาว** = **`overall.ratingText`** (the 2A route sets `overall.ratingText = mainFacet.ratingText`) —
   NOT a new blob. Same string the v1 result note reads. Contract carries it as `CompatOverall.ratingText`.

## Contract handed to μุน (what is optional — everything)
Every field on `CompatibilityResult` is optional and defaults to **undefined** when absent — the screen decides to hide.
`dimensions` is verbatim (variable length; never reordered/padded). `persons.{a,b}.timeKnown === false` → show "—" for
the hour pillar. `mascotA/mascotB` may be `undefined` (no ganzhi / not fetched) or `null` (404) → hide the card.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify (charter: ฟันอยู่ในมือ oracle อื่น). Seal must be posted on
GitHub + anchored to a commit, not written here.
- **ตู๋ — ⏳ PENDING** (this PR opened; `maw hey too` sent). Attack surface to probe: (1) does an absent field leak a
  default '' / 0 / [] that makes the screen render a fake block? (2) is `dimensions` ever reordered/padded? (3) does a
  malformed / legacy result throw or strand instead of resolving null? (4) is any forbidden path touched? (5) does the
  mascot proxy ever throw at the user instead of `{mascot:null}`?
- **goo** — data/seam owner; no UI/pixels claimed (μุน's 2E). `calculateCompatibility` has a side effect (creates a log
  + consumes quota) — the button's client state machine (fire-once, error-keeps-user-on-input) is μุน's 2E lane, flagged
  in the hook's doc.
