# EYE PROOF — ดวงสมพงศ์ (compatibility) Slice 2C, RESULT DATA lane (goo)

**Anchor:** `scripts/compatibility-result.test.ts` (pure parse seam, CI)
**PR:** feat/compat-slice2-fe-result-hook · **base:** main `60a4aca`
**Ledger:** `harness/bug-ledger/` → `compat-slice2-result-parse-seam`
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
npx tsx scripts/verify-ledger-integrity.ts harness/bug-ledger/ harness/compat-result.verify-evidence.md  # ✓ (bare, exit 0)
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

## Carry-through: header birthDate/time (บอง's ruling — no BE/bazi change)
Figma header (636:18819) shows each person's **birthdate + time**. Verified the seam does NOT carry it
(get-detail returns user/friend as `{name,surname,picture}` — dob/time dropped; bazi persons are ganzhi;
v1 never rendered a date). บอง's fix (opened `compatibility-api.ts` himself): Slice 1's **CompatPerson already
holds dob/time** (SEAM GAP CLOSED via the friend-detail enrichment), so the birth data is on the client at
calculate time — **carry it, don't re-fetch, don't make the engine echo it**. `calculateCompatibility(person1,
person2, type)` stashes the pair (sessionStorage, keyed by matchingId); `useCompatibilityResult` reads it back
and `applyCarriedBirth` merges `birthDate`/`time` onto `persons.a/b`. Opening the result directly (parked "ล่าสุด"
flow, out of scope) → no stash → birthDate/time stay **undefined** → the header hides the line (rule 4).

## proof-of-teeth
### Pure parse seam + carry (scripts/compatibility-result.test.ts → ✅ 13/13, mutant-proven)
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
| **carry** applyCarriedBirth merges dob/time onto persons position-aligned; pairMatch fields (dayGanzhi) survive | ✓ |
| **carry** empty / whitespace carried dob·time → **undefined** (rule 4: hide, not blank); no-carry → unchanged | ✓ |
| 🦷 **mut-A** `dimensions: pm.dimensions ?? []` (default the absent case) | **absent-dimensions test FAILS → CAUGHT** |
| 🦷 **mut-B** no-pairMatch returns a blank `{persons:{}}` instead of null | **legacy→null test FAILS → CAUGHT** |
| 🦷 **mut-C** carry leaks raw dob/time (drop `.trim() \|\| undefined`) → '' reaches the header | **rule-4 test FAILS → CAUGHT** |

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
- **ตู๋ — ✅ SIGNED-OFF (c726159)** for the original parse seam (5 attack points closed — posted on GitHub PR #152,
  commit-anchored, verified via `gh pr view 152`, NOT written by me here). **⏳ carry-through delta PENDING re-seal**:
  this commit adds `applyCarriedBirth` + the sessionStorage carry + `calculateCompatibility(person1,person2)` — HEAD
  moved, so the seal floats. Delta to re-probe: (6) does empty/whitespace carried dob·time leak '' to the header
  instead of undefined? (7) is the carry position-aligned (a↔a) or can it cross persons? (8) direct-link/no-carry →
  does it strand or show a blank date instead of hiding the line?
- **goo** — data/seam owner; no UI/pixels claimed (μุน's 2E). `calculateCompatibility` has a side effect (creates a log
  + consumes quota) — the button's client state machine (fire-once, error-keeps-user-on-input) is μุน's 2E lane, flagged
  in the hook's doc.
