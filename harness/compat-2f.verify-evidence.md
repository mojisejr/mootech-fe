# EYE PROOF — ดวงสมพงศ์ ก้อน 2F · "จอรอครอบช่วงคำนวณ" (loader moved onto the FORM)

**Anchor:** `harness/run-compat-2f.ts`
**PR:** feat/v2-compat-2f-loading-on-form · base = main (2F is the small first ticket — ฟีมเจ็บอยู่)
**Ledger:** `harness/bug-ledger.json` → `compat-2f-loader-on-form`

ANCHOR: harness/run-compat-2f.ts#mut-loader-on-result-only

## What this is / the bug ฟีม hit
กดปุ่ม → ปุ่มค้าง "กำลังคำนวณ…" นาน → จอรอเด้งแวบเดียวแล้วหาย. **Root (บอง opened the code, ยืนยัน):** the loader was hung on the WRONG screen. The heavy work (`calculateCompatibility`, side-effect: log + quota) runs on the **form** (`CompatibilityScreen`), but the `LoadingScreen` only covered the **result read** (`CompatibilityResultScreen`, fast). So the long wait showed as a spinner label on the button, and the full-screen loader only flashed on the (already-finished) result. This is the **2nd** AMEND of D17 — the done-condition put the loader where the work isn't. **Not μุน's fault** (plan error), ฟี ม-acknowledged.

## The fix (my lane — the button/loader state-machine)
- **D30** while `calculating`, the form does an early-return of the full-screen `LoadingScreen` — the wait shows where the work is.
- **D31** the button no longer carries a loading state — its label is always "ดูผลลัพธ์เลย" (no "กำลังคำนวณ…").
- **D32/D35** ONE continuous wait: form-phase loader and result-phase loader render the SAME copy from a single source (`compat-loading-copy.ts`) so the client-nav swap is seamless (no white flash).
- **D33** the calc still fires from the form, ONCE — hardened with a `firingRef` latch (the `calculating` state var alone is racy: a synchronous double-tap re-enters with a stale closure and fires the quota-consuming call 5×).
- **D34** calc failure → back on the form with `compat-result-error`, latch released — never stranded on the loader.

