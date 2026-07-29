// pre-push guard teeth — runs the REAL .githooks/pre-push with simulated git stdin and asserts exit codes.
// Bug-class: an accidental `git push origin main` that skips ci/design-verify/secret-scan. The hook must
// reject a push whose remote ref is this repo's PROTECTED (default) branch — read from git, not hardcoded —
// and allow a normal feature-branch push. We exercise the shell hook itself (no logic duplicated in TS), so
// this test is ground-truth for what a real push would do.
// Run: npx tsx scripts/pre-push-guard.test.ts
//
// ANCHOR: scripts/pre-push-guard.test.ts#pre-push-protected-branch
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const HOOK = '.githooks/pre-push'
assert.ok(existsSync(HOOK), `${HOOK} must exist`)

// the protected branch this repo actually reports (main here; pdf-dev in bazi) — the hook derives the same.
const protectedBranch = execSync('git symbolic-ref --quiet --short refs/remotes/origin/HEAD')
  .toString()
  .trim()
  .replace(/^origin\//, '')

/** Run the hook with the given stdin; return its exit code (0 = allowed, 1 = blocked). */
function runHook(stdin: string): number {
  try {
    execSync(`bash ${HOOK} origin https://example.invalid/repo.git`, { input: stdin, stdio: ['pipe', 'pipe', 'pipe'] })
    return 0
  } catch (e: any) {
    return typeof e.status === 'number' ? e.status : 1
  }
}

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

const sha = '1111111111111111111111111111111111111111'
const sha2 = '2222222222222222222222222222222222222222'
const zero = '0000000000000000000000000000000000000000'

t('pre-push-protected-branch: pushing to the protected branch is BLOCKED (exit 1)', () => {
  assert.equal(runHook(`refs/heads/${protectedBranch} ${sha} refs/heads/${protectedBranch} ${sha2}\n`), 1)
})

t('pushing to a normal feature branch is ALLOWED (exit 0)', () => {
  assert.equal(runHook(`refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\n`), 0)
})

t('protected branch blocked even when mixed with an allowed ref in the same push', () => {
  assert.equal(
    runHook(`refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\nrefs/heads/${protectedBranch} ${sha} refs/heads/${protectedBranch} ${sha2}\n`),
    1,
  )
})

t('deleting the protected branch (0-oid) is BLOCKED too', () => {
  assert.equal(runHook(`${zero} ${zero} refs/heads/${protectedBranch} ${sha2}\n`), 1)
})

t('empty push (no refs) is allowed (nothing to guard)', () => {
  assert.equal(runHook(''), 0)
})

t('a feature branch whose name merely CONTAINS the protected name is allowed (exact match only)', () => {
  assert.equal(runHook(`refs/heads/feat/${protectedBranch}-ish ${sha} refs/heads/feat/${protectedBranch}-ish ${sha2}\n`), 0)
})

if (process.exitCode) {
  console.error(`\npre-push-guard: FAILED (${pass} passed)`)
} else {
  console.log(`\npre-push-guard: all ${pass} passed ✓ (protected branch = "${protectedBranch}")`)
}
