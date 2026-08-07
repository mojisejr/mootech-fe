// main-guard tripwire — provenance predicate teeth. The bug-class: a direct push to main (which bypasses
// ci/design-verify/secret-scan) slips by because the guard can't tell a PR-merge commit from a direct push.
// isPrMergeCommit is the single source of that decision (job B's YAML calls the same script), so its teeth
// live here. (Job A = tsc + verify-ledger-integrity, which have their own tests.)
// Run: npx tsx scripts/main-guard.test.ts
//
// ANCHOR: scripts/main-guard.test.ts#pr-merge-provenance
import assert from 'node:assert/strict'
import { isPrMergeCommit } from './assert-main-provenance'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

t('pr-merge-provenance: a real GitHub PR-merge commit passes (2 parents + generated subject)', () => {
  assert.equal(isPrMergeCommit('Merge pull request #141 from mojisejr/feat/v2-calendar-notifications', 2), true)
  assert.equal(isPrMergeCommit('Merge pull request #7 from x/y', 2), true)
})

t('a linear DIRECT push is rejected (1 parent)', () => {
  // the exact shape that slipped through on 2026-07-29
  assert.equal(isPrMergeCommit('docs(ledger): log inline-hex gradient technical debt', 1), false)
  assert.equal(isPrMergeCommit('fix: whatever', 1), false)
})

t('a locally-crafted merge pushed direct is rejected (2 parents but NOT the PR subject)', () => {
  // 2 parents alone must NOT pass — parent-count without the subject is spoofable by a local `git merge`
  assert.equal(isPrMergeCommit('Merge branch main into feat', 2), false)
  assert.equal(isPrMergeCommit('Merge remote-tracking branch origin/main', 2), false)
})

t('a direct push wearing a fake merge SUBJECT is rejected (1 parent defeats it)', () => {
  // subject alone must NOT pass either — both conditions are required
  assert.equal(isPrMergeCommit('Merge pull request #99 from evil/spoof', 1), false)
})

t('subject match is anchored to the start (no mid-string / prefixed bypass)', () => {
  assert.equal(isPrMergeCommit('chore: Merge pull request #1 from x', 2), false)
  assert.equal(isPrMergeCommit('Merge pull request #12 from a/b', 2), true) // leading/trailing ws tolerated
  assert.equal(isPrMergeCommit('  Merge pull request #12 from a/b  ', 2), true)
})

t('malformed PR subjects are rejected (needs #<digits> and "from ")', () => {
  assert.equal(isPrMergeCommit('Merge pull request from x', 2), false) // no number
  assert.equal(isPrMergeCommit('Merge pull request #12', 2), false) // no "from "
})

if (process.exitCode) {
  console.error(`\nmain-guard: FAILED (${pass} passed)`)
} else {
  console.log(`\nmain-guard: all ${pass} passed ✓`)
}
