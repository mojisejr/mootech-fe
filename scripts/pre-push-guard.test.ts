// pre-push guard teeth — runs the REAL .githooks/pre-push against a HERMETIC sandbox repo whose protected
// branch we set up ourselves. This does NOT depend on the ambient checkout's refs/remotes/origin/HEAD (CI
// checkouts don't set it — the earlier version crashed there), so it is deterministic in every environment.
// Bug-class: an accidental `git push origin <default-branch>` that skips ci/design-verify/secret-scan. The
// hook must reject a push whose remote ref = the repo's default branch (read from git, not hardcoded), allow a
// feature branch, and fail OPEN when the default branch can't be determined.
// Run: npx tsx scripts/pre-push-guard.test.ts
//
// ANCHOR: scripts/pre-push-guard.test.ts#pre-push-protected-branch
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const HOOK = resolve('.githooks/pre-push')
assert.ok(existsSync(HOOK), `${HOOK} must exist`)

function git(cwd: string, cmd: string): void {
  execSync(`git ${cmd}`, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
}

/** A throwaway repo whose origin/HEAD points at `defaultBranch` (or none, if null → fail-open case). */
function makeSandbox(defaultBranch: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'prepush-'))
  git(dir, 'init -q')
  git(dir, 'config user.email t@t')
  git(dir, 'config user.name t')
  git(dir, 'commit -q --allow-empty -m init')
  if (defaultBranch) {
    git(dir, `update-ref refs/remotes/origin/${defaultBranch} HEAD`)
    git(dir, `symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/${defaultBranch}`)
  }
  return dir
}

/** Run the real hook in `cwd` with the given git stdin; return exit code (0 allowed, 1 blocked). */
function runHook(cwd: string, stdin: string): number {
  try {
    execSync(`bash ${HOOK} origin https://example.invalid/repo.git`, {
      cwd,
      input: stdin,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
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

// primary sandbox: protected branch = "main" (as on mootech-fe). A second sandbox uses "pdf-dev" to prove the
// branch is read from git per-repo, not hardcoded. A third has no origin/HEAD to prove fail-open.
const sbMain = makeSandbox('main')
const sbBazi = makeSandbox('pdf-dev')
const sbNoHead = makeSandbox(null)

try {
  t('pre-push-protected-branch: pushing to the protected branch (main) is BLOCKED (exit 1)', () => {
    assert.equal(runHook(sbMain, `refs/heads/main ${sha} refs/heads/main ${sha2}\n`), 1)
  })

  t('pushing to a normal feature branch is ALLOWED (exit 0)', () => {
    assert.equal(runHook(sbMain, `refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\n`), 0)
  })

  t('protected branch blocked even when mixed with an allowed ref in the same push', () => {
    assert.equal(
      runHook(sbMain, `refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\nrefs/heads/main ${sha} refs/heads/main ${sha2}\n`),
      1,
    )
  })

  t('deleting the protected branch (0-oid) is BLOCKED too', () => {
    assert.equal(runHook(sbMain, `${zero} ${zero} refs/heads/main ${sha2}\n`), 1)
  })

  t('empty push (no refs) is allowed (nothing to guard)', () => {
    assert.equal(runHook(sbMain, ''), 0)
  })

  t('a feature branch whose name merely CONTAINS the protected name is allowed (exact match only)', () => {
    assert.equal(runHook(sbMain, `refs/heads/feat/main-ish ${sha} refs/heads/feat/main-ish ${sha2}\n`), 0)
  })

  t('protected branch is read PER-REPO from git: bazi-style repo blocks pdf-dev, allows main', () => {
    assert.equal(runHook(sbBazi, `refs/heads/pdf-dev ${sha} refs/heads/pdf-dev ${sha2}\n`), 1)
    assert.equal(runHook(sbBazi, `refs/heads/main ${sha} refs/heads/main ${sha2}\n`), 0) // main is NOT protected here
  })

  t('fail-OPEN when the default branch cannot be determined (no origin/HEAD) — a ดัก must not block legit work', () => {
    assert.equal(runHook(sbNoHead, `refs/heads/main ${sha} refs/heads/main ${sha2}\n`), 0)
  })
} finally {
  for (const d of [sbMain, sbBazi, sbNoHead]) rmSync(d, { recursive: true, force: true })
}

if (process.exitCode) {
  console.error(`\npre-push-guard: FAILED (${pass} passed)`)
} else {
  console.log(`\npre-push-guard: all ${pass} passed ✓`)
}