## D35 copy (ฟี ม-verbatim, both phases)
```
title    "กำลังคำนวณดวงสมพงศ์"
subtitle "กรุณาอย่าปิดหน้าจอ จนกว่าผลลัพธ์จะขึ้น · ระบบกำลังประมวลผล"
```

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; next dev -p 3023        # or the middleware fails closed to /maintenance
CAPTURE_HOST=http://localhost:3023 npx tsx harness/run-compat-2f.ts     # baseline → 12/12
# tooth: delete the form's early-return LoadingScreen (revert to the shipped bug), re-run → D30 must TRIP → revert
```
Every v1/BE HTTP (`/api/user`, `/api/member-with-friend[/detail]`, POST `/user-matching`, `/user-matching/detail`) is route-mocked → **no BE, no real quota/side-effect**. `pages/matching/**` + `api-user-matching-*` are never touched (import-only, ironclad rule 1).

## proof-of-teeth (run-compat-2f.ts → ✅ BASELINE 12/12)
| invariant | result |
|---|---|
| **D31** button label = "ดูผลลัพธ์เลย" (no loading state) | exact |
| button PAINTS enabled (sapphire, not gray) when both people set | `rgb(20,85,164)` = v3-sapphire — asserted after the `transition-colors` settles (see instrument note) |
| **D30** loader covers the FORM during calc | `role=status` up while the 900ms-mocked calc runs |
| **D30** form is REPLACED (not overlaid) during calc | `[data-testid=compat-screen]` count = 0 during the wait |
| **D31** no "กำลังคำนวณ…" button lingering under the loader | button count = 0 during the wait |
| **D35** form loader title + subtitle = ฟี ม copy (verbatim) | both match `COMPAT_CALC_LOADING` |
| **D33** calc fires EXACTLY once on a 5× synchronous tap | POST `/user-matching` count = **1** (firingRef latch) |
| console errors = 0 | ✓ |
| **D32** result-phase loader title + subtitle = SAME as form | seamless continuity — same constant, asserted on the result route too |
| **D34** error → back on the FORM (`compat-screen` visible) | ✓ |
| **D34** error → NOT stranded on the loader | `role=status` count = 0 after the error |
| 🦷 `mut-loader-on-result-only` (delete the form early-return loader = the shipped bug) | **D30 "loader covers the FORM during calc" → CAUGHT** (✗). This IS the exact bug ฟีม hit. |

**verify-the-instrument (negative controls, both hit live this session):**
1. The 5× rapid-tap was first written as `Promise.all` of real Playwright clicks — it blocked past the calc window and the loader-visible probe read a **false negative** (loader "not seen" though it was up). Rewritten as one `$eval` firing 5 DOM clicks in a single tick → the probe now reads the loader correctly AND it's a stronger fire-once test. A probe that can't observe the state it asserts is vacuous — fixed before trusting its numbers.
2. The form-ready screenshot first caught the button **mid-`transition-colors`** (a gray frame that LOOKS disabled though `disabled=false` and it clicks). Added a settle + a computed-`backgroundColor === sapphire` assertion so the evidence shows the TRUE resting state, not an in-between paint.

## 🔬 Shipped-code surgery proof (golden rule 6 — PIXELS, not tsc)
`CompatibilityScreen.tsx` is a **shipped** file (v1... actually v2-preview, but the compat form is the surface 2F operates on). The not-pressed default form must render identically before/after my edits (my button changes reduce to the same output when `calculating=false`; the early-return only fires while calculating).
- Rendered the form's default state @393 (person1 loaded, person2 empty, button disabled) BEFORE (`git show origin/main:…CompatibilityScreen.tsx` swapped in, HMR recompiled) and AFTER (this branch), same `/api/user` mock, `reducedMotion`.
- `pixelmatch` (threshold 0.1): **changed pixels 0 / 1339344 = 0.0000% → PIXEL-IDENTICAL** (PNGs byte-identical, md5 `e21f435c…`).
- Artifacts: `harness/pixel-proof/compat-2f-form-BEFORE.png` · `…-AFTER.png` · `…-DIFF.png` (all-black).

## D36 — real press→result timing (⚠️ SURFACED, not fabricated)
The plan asks for the real seconds "กดปุ่ม → ผลขึ้น บนข้อมูลจริง" — the wait that used to hide behind the button, now visible to customers. **I cannot produce a truthful number from the UI worktree:** the anchor's timings are artificial route-mock delays (900ms), and a real figure needs the live bazi calc on real data — which means hitting a backend / consuming quota (prod `soxsccdlsycaevusndro` is forbidden without ฟีม; standing up be+bazi locally is outside my UI lane → STOP-and-ask). **Asking บอง:** measure on staging/QA post-merge, OR authorize me to bring up be+bazi locally for an approximate number. Reporting a mock number as "real" would be exactly rule-4 (fabricated data). Flagged, not silently dropped.

## 3-state screenshots @393 (D-evidence)
`harness/pixel-proof/compat-2f-1-form-ready.png` (sapphire "ดูผลลัพธ์เลย") · `…-2-loading.png` (leaf mascot + ฟี ม copy, covering the form) · `…-3-result.png` (‹ ผลดวงสมพงศ์ · two persons · ScoreRing A/82% · ภาพรวม). The three read as one continuous flow: form → same loader → result.

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**` and **NO** `constants/api/api-user-matching-*` (v1 wraps imported+called, never edited). Modified: `CompatibilityScreen.tsx` (loader-on-form + firingRef) · `CompatibilityResultScreen.tsx` (loader copy → shared constant). New: `compat-loading-copy.ts` · `run-compat-2f.ts` · `capture-compat-form.ts` · this evidence. `tsc --noEmit` ✓ · `scripts/*.test.ts` ✓ · ledger-integrity ✓ · architecture ✓ · prod build ✓.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING.** Points to attack: (1) does the calc STILL fire once now that the form unmounts mid-flight? — firingRef latches in the same tick; proven by the 5× synchronous-tap → count=1. (2) is the wait actually on the form now, not the button? — D30 asserts `role=status` up + `compat-screen` gone during calc; `mut-loader-on-result-only` reproduces the old bug and D30 catches it. (3) form→result seam — white flash? — both loaders share ONE copy constant; D32 asserts the result-phase loader equals the form-phase copy. (4) error path — stranded on the loader? — D34: back on the form + error, loader gone. (5) surgery on the shipped form — moved a pixel? — 0/1339344 before/after. (6) forbidden paths? — 0 files in pages/matching + api-user-matching.
- **บอง** — diagnosed the root (loader on the wrong screen) + owns the plan AMEND; D36 real-timing surfaced back to him.
