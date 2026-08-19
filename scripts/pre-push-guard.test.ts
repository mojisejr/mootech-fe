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

// 🔴 env WITHOUT any GIT_* var — see #338. Under a git hook, git exports GIT_DIR and GIT_DIR BEATS cwd,
//    so a sandbox built in a temp dir would still act on the REAL repo. This file RUNS the hook, and
//    under lane 2 it runs inside one: exactly the condition that caused the damage on 2026-08-19.
//    It was not the file that blew up, but it has the identical shape — fixed here rather than waiting
//    for its turn (#338 DoD: ไล่ให้ครบ ❌ ไม่ใช่แก้เฉพาะตัวที่ระเบิด).
const GIT_FREE_ENV: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const HOOK = resolve('.githooks/pre-push')
assert.ok(existsSync(HOOK), `${HOOK} must exist`)

function git(cwd: string, cmd: string): void {
  execSync(`git ${cmd}`, { cwd, env: GIT_FREE_ENV, stdio: ['pipe', 'pipe', 'pipe'] })
}

/**
 * A throwaway repo whose origin/HEAD points at `defaultBranch` (or none, if null → fail-open case).
 *
 * #320: the hook gained guard B (lint+test must be green). A sandbox with no package.json makes guard B
 * fail CLOSED — correctly — which would make every guard-A case look "blocked" for the wrong reason. So
 * each sandbox gets scripts that pass, and each writes a SENTINEL file when it runs. The sentinel is what
 * lets a test tell "the gate ran and passed" apart from "the gate was skipped", which exit 0 alone cannot.
 */
function makeSandbox(defaultBranch: string | null, scripts?: { lint?: string; test?: string }): string {
  const dir = mkdtempSync(join(tmpdir(), 'prepush-'))
  git(dir, 'init -q')
  git(dir, 'config user.email t@t')
  git(dir, 'config user.name t')
  git(dir, 'commit -q --allow-empty -m init')
  const pkg: Record<string, unknown> = { name: 'sandbox', private: true, scripts: {} }
  const s = pkg.scripts as Record<string, string>
  if (scripts?.lint !== 'MISSING') s.lint = scripts?.lint ?? 'touch .lint-ran'
  if (scripts?.test !== 'MISSING') s.test = scripts?.test ?? 'touch .test-ran'
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
  if (defaultBranch) {
    git(dir, `update-ref refs/remotes/origin/${defaultBranch} HEAD`)
    git(dir, `symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/${defaultBranch}`)
  }
  return dir
}

/** Did guard B actually execute in this sandbox? (sentinel dropped by the fake lint/test scripts) */
const gateRan = (dir: string) => existsSync(join(dir, '.lint-ran'))
const clearSentinels = (dir: string) => {
  rmSync(join(dir, '.lint-ran'), { force: true })
  rmSync(join(dir, '.test-ran'), { force: true })
}

/** Run the real hook in `cwd` with the given git stdin; return exit code (0 allowed, 1 blocked). */
function runHook(cwd: string, stdin: string): number {
  try {
    execSync(`bash ${HOOK} origin https://example.invalid/repo.git`, {
      cwd,
      env: GIT_FREE_ENV,
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
// guard B sandboxes (#320). `exit 3` rather than `exit 1` so a red gate cannot be confused with the hook's
// own exit code — if the hook ever leaked the script's status straight through, that shows up as 3, not 1.
const sbLintRed = makeSandbox('main', { lint: 'exit 3' })
const sbTestRed = makeSandbox('main', { test: 'exit 3' })
const sbNoScripts = makeSandbox('main', { lint: 'MISSING', test: 'MISSING' })
const sbNoHeadLintRed = makeSandbox(null, { lint: 'exit 3' }) // ← ตู๋'s regression case

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

  // ── guard B · the lint/test hard gate (#320) ────────────────────────────────────────────────
  // ANCHOR: scripts/pre-push-guard.test.ts#pre-push-hard-gate
  // Bug-class these guard: a push that reports success while the gate never ran. exit 0 alone cannot tell
  // "gate ran and passed" from "gate was skipped", so every case below asserts the SENTINEL too.

  t('guard B runs on a normal feature push, and we can prove it ran (not merely exit 0)', () => {
    clearSentinels(sbMain)
    assert.equal(runHook(sbMain, `refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\n`), 0)
    assert.equal(gateRan(sbMain), true, 'lint sentinel missing → the gate was skipped, not passed')
  })

  t('guard B fails CLOSED when lint is red', () => {
    assert.equal(runHook(sbLintRed, `refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\n`), 1)
  })

  t('guard B fails CLOSED when test is red', () => {
    assert.equal(runHook(sbTestRed, `refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\n`), 1)
  })

  t('guard B fails CLOSED when the script does not exist at all (no fact to assert)', () => {
    assert.equal(runHook(sbNoScripts, `refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\n`), 1)
  })

  t('a delete-only push skips guard B (0-oid) — and the sentinel proves it did not run', () => {
    clearSentinels(sbMain)
    assert.equal(runHook(sbMain, `(delete) ${zero} refs/heads/feat/x ${sha2}\n`), 0)
    assert.equal(gateRan(sbMain), false, 'gate ran on a delete push — that is 30-112s for nothing')
  })

  t('an empty push (already up-to-date, zero stdin lines) skips guard B', () => {
    clearSentinels(sbMain)
    assert.equal(runHook(sbMain, ''), 0)
    assert.equal(gateRan(sbMain), false)
  })

  // 🔴 THE REGRESSION ตู๋ FOUND (#325, 2026-08-18). The first version of guard A used `exit 0` for its
  // fail-open path, which returns from the whole script — so a repo with no origin/HEAD skipped guard B
  // too and pushed red code with "guard skipped" printed. The two guards were documented as independent
  // and were not. Without this case, exactly that shape comes back the next time someone touches the
  // fail-open branch.
  t('🔴 guard A failing OPEN must NOT take guard B down with it (no origin/HEAD + lint red → BLOCKED)', () => {
    assert.equal(
      runHook(sbNoHeadLintRed, `refs/heads/feat/x ${sha} refs/heads/feat/x ${sha2}\n`),
      1,
      'no origin/HEAD skipped the hard gate — guard A fail-open leaked into guard B',
    )
  })
} finally {
  for (const d of [sbMain, sbBazi, sbNoHead, sbLintRed, sbTestRed, sbNoScripts, sbNoHeadLintRed]) {
    rmSync(d, { recursive: true, force: true })
  }
}

if (process.exitCode) {
  console.error(`\npre-push-guard: FAILED (${pass} passed)`)
} else {
  console.log(`\npre-push-guard: all ${pass} passed ✓`)
}
