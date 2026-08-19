// Proof-of-teeth for the lean-CI workflow-integrity guard (goo · Phase 1). Runs the REAL guard against a
// hermetic sandbox git repo (same idiom as pre-push-guard.test.ts), so a regression that makes the guard
// toothless fails RED here. This is the behavioural proof that replaces the removed D2 evidence-gate's
// *.verify-evidence.md files — teeth live in a test that runs every CI, not in prose.
//
// Cases: (1) delete a workflow → RED   (2) `git mv` a workflow → RED (the #199 rename bypass)
//        (3) delete + '## intentional-workflow-change' heading → GREEN   (4) unrelated change → GREEN, silent
//        (5) delete a NON-ASCII (Thai) workflow → RED (ตู๋ F3: git quotes it → old prefix check MISSED it)
//        (6) delete + this guard's own error text pasted mid-body → RED (ตู๋ F4: marker must be a real heading)
// Run: npx tsx scripts/guard-workflow-integrity.test.ts
//
// ANCHOR: scripts/guard-workflow-integrity.test.ts#workflow-delete-or-rename-goes-red
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const GUARD = resolve('scripts/guard-workflow-integrity.ts')

// 🔴 env WITHOUT any GIT_* var. Under a git hook, git exports GIT_DIR (and GIT_INDEX_FILE), and
//    GIT_DIR BEATS cwd — so every command this file runs would act on  the REAL repo instead of its sandbox.
//    That is not theoretical: on 2026-08-19 it wrote `t <t@t> "base"` commits onto an open PR branch,
//    created a `feature` branch nobody asked for, replaced the tree with the synthetic one below, and set
//    core.bare=true in the shared .git/config (มุน found it · #337).
//    It was harmless for months because nothing ran this file — #335 wired lane 2 into pre-push, which is
//    the ONE place it runs under a hook. Green from a shell ≠ safe where it actually runs.
const GIT_FREE_ENV: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)

function git(cwd: string, cmd: string): void {
  execSync(`git ${cmd}`, { cwd, env: GIT_FREE_ENV, stdio: ['pipe', 'pipe', 'pipe'] })
}

/** A throwaway repo with two workflows committed on `main`, checked out on a `feature` branch. */
function makeSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wfguard-'))
  git(dir, 'init -q -b main')
  git(dir, 'config user.email t@t')
  git(dir, 'config user.name t')
  mkdirSync(join(dir, '.github/workflows'), { recursive: true })
  writeFileSync(join(dir, '.github/workflows/ci.yml'), 'name: ci\n')
  writeFileSync(join(dir, '.github/workflows/secret-scan.yml'), 'name: secret-scan\n')
  writeFileSync(join(dir, '.github/workflows/ตรวจ.yml'), 'name: thai\n') // non-ASCII → git quotes it in normal diff
  writeFileSync(join(dir, 'src.ts'), 'export const x = 1\n')
  git(dir, 'add -A')
  git(dir, 'commit -q -m base')
  git(dir, 'checkout -q -b feature')
  return dir
}

/** Run the REAL guard in `cwd` with BASE_REF=main + the given PR body; return exit code (0 pass, 1 red). */
function runGuard(cwd: string, prBody: string): number {
  try {
    execSync(`npx tsx ${GUARD}`, {
      cwd,
      // same reason as git(): the guard under test must read the SANDBOX, not the repo we run from
      env: { ...GIT_FREE_ENV, BASE_REF: 'main', PR_BODY: prBody },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return 0
  } catch (e: any) {
    return typeof e.status === 'number' ? e.status : 1
  }
}

function withSandbox(fn: (dir: string) => void): void {
  const dir = makeSandbox()
  try {
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// CASE 1 — deleting a workflow must go RED (no intent marker)
withSandbox((dir) => {
  git(dir, 'rm -q .github/workflows/secret-scan.yml')
  git(dir, 'commit -q -m "remove a gate"')
  assert.equal(runGuard(dir, 'a normal PR body, no marker'), 1, 'CASE 1: deleting a workflow must go RED')
})

// CASE 2 — `git mv` (rename) a workflow must go RED (the #199 rename bypass)
withSandbox((dir) => {
  git(dir, 'mv .github/workflows/ci.yml .github/workflows/ci.yml.disabled')
  git(dir, 'commit -q -m "rename a gate"')
  assert.equal(runGuard(dir, 'no marker'), 1, 'CASE 2: git mv of a workflow must go RED (rename bypass)')
})

// CASE 3 — deleting a workflow WITH the intent marker is deliberate → GREEN
withSandbox((dir) => {
  git(dir, 'rm -q .github/workflows/secret-scan.yml')
  git(dir, 'commit -q -m "retire secret-scan"')
  const body = 'summary\n\n## intentional-workflow-change\nretiring secret-scan; replaced by X\n'
  assert.equal(runGuard(dir, body), 0, 'CASE 3: intentional removal with marker must be GREEN')
})

// CASE 4 — a PR that does not touch workflows must be GREEN and silent
withSandbox((dir) => {
  writeFileSync(join(dir, 'src.ts'), 'export const x = 2\n')
  git(dir, 'commit -q -am "edit product code"')
  assert.equal(runGuard(dir, ''), 0, 'CASE 4: PR not touching workflows must be GREEN')
})

// CASE 5 — deleting a NON-ASCII (Thai) workflow must go RED (ตู๋ F3: git quotes non-ASCII paths; the guard
// reads them with -z / NUL so the '.github/workflows/' prefix still matches). Pre-fix this MISSED and passed.
withSandbox((dir) => {
  git(dir, 'rm -q .github/workflows/ตรวจ.yml')
  git(dir, 'commit -q -m "remove thai-named gate"')
  assert.equal(runGuard(dir, 'no marker'), 1, 'CASE 5: deleting a non-ASCII-named workflow must go RED')
})

// CASE 6 — deleting a workflow while the PR body only contains the guard's OWN error text (marker embedded
// mid-sentence, not a heading) must still go RED (ตู๋ F4: the marker match is line-anchored, not substring).
withSandbox((dir) => {
  git(dir, 'rm -q .github/workflows/secret-scan.yml')
  git(dir, 'commit -q -m "remove a gate"')
  const pastedError = 'oops CI failed:\n   add a heading line that is exactly "## intentional-workflow-change" on its own line.\n'
  assert.equal(runGuard(dir, pastedError), 1, 'CASE 6: pasted error text (marker mid-line) must NOT satisfy the marker')
})

console.log('✅ guard-workflow-integrity.test.ts — 6 cases passed (delete RED · rename RED · intentional GREEN · unrelated GREEN · non-ASCII delete RED · paste-bypass RED)')
