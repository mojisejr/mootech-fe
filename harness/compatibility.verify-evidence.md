# EYE PROOF — ดวงสมพงศ์ (compatibility) Slice 1, LOGIC lane (goo)

**Anchor:** `scripts/compatibility.test.ts` (pure, CI) + `harness/run-compatibility.ts` (real route, FE-only)
**PR:** feat/v2-compatibility-slice1-logic · **base:** main `33ec503`
**Ledger:** `harness/bug-ledger.json` → `compatibility-slice1-kind-gate-and-createfriend-gap`
ANCHOR: scripts/compatibility.test.ts#compatibility-kind-gate-and-createfriend-gap

## What this PR is (and is not)
goo's lane only: the **route + gate + hook + v1-wrap** for ดวงสมพงศ์ Slice 1 — a **layer over v1**, v1 UNCHANGED.
μุน's follow-up PR composes the real V3 screen (Figma 480:4549 / 636:18451 / sheet 636:18533) over the same
hook; `CompatibilityScreen.tsx` here is a **logic skeleton** (contract made visible with `data-testid`s), not the
final UI. Deliverables: `features/v2-service/compatibility.ts` (pure kind gate), `compatibility-api.ts` (pure
create-friend arg map), `hooks/useCompatibility.ts` (person state + v1 wrap), `pages/v2/service/compatibility/[kind].tsx`
(SSR gate), `services.ts` (2 cards rerouted).

## Run commands (reproduced the FULL ci.yml gate locally — not just tsc+build)
```bash
npx tsc --noEmit                                        # ✓
for f in scripts/*.test.ts; do npx tsx "$f"; done       # ✓ incl. scripts/compatibility.test.ts (7/7)
npx tsx scripts/verify-ledger-integrity.ts harness/bug-ledger.json harness/compatibility.verify-evidence.md  # ✓
npx tsx scripts/verify-architecture.ts                  # ✓
npm run build                                           # ✓ (route /v2/service/compatibility/[kind] present)
# real-route eye-proof (FE dev on :3013 with V2_PREVIEW_KEY):
CAPTURE_HOST=http://localhost:3013 npx tsx harness/run-compatibility.ts   # ✓ 9/9
```

