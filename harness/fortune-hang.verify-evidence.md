# verify-evidence — /v2 fortune-card skeleton hang (goo)

## capability → gate fired
The `/v2` daily-fortune card must LEAVE the skeleton and render the fortune for a member with a complete
birth profile. It was hanging on the skeleton 15s+ (มุน saw it on the real route). Fires the runtime
rendered-state lens: ground-truth is the rendered card, because console + AST are blind here — the effect
is a valid code shape and the fetch returns 200; only the rendered pixels reveal the deadlock.

## root cause (verified, not guessed)
`useHomeFortune` latched a persistent `doneRef` BEFORE the async work. React StrictMode (dev) double-
invokes the effect:
1. **run A** → `doneRef.current=true`, `alive_A=true`, starts UserGetById + POST /api/home-fortune
2. **StrictMode cleanup A** → `alive_A=false`
3. **run B** → sees `doneRef.current=true` → returns immediately (no fetch)
4. **run A's fetch resolves** → enters `if (alive)` = false → `setFortune` skipped AND
   `finally { if (alive) setLoading(false) }` skipped → **`loading` stuck `true` forever**

The sibling `useV2Home` (ธาตุ line) does NOT hang because it sets state with **no alive guard** — run A
completes and resolves unconditionally. `useHomeFortune` had both a latch AND an alive guard, which fight.

## proof-of-teeth
- **ANCHOR runner:** `harness/run-fortune-hang.ts#strictmode-hang` — drives the REAL route (v2 preview
  gate → dev-login as the complete-profile anonymized member `5c7befb3` → /v2), then asserts the card
  leaves the skeleton (`.animate-pulse` count → 0 AND the fortune copy renders) within an 8s budget.
- **neg-control-first, run LIVE against the testenv stack (2026-07-26):**
  - **MUTANT = the pre-fix code (doneRef latch present):** runner run against the live buggy :3000 →
    `❌ [strictmode-hang] fortune card still on skeleton after 8000ms` → **exit 1 = CAUGHT**. Browser
    timeline: `pulses:1, fortune:false` held from 1.5s through 15s.
  - **FIX (idempotent effect, latch removed):** same route → skeleton cleared ~1.5s, card rendered
    **`B+ 70%` + `ธาตุของคุณคือ ดิน`** → `pulses:0, fortune:true` → **PASS**.
- **network ground-truth (why a probe-only diagnosis is wrong):** in BOTH mutant and fix, `/api/user`
  fired (2×, StrictMode) and `/api/home-fortune` fired and returned **200**. The bug is the DISCARDED
  result (alive=false), NOT a missing request — so "0 requests = confirmed" (the first hypothesis) was
  the wrong signature; the fetch fires, the resolve is dropped. Verified via network capture, not reasoning.
- **scope / dev-only:** the trigger is StrictMode double-invoke (dev). Production build mounts once →
  `alive` stays true → resolves normally. So no prod-user impact, but it blocked the test-env capture
  loop (and fixes a latent no-refetch-on-userId-change), so it ships.

## checks
- `tsc --noEmit` clean.
- `harness/run-fortune-hang.ts` is LOCAL-ONLY (needs the testenv DB stack, like `e2e/auth-loop`): not
  wired into `ci.yml` (runs only `scripts/*.test.ts`) nor `design-verify` (runs `run.ts` + `run-pixel.ts`).
- Fix is one file (`features/home/hooks/useHomeFortune.ts`): drop `doneRef` + the unused `useRef` import.

## adversary sign-off
**Pending ตู๋ (too) review.** Cross-lens split (none self-certifies): goo (me) = runtime/rendered-state
(this runner, neg-control-proven live) · too = static/AST on the effect shape (latch vs alive-guard
interaction, real-unmount setState safety after dropping the latch) + confirm the dev-only scope. Open
question for too: idempotent effect double-fires `/api/home-fortune` in dev StrictMode — accept, or dedupe
now? (relates to too's earlier note that `useHomeFortune` + `useV2Home` both call `UserGetById` — a
separate follow-up, not folded into this PR).

ANCHOR: harness/run-fortune-hang.ts#strictmode-hang
