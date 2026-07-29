# verify-evidence — pre-push main-guard hook (PR-2 · goo · harness ปิดวง)

**Scope**: a client-side **pre-push** hook (`.githooks/pre-push`) + installer (`scripts/install-git-hooks.sh`)
that refuses an **accidental** direct push to the repo's protected branch. This is the "หยุด" layer (ชั้น 3) of
the รู้+ดัก net — a client-side complement to PR-1's server-side tripwire.

ANCHOR: scripts/pre-push-guard.test.ts#pre-push-protected-branch

## Design decisions (from the brief)

- **Protected branch read from git, not hardcoded** — `git symbolic-ref refs/remotes/origin/HEAD` → `main` here,
  `pdf-dev` in bazi. The same hook is correct in every repo.
- **Error tells you what to do next**, not just "forbidden": switch to a branch → push it → `gh pr create`.
- **Honest in the doc**: `docs/git-hooks.md` states plainly this catches "เผลอ" only; `--no-verify` bypasses it.
  It is not written as if it were 100% enforcement.
- **Install once, covers all worktrees**: the installer sets `core.hooksPath` to the **main checkout's** absolute
  `.githooks/` path; worktrees share `.git/config`, so one run covers existing + future worktrees (verified by
  บอง's config-probe; this uses an absolute path so worktrees whose branch predates `.githooks/` are covered too).
- **Fail-open on detection failure** — if the default branch can't be determined, the guard skips (a ดัก must not
  block legit work when it can't tell), with a hint.

## proof-of-teeth

`npx tsx scripts/pre-push-guard.test.ts` → **8/8 pass**. The test runs the **real shell hook** via `execSync`
against **hermetic sandbox repos** it builds itself (each with a controlled `origin/HEAD`), so it does NOT depend
on the ambient checkout's refs — deterministic in every environment including CI. (First version read the ambient
`refs/remotes/origin/HEAD`, which CI's checkout doesn't set → it crashed; the hermetic rewrite is the fix — a
[verify-real-path] miss: green locally where origin/HEAD was set, red on the ship path where it isn't.)

| case (sandbox · stdin remote-ref) | expected | result |
|---|---|---|
| protected=main · `refs/heads/main` | blocked | exit **1** ✓ (done-condition 1) |
| protected=main · `refs/heads/feat/x` | allowed | exit **0** ✓ (done-condition 2) |
| protected=main · protected mixed with an allowed ref in one push | blocked | exit **1** ✓ |
| protected=main · delete protected branch (0-oid) | blocked | exit **1** ✓ |
| protected=main · empty push (no refs) | allowed | exit **0** ✓ |
| protected=main · `feat/main-ish` (name merely contains "main") | allowed | exit **0** ✓ (exact match only) |
| protected=**pdf-dev** (bazi-style) · push `pdf-dev` blocked, push `main` **allowed** | per-repo | exit 1 / 0 ✓ (read from git, not hardcoded) |
| **no origin/HEAD** · push main | fail-OPEN | exit **0** ✓ (a ดัก must not block when it can't tell) |

Real block message shown run-proven (names the protected branch, gives the branch→push→PR recipe, states the
`--no-verify` caveat).

## adversary sign-off

Self-adversary (edges tried before hand-off — ตู๋ reviews independently):

- **substring false-positive**: `feat/main-ish` is NOT blocked — match is exact on the ref basename, not a
  substring, so feature branches containing the protected name push fine.
- **multi-ref push**: a single `git push` that includes the protected ref among others is blocked (the whole push
  is refused, as git does — you can't partially push).
- **branch-delete**: `git push origin :main` (0-oid) still targets the protected ref → blocked.
- **wrong repo assumption**: the protected branch is derived per-repo; the test asserts against the repo's actual
  `origin/HEAD` (`main` here), so the same hook blocks `pdf-dev` in bazi without change.

**NOT covered (not hidden)**:
- **`--no-verify` bypasses it**, and it only runs where the installer was run — stated in the hook, the doc, and
  here. This is a ดัก, not a wall; PR-1's server-side tripwire + the PR/merge rule are the other layers.
- **`git push --dry-run origin main`** would also trigger (and be blocked by) the hook — not exercised here
  because it needs a live remote; the direct hook-invocation above is the deterministic equivalent.

## Merge-order note (append-only ledger — the 2026-07-29 trap class)

Both PR-1 (#142) and this PR append a new entry to the **end of `harness/bug-ledger.json`**, so whichever merges
second will conflict there. **Keep BOTH entries — do not pick a side** (`main-guard-tripwire-provenance` AND
`pre-push-main-guard-protected-branch`); a side-pick silently drops one while CI stays green. Suggested order:
**#142 first, then this**; on rebase, take both ledger entries and re-run `verify-ledger-integrity` — entry count
must rise by 2 vs the pre-#142 baseline, not 1.
