# ใบ ข — archive 44 unrun gates + withdraw 33 stale enforced_by

**Run env:** macOS · node 20 · next dev on :3017 (spare port, no collision) · counted/verified at branch base main `a4560da` · 2026-08-07 · goo
**PR:** chore/archive-dead-gates (harness-tidy ใบ ข, ฟีม/บอง) · **Owner:** goo
ANCHOR: harness/run-calendar-month.ts#mut-hardcode-tier

## proof-of-teeth
This PR removes gates that **never bit** (nothing ran them) and, most importantly, keeps the gates that DO bite biting. Verified, not assumed:

- **Keep-list is exactly 4** (grepped every workflow, not trusted from a list): `run.ts` · `run-pixel.ts` · `run-calendar-month.ts` · `run-calendar-select.ts` are the only harness scripts `design-verify.yml` invokes (+ `capture-coming-soon.ts`). `run-calendar-flow.ts` is NOT run — its `.github` hit was a *comment* ("deliberately NOT wired"); it is archived.
- **A kept gate still runs AND bites** — re-ran `run-calendar-month.ts` against a fresh :3017 build AFTER the moves: 🟢 PASSED (real-pipe discipline · tier-fidelity 31/31 · 1 sapphire selected · 3 วันพระ · no-overflow) and its embedded mutant **🦷 CAUGHT mut-hardcode-tier** (an off-DESIGN cell colour is rejected). The 4 gate files + their imported helpers are UNCHANGED by this PR (git diff), so their teeth are identical; the PR's own design-verify CI re-runs all 4.
- **44 MOVED, not deleted** (Rule 1): `git mv` to `harness/archive/`, `git log --follow` traces each. Excluded from tsc (`tsconfig.json exclude`, mirroring `scripts`). **No app code imports any of them** (0 `import … harness/run` outside harness) → build-safe.
- **33 stale `enforced_by` withdrawn** (μุน's pattern: field removed, `WAS: <old value>` appended to description) — every entry whose `enforced_by` pointed at a now-archived script. After: **0 `enforced_by` resolve to an archived file**; the 4 keep-anchors + 32 `scripts/*.test.ts` anchors stay. All 82 ledger JSON re-parse.
- **Gates green:** tsc 0 · 67 `scripts/*.test.ts` pass · `verify-ledger-integrity` PASSED (survives the 33 withdrawals) · `verify-architecture` PASSED · **CI-parity `next build` exit 0**.
- **False-status comment fixed** (design-verify.yml): the note claiming run-calendar-day/fidelity were "being repaired in their own PR" named a PR that does not exist — corrected to "moved because nothing ran them, still RED at the move." archive/README.md splits the three honestly (RED-when-moved / intended-not-wired / unrun-status-unknown) and answers anyone arriving from a stale code comment.

## adversary sign-off
Refute targets for ตู๋ (try to break these, run it):
- **Did I archive a LIVE gate?** — no: only 4 harness scripts appear in any workflow's invoke lines; all 4 kept. `run-calendar-flow`'s workflow hit is a comment, not a command. Try: `grep -nE "npx tsx harness/run" .github/workflows/*.yml`.
- **Did withdrawing 33 enforced_by break the ledger gate or hide a real guard?** — no: `verify-ledger-integrity` PASSED; the withdrawn anchors were run by NOTHING (that is why they moved); each keeps its old value as `WAS:`. A withdrawn claim that WAS live would be the bug — none were.
- **Did any move break the build/tsc silently?** — no: `next build` exit 0, tsc 0; archived scripts are tsc-excluded (dead), not silently broken-in-scope.
- **Is "kept gate still bites" real or cited from memory?** — real: mut-hardcode-tier CAUGHT on a re-run against a post-move build, not quoted from a prior PR.
- goo self-adversarial: the risk here is a false-GREEN of the form "looks tidier, quietly dropped a live gate." The keep-list was derived from the workflow invoke lines (ground truth), not the brief's list — which is how the `run-calendar-flow` miscount was caught.
