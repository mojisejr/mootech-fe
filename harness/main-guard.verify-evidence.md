# verify-evidence — main-guard tripwire (PR-1 · goo · harness ปิดวง)

**Scope**: a CI **tripwire** on direct pushes to `main`. The 3 existing workflows (`ci` · `design-verify` ·
`secret-scan`) are all `on: pull_request`, so a direct push to `main` runs **nothing** — on 2026-07-29 `main` sat
red ~20 min unnoticed, and a bug-ledger entry with a dead `enforced_by` anchor sailed through because no one ran
the checker. `main-guard.yml` runs on `push: branches: [main]`: **job A** (tsc + ledger-integrity) and **job B**
(provenance — HEAD must be a PR merge, not a direct push).

ANCHOR: scripts/main-guard.test.ts#pr-merge-provenance

## The 3 traps (บอง's brief) — how each is handled

1. **`verify-ledger-integrity` needs the path arg.** Measured on this repo: bare `npx tsx scripts/verify-ledger-integrity.ts`
   → prints usage and **exits 1** (not 0). *(บอง's brief said exit 0 = silent pass; the current script exits 1 —
   a forgotten path is a false-FAIL, not a false-pass. Either way job A passes the explicit path
   `harness/bug-ledger/`, so green means every anchor actually resolved.)*
2. **Not a required check.** `main-guard.yml` is never added to branch protection — it observes `main` after it
   moves; making it required would block unrelated PRs.
3. **job B separates PR-merge from direct commit.** `isPrMergeCommit(subject, parentCount)` requires **both** 2+
   parents **and** the GitHub-generated subject `Merge pull request #<n> from …`. A normal PR merge (2 parents +
   that subject) is green; a direct push is red.

## proof-of-teeth

Provenance predicate: `npx tsx scripts/main-guard.test.ts` → **6/6 pass**. The predicate is the single source of
job B's decision — job B's YAML calls `scripts/assert-main-provenance.ts`, which exports the same function (no
shell/TS drift).

Run-proven (the exact commands each job runs, green + red):

| job | case | command | result |
|---|---|---|---|
| A | clean ledger | `verify-ledger-integrity.ts harness/bug-ledger/` | exit **0** (green) |
| A | **dead anchor** (temp entry `enforced_by` → nonexistent anchor — the exact 2026-07-29 bug-class) | same | exit **1 = RED** → reverted → exit 0 |
| A | tsc | `tsc --noEmit` | exit 0 (green) |
| B | real merge HEAD `a907c12` ("Merge pull request #141 …", 2 parents) | `assert-main-provenance.ts` | exit **0** (green) |
| B | direct-push shape (1-parent feature commit) | `assert-main-provenance.ts` on the PR-branch HEAD | exit **1 = RED**, names the pusher |

done-condition 3 (จำลอง main พัง → tripwire แดง) is the **dead-anchor row** above — proven RED by mutation, then
reverted (ledger byte-identical to origin after revert; the mutation was applied and reverted by hand, not via a
whole-file rewrite).

## adversary sign-off

Self-adversary (edges tried before hand-off — ตู๋ reviews independently):

- **spoof via parent-count alone**: a local `git merge` (2 parents, subject `Merge branch …`) pushed direct →
  rejected (subject doesn't match). Parent-count without subject is NOT sufficient.
- **spoof via subject alone**: a 1-parent commit with subject `Merge pull request #99 from evil/spoof` → rejected
  (1 parent defeats it). Both conditions required.
- **prefix bypass**: `chore: Merge pull request #1 …` → rejected (subject anchored to start with `^`).
- **malformed PR subject**: `Merge pull request from x` (no number) / `Merge pull request #12` (no `from `) →
  rejected.
- **the tripwire's own merge**: when THIS PR merges, `main`'s HEAD becomes `Merge pull request #<n> …` (2 parents)
  → job B green, and job A (tsc+ledger) green — so adding the guard does not red-flag itself.

**NOT covered (not hidden)**:
- **Accidental only, not spoof-proof.** A crafted 2-parent commit with a faked `Merge pull request #n` subject
  pushed directly WOULD pass job B (job A still runs). This guards the "เผลอ push main" case, not a determined
  bypass — consistent with the "รู้ + ดัก, ไม่ใช่ บังคับ" net (there is no enforced layer; GitHub Pro was declined).
- **The GitHub Actions run fires only when `main` actually moves** (`on: push` main). Pre-merge it does not run on
  this PR (that's correct — it is not `on: pull_request`). The RED path is therefore proven **locally** by the
  mutations above; the first real Actions run is the merge of this PR itself, which will be GREEN (job A+B pass on
  a PR-merge HEAD). I cannot force a real RED Actions run without pushing a broken `main`, which is forbidden.