## proof-of-teeth
### A. Pure gate + gap-fill (scripts/compatibility.test.ts → ✅ 7/7, mutant-proven)
| invariant | result |
|---|---|
| love → title "ดูดวงคู่รัก" + **matching_type LOVE** (the VALUE, done-cond #2) | ✓ |
| colleague → title "ดูดวงเพื่อนร่วมงาน" + **matching_type FRIEND** | ✓ |
| love vs colleague send **different** matching_types | ✓ |
| unknown / wrong-case / '' / **prototype keys** (constructor, __proto__, toString) → **null** (drives the redirect) | ✓ |
| COMPATIBILITY_KINDS === [love, colleague] (BOSS/EMPLOYEE removed per ฟีม) | ✓ |
| buildCreateFriendArgs → v1 8-arg signature exactly | ✓ |
| the 2 GAP fields carry DOCUMENTED defaults in the RIGHT positions (surname '' @3, gender 'MALE' @5) | ✓ |
| 🦷 **mut-A** drop allow-list guard (`CONFIG[raw]`) → `'constructor'` returns a truthy prototype member | **unknown-kinds test FAILS → CAUGHT** |
| 🦷 **mut-B** swap surname↔gender positions | **both gap-position tests FAIL → CAUGHT** |
| 🦷 **mut-C** mislabel love→FRIEND | **love + different-types tests FAIL → CAUGHT** |

All three mutants were RUN (not reasoned): each turned the suite red on exactly the asserts that own that behaviour,
then the files were restored and the suite re-confirmed green (7/7). The teeth are not vacuous.

### B. Real-route ship-path (harness/run-compatibility.ts → ✅ 9/9, FE-only, no BE)
| invariant | result |
|---|---|
| `/v2/service/compatibility/love` → title "ดูดวงคู่รัก" + `data-matching-type="LOVE"` on the real SSR route | ✓ |
| `/v2/service/compatibility/colleague` → "ดูดวงเพื่อนร่วมงาน" + `FRIEND` | ✓ |
| `/v2/service/compatibility/boss` (unknown) → **redirect to /v2/service** (ห้ามเงียบ) | ✓ |
| no v2 cookie → **redirect to /v2** (auth gate holds on this page too) | ✓ |
| "ดูผลลัพธ์เลย" button **disabled** when person2 empty (done-cond #5) | ✓ |
| person1 **no-strand**: BE unreachable → resolves to the real cookie name, NOT a spinner, NOT fabricated | ✓ |

The browser checks read the SAME resolveCompatibilityKind output the pure mutants attack (data-matching-type), so
mut-C would fail check B too — the real-route proof is mutant-covered transitively, not a separate green surface.

## 🔴 done-condition #6 — v1 UNTOUCHED (the slice's iron rule)
`git diff --name-only origin/main...HEAD` contains **ZERO** `pages/matching/**` and **ZERO**
`constants/api/api-user-matching-*`. The v1 functions (UserGetById, MemberWithFriendCreateApi) are **imported and
called**, never edited — importing a module does not modify its file. (Command + output pasted in the PR description.)

## 🔶 The documented gap (done-condition #13) — surname + gender
v1 `MemberWithFriendCreateApi(user_id, dob, name, **surname**, time, **gender**, is_remember_time, picture_url)` takes
two fields the Figma add-friend form (636:18533) does NOT collect. FROZEN-plan ruling: Figma is the source, send
**documented** defaults, do not go silent. Slice 1 sends:
- **surname = `''`** (empty — the form has no surname field)
- **gender = `'MALE'`** — NOT fabricated: it is v1's OWN default (`modal-add-freind.tsx` line 93 `useState('MALE')`).

These live in one place (`COMPAT_FRIEND_DEFAULTS`); when the form gains the fields, or ฟีม rules a different default,
change the two constants — every call already flows through `buildCreateFriendArgs`. **Surfaced to ฟีม, not silently
resolved.**

## Deferred to μุน's UI PR (not goo's lane) — stated, not hidden
person1's real-DB name/dob render (done-cond #3 happy-path), the 2-state screen + button-blue, and the full
`@393·360·320 × 2-state × 2-kind` screenshots (done-cond #10) belong to μุน's screen over this hook. goo's PR proves
the **logic** (gate/kind/redirect/button/wrap) on the real route; the person1 read reuses the exact `UserGetById`
path shipped in `useV2Home` (#165). Screenshots captured here (skeleton): `harness/captures/v2-compatibility-{love,colleague}__393.png`.

## flags → ฟีม (surfaced, not silently resolved)
1. **gender default 'MALE' for every created friend** is a data-quality compromise forced by the Figma-form gap. If
   that skews matching, the form needs a gender field (or ฟีม rules a policy). Documented above; not my call.
2. A v1 `api-compatibility-love.ts` / `request-compatibility-love.ts` pair exists alongside `user_matching.calculate`.
   The FROZEN plan specifies `UserMatchingCalculateApi` (บอง-verified endpoint.ts) — I followed it and did NOT use the
   other. Surfacing in case the two ever need reconciling; no action taken.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify (charter: ฟันอยู่ในมือ oracle อื่น). Seal must be posted on
GitHub + anchored to a commit (บอง's lesson), not just written here.
- **ตู๋ — ✅ SIGNED-OFF (e38b41a)** — posted on GitHub (PR #148 comment, commit-anchored; verifiable via
  `gh pr view 148`), NOT written by me here. Points ตู๋ attacked + verdict:
  (1) is v1 REALLY untouched? — **Yes**, `git diff` = 0 files in `pages/matching/**` + `constants/api/api-user-matching-*`;
  (2) do the 2 kinds send the RIGHT different types at the VALUE? — **Yes**, useCompatibility derives LOVE/FRIEND, test
  asserts values directly; (3) can an unknown/prototype kind render instead of redirect? — **No**, getServerSideProps
  catches unknown → strict redirect to /v2/service; (4) does the create-friend gap swap surname/gender or fabricate? —
  **No**, COMPAT_FRIEND_DEFAULTS surname ''/gender 'MALE' + buildCreateFriendArgs positions match v1's 8-arg signature;
  (5) does person1 strand/fabricate on BE error? — **No**, degrades to cookie name, no infinite spin, no fabricated dob/time.
- **goo** — logic owner; no UI/pixels claimed (μุน's lane). No side-effect endpoint fired (calculate deferred).
