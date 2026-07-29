# EYE PROOF — ดวงสมพงศ์ REFRAME 3: gender is the user's CHOICE, no silent fallback (goo logic)

**Anchor:** `scripts/compatibility.test.ts` · **PR:** feat/v2-compat-gender · **base:** main `2a05c0d` (post-#148)
**Ledger:** `harness/bug-ledger.json` → `compat-gender-required-no-silent-fallback`
ANCHOR: scripts/compatibility.test.ts#gender-required-no-silent-fallback

## What this PR is
The tiny goo-side half of REFRAME 3 (ฟีม): the add-friend contract now takes the user's chosen **gender** instead of
the Slice-1 gap-default. `gender` is a **real bazi calc input** — locking it to MALE = permanently wrong compute, so
this is a correctness fix, not cosmetics. μุน's UI PR adds the 👨/👩 buttons (V3, v1-style visible pre-select) and
passes the chosen value; this PR makes the contract accept + carry it. **v1 UNCHANGED** (done-cond #6 still holds).

## The change
- `NewFriendForm` += `gender: 'MALE' | 'FEMALE'` — a **closed union, REQUIRED**: `''`/`undefined` are not
  representable, so a form that omits it is a **tsc error**, not a silent default.
- `buildCreateFriendArgs` uses `form.gender` at position 5 **directly — NO `|| COMPAT_FRIEND_DEFAULTS.gender`**.
  บอง's catch: `form.gender || DEFAULT` reopens the exact bug — an unchosen gender silently becomes MALE. The problem
  was "ผู้ใช้เลือกไม่ได้", not "the default is wrong", so any path that yields MALE without a user choice = not fixed.
- `COMPAT_FRIEND_DEFAULTS.gender = 'MALE'` **RETAINED** for the record (บอง/ฟีม: เก็บไว้ได้ ไม่ต้องลบ) but **no
  longer a runtime fallback** — a tooth guards that the silent-MALE path stays dead.
- Approach (chosen with μุน, บอง's option 2): the form pre-selects MALE **VISIBLY** (v1-style highlight, user sees +
  can change) → a value is ALWAYS sent; the default is *seen, not hidden behind a fallback*.

## Run commands (full ci.yml gate reproduced locally)
```bash
npx tsc --noEmit                                        # ✓
for f in scripts/*.test.ts; do npx tsx "$f"; done       # ✓ incl. scripts/compatibility.test.ts (13/13)
npx tsx scripts/verify-ledger-integrity.ts harness/bug-ledger.json harness/compat-gender.verify-evidence.md  # ✓
npx tsx scripts/verify-architecture.ts                  # ✓
npm run build                                           # ✓
```

## proof-of-teeth (scripts/compatibility.test.ts → ✅ 13/13, mutant-proven)
| invariant | result |
|---|---|
| the chosen gender flows to index 5 — `MALE→MALE`, `FEMALE→FEMALE` (both directions) | ✓ |
| surname is still the documented gap → `''` at index 3 (unchanged) | ✓ |
| 🔴 an **absent/empty** gender does **NOT** silently become MALE — flows as-is (loud), never coerced | ✓ |
| 🦷 **mut-E** hardcode `COMPAT_FRIEND_DEFAULTS.gender` (ignore form.gender) | **all 3 gender asserts FAIL → CAUGHT** (FEMALE fixture ≠ MALE) |
| 🦷 **mut-F** reintroduce `form.gender \|\| COMPAT_FRIEND_DEFAULTS.gender` (the silent reopening) | **empty-gender assert FAILS → CAUGHT** ('' → 'MALE') |

Both mutants RUN, each turned the suite red on the gender asserts, then restored + re-confirmed green (13/13). The
FORM fixture uses **FEMALE** on purpose — a MALE fixture would hide mut-E. The empty-gender tooth is exactly บอง's
ask: "mut ที่ทำให้ฟอร์มไม่ส่ง gender แล้วต้องมีอะไรแดง" — if the silent-MALE fallback ever returns, this goes red.

## done-conditions (REFRAME 3)
- **#13 (new)**: gender = the value the user actually chose, proven at **the value sent** (args[5]), not "a button
  renders". surname still `''` + documented.
- **#14**: the gender picker is a **deliberate divergence from Figma** (sheet 636:18533 dropped it) — **ฟีม-ordered**,
  same as the ซินแส #146 precedent. Not an omission we sneaked in; a v1 feature V3 dropped, restored by ฟีม's call.

## done-condition #6 — v1 UNTOUCHED
`git diff --name-only origin/main...HEAD` contains ZERO `pages/matching/**` and ZERO `constants/api/api-user-matching-*`.

## seam to μุน
μุน's form owns the 2 gender buttons (V3, visible MALE pre-select, changeable) and passes `gender` into
`createFriend(form)`. This PR only makes the contract accept it. Coordinated: this merges → μุน wires the real value
→ she proves done-cond #13 end-to-end (chosen value reaches the API) in her stack PR.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify. Seal must be posted on GitHub + commit-anchored (บอง's lesson).
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) can an unchosen gender still reach MALE by any path? — mut-F + the
  empty-gender tooth; (2) does the chosen value actually flow (not just the type)? — mut-E + the both-directions test;
  (3) is v1 touched? — git diff for the 2 forbidden paths; (4) is the required union real or bypassable? — '' is a
  tsc error, and the runtime-cheat case ('' as any) is asserted NOT to coerce to MALE.
- **goo** — logic owner; the UI (buttons, visible pre-select) is μุน's lane.
