# EYE PROOF — ดวงสมพงศ์ ก้อน 2F · "จอรอครอบช่วงคำนวณ" (loader moved onto the FORM)

**Anchor:** `harness/run-compat-2f.ts`
**PR:** feat/v2-compat-2f-loading-on-form · base = main (2F is the small first ticket — ฟีมเจ็บอยู่)
**Ledger:** `harness/bug-ledger/` → `compat-2f-loader-on-form`

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
CAPTURE_HOST=http://localhost:3023 npx tsx harness/run-compat-2f.ts     # baseline → 16/16
# tooth 1 (D30): delete the form's early-return LoadingScreen (revert to the shipped bug) → D30 must TRIP → revert
# tooth 2 (D34b): revert the await+catch to a bare `router.push(...)` → D34b strands the loader (waitFor times out) → revert
```
Every v1/BE HTTP (`/api/user`, `/api/member-with-friend[/detail]`, POST `/user-matching`, `/user-matching/detail`) is route-mocked → **no BE, no real quota/side-effect**. `pages/matching/**` + `api-user-matching-*` are never touched (import-only, ironclad rule 1).

## 🔧 ตู๋ review-round fix (Request Changes on #154) — the REAL hole, not the fake one
ตู๋ flagged "calculateCompatibility throws → loader stuck." **บอง checked it and it's a miss:** `calculateCompatibility` is wrapped in try/catch end-to-end (every path returns a value, it CANNOT throw) — so a try/catch around IT would be **armour that guards nothing**. I did **not** add it. **The real hole is one line down:** `router.push(...)` was un-awaited and un-caught. `push` returns a Promise; if the nav is **rejected** (a thrown getServerSideProps on the result route) or **cancelled** (`resolves false`), `calculating` + the `firingRef` latch are never released → the user is stranded on the loader **forever** (ตู๋'s symptom, real cause here). Fix: `await` the push in try/catch, treat reject OR `!navigated` as failure → release the latch + fall back to the form with the error (the same recovery block D34 uses). On the success path I touch **no** state (the screen is unmounting) so there's no setState-after-unmount console noise — matters because `design-verify.yml` gates on console noise (บอง's fix2 note).

## proof-of-teeth (run-compat-2f.ts → ✅ BASELINE 16/16)
| invariant | result |
|---|---|
| **D31** button label = "ดูผลลัพธ์เลย" (no loading state) | exact |
| button PAINTS enabled (sapphire, not gray) when both people set | `rgb(20,85,164)` = v3-sapphire — asserted after the `transition-colors` settles (see instrument note) |
| **D30** loader covers the FORM during calc | `role=status` up while the 900ms-mocked calc runs |
| **D30** form is REPLACED (not overlaid) during calc | `[data-testid=compat-screen]` count = 0 during the wait |
| **D31** no "กำลังคำนวณ…" button lingering under the loader | button count = 0 during the wait |
| **D35** form loader title + subtitle = ฟี ม copy (verbatim) | both match `COMPAT_CALC_LOADING` |
| **D33** calc fires EXACTLY once on a 5× synchronous tap | POST `/user-matching` count = **1** (firingRef latch) |
| **D32** no blank frame between form-loader & result | **rAF frame-level trace** — see the honest continuity note below |
| console errors + warnings = 0 | design-verify noise gate — both captured, both 0 |
| **D32** result-phase loader title + subtitle = SAME as form | both === `COMPAT_CALC_LOADING` (asserted on the result route too) |
| **D34** calc-fail → back on the FORM (`compat-screen` visible) + loader gone | ✓ |
| **D34b** push **reject** → back on FORM, loader released, retry possible (not stranded) | ✓ — router.push stubbed to reject on Next's singleton |
| **D34b** push **false** → back on FORM, loader released, retry possible (not stranded) | ✓ — router.push stubbed to resolve `false` |
| 🦷 `mut-loader-on-result-only` (delete the form early-return loader = the shipped bug) | **D30 → CAUGHT** (✗). The exact bug ฟีม hit. |
| 🦷 `mut-unhandled-push` (revert the await+catch to a bare push = ตู๋'s hole) | **D34b → CAUGHT** — the loader strands, `compat-result-error` never appears, the waitFor times out. |

## 🎞️ D32 continuity — what IS and ISN'T proven (ตู๋ was right; I was overclaiming)
A **still screenshot cannot prove "no white flash"** — it can't catch the sub-second nav handoff. So I do NOT claim "ต่อเนื่องไร้รอยต่อ" on screenshot evidence. What I actually have:
- ✓ **Proven — no copy/content swap:** the form-phase and result-phase loaders are the SAME `LoadingScreen` component with the SAME copy (both `=== COMPAT_CALC_LOADING`, asserted on both routes). So *if* a loader is on screen, it's the identical one — there is no visible copy change between phases.
- ✓ **Proven at frame granularity — rAF trace:** client-nav is same-document, so an injected `requestAnimationFrame` recorder survives the form→result swap. Across the loader-active window (form-loader → handoff → result-loader) it sampled **73 frames, `blankFrames=0`** — role=status present in *every* frame; no blank frame sandwiched in the handoff.
- ✗ **NOT proven (stated plainly):** rAF is ~60 fps (~16 ms). A blank **shorter than one frame** is below this trace's resolution (and below human perception). So this **bounds** a flash to < ~16 ms; it does **not** prove an absolute zero-flash. If ฟีม/ตู๋ want a harder bound, a frame-accurate video capture is the next step — flagged, not claimed.

**verify-the-instrument (negative controls, all hit live this session):**
1. The 5× rapid-tap was first `Promise.all` of real Playwright clicks — it blocked past the calc window so the loader probe read a **false negative**. Rewritten as one `$eval` firing 5 DOM clicks in a single tick → reads the loader correctly AND is a stronger fire-once test.
2. The form-ready screenshot first caught the button **mid-`transition-colors`** (a gray frame that LOOKS disabled though `disabled=false` and it clicks). Added a settle + computed-`backgroundColor === sapphire` assertion so the shot shows the TRUE resting state.
3. Forcing a real `router.push` rejection via network mocks **failed** — Next dev **hard-falls-back** on aborted/500 `_next/data` and aborted page chunks (it navigates instead of rejecting), so those never exercise the catch. Switched to stubbing `push` on Next's singleton router (`window.next.router`, the instance `useRouter()` returns) → deterministic reject / resolve-false WITHOUT navigating away, so the "recover on the form" behaviour is observable. A test that can't trigger the condition it claims to check is vacuous — fixed before trusting D34b.

## 🔬 Shipped-code surgery proof (golden rule 6 — PIXELS, not tsc)
`CompatibilityScreen.tsx` is a **shipped** file (v1... actually v2-preview, but the compat form is the surface 2F operates on). The not-pressed default form must render identically before/after my edits (my button changes reduce to the same output when `calculating=false`; the early-return only fires while calculating).
- Rendered the form's default state @393 (person1 loaded, person2 empty, button disabled) BEFORE (`git show origin/main:…CompatibilityScreen.tsx` swapped in, HMR recompiled) and AFTER (this branch), same `/api/user` mock, `reducedMotion`.
- `pixelmatch` (threshold 0.1): **changed pixels 0 / 1339344 = 0.0000% → PIXEL-IDENTICAL** (PNGs byte-identical, md5 `e21f435c…`).
- Artifacts: `harness/pixel-proof/compat-2f-form-BEFORE.png` · `…-AFTER.png` · `…-DIFF.png` (all-black).

## D36 — real press→result timing (⚠️ SURFACED, not fabricated)
The plan asks for the real seconds "กดปุ่ม → ผลขึ้น บนข้อมูลจริง" — the wait that used to hide behind the button, now visible to customers. **I cannot produce a truthful number from the UI worktree:** the anchor's timings are artificial route-mock delays (900ms), and a real figure needs the live bazi calc on real data — which means hitting a backend / consuming quota (prod `soxsccdlsycaevusndro` is forbidden without ฟีม; standing up be+bazi locally is outside my UI lane → STOP-and-ask). **Asking บอง:** measure on staging/QA post-merge, OR authorize me to bring up be+bazi locally for an approximate number. Reporting a mock number as "real" would be exactly rule-4 (fabricated data). Flagged, not silently dropped.

## 3-state screenshots @393 (D-evidence)
`harness/pixel-proof/compat-2f-1-form-ready.png` (sapphire "ดูผลลัพธ์เลย") · `…-2-loading.png` (leaf mascot + ฟี ม copy, covering the form) · `…-3-result.png` (‹ ผลดวงสมพงศ์ · two persons · ScoreRing A/82% · ภาพรวม). These are three still states — the form-loader and result-loader are the identical component/copy; the *continuity across the handoff* is evidenced by the rAF trace (above), not by these stills.

## 🔴 rule compliance
`git diff origin/main...HEAD` touches **NO** `pages/matching/**` and **NO** `constants/api/api-user-matching-*` (v1 wraps imported+called, never edited). Modified: `CompatibilityScreen.tsx` (loader-on-form + firingRef) · `CompatibilityResultScreen.tsx` (loader copy → shared constant). New: `compat-loading-copy.ts` · `run-compat-2f.ts` · `capture-compat-form.ts` · this evidence. `tsc --noEmit` ✓ · `scripts/*.test.ts` ✓ · ledger-integrity ✓ · architecture ✓ · prod build ✓.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — round 1: Request Changes → ADDRESSED (rev 2).** (1) "calc throws → stuck" — a **miss** (calc is fully try/caught, can't throw); did NOT add fake armour there. (2) The **real** hole ตู๋ pointed at (stranded loader) is the un-awaited `router.push` — **fixed** (await + catch + release), and now guarded by `mut-unhandled-push` + D34b (reject & false). (3) "screenshot can't prove no-flash" — **accepted**; D32 downgraded to what's provable (identical copy + rAF frame-level trace, `blankFrames=0`) with the sub-frame caveat stated. Re-review requested.
- **บอง** — diagnosed the root (loader on the wrong screen) + separated the real hole from the fake armour + the console-noise fix2 note; D36 ruled non-blocking (measure on staging post-merge as an AMEND).
- **still open for ตู๋ to attack:** (a) does the calc still fire once now the form unmounts mid-flight? — firingRef, 5× tap → count=1. (b) is the wait on the form, not the button? — D30 + `mut-loader-on-result-only`. (c) surgery on the shipped form moved a pixel? — 0/1339344 before/after. (d) forbidden paths? — 0 files in pages/matching + api-user-matching.
