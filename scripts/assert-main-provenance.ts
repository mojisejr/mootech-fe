// Job B of the main-guard tripwire: assert HEAD on `main` is a GitHub PR-merge commit, NOT a direct push.
// A direct push bypasses ci / design-verify / secret-scan (all `on: pull_request`), so main can go red — or
// carry an unscanned secret — with nothing running. This flags that the moment main moves.
//
// GROUND-TRUTH signal (verified against real history 2026-07-29): every PR merge on this repo is a 2-parent
// commit whose subject is GitHub's generated `Merge pull request #<n> from <branch>`. A direct push is 1 parent
// (or any subject that is not that pattern). We require BOTH — parent-count AND subject — so a linear direct
// push (1 parent) and a locally-crafted merge pushed straight to main (2 parents, non-PR subject) both trip it.
//
// HONEST SCOPE: this catches an ACCIDENTAL direct push. It is not spoof-proof — a crafted 2-parent commit with a
// faked "Merge pull request #n" subject would pass job B (job A's tsc + ledger check still runs regardless).
//
// ANCHOR: scripts/main-guard.test.ts#pr-merge-provenance  (the teeth live in the test)
import { execSync } from 'node:child_process'

/** True only for a GitHub PR-merge commit: 2+ parents AND the generated merge subject. */
export function isPrMergeCommit(subject: string, parentCount: number): boolean {
  return parentCount >= 2 && /^Merge pull request #\d+ from /.test(subject.trim())
}

if (require.main === module) {
  const subject = execSync('git log -1 --format=%s').toString().trim()
  const parents = execSync('git rev-list --parents -n 1 HEAD').toString().trim().split(/\s+/).length - 1
  const pusher = process.env.GITHUB_ACTOR ?? 'unknown'

  if (isPrMergeCommit(subject, parents)) {
    console.log(`✓ provenance OK — PR merge-commit (${parents} parents · "${subject}")`)
    process.exit(0)
  }

  console.error(
    `::error::main moved by a DIRECT push, not a PR merge. Pushed by @${pusher}. ` +
      `HEAD subject: "${subject}" (${parents} parent(s)). ` +
      `A direct push skips ci / design-verify / secret-scan entirely. ` +
      `Fix: open a PR for the change (do not push main directly) — even a one-line doc/ledger note goes through a PR.`,
  )
  process.exit(1)
}
