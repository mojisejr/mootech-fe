// Proof-of-teeth for the lean-CI workflow-integrity guard (goo · Phase 1). Runs the REAL guard against a
// hermetic sandbox git repo (same idiom as pre-push-guard.test.ts), so a regression that makes the guard
// toothless fails RED here. This is the behavioural proof that replaces the removed D2 evidence-gate's
// *.verify-evidence.md files — teeth live in a test that runs every CI, not in prose.
//
// Cases: (1) delete a workflow → RED   (2) `git mv` a workflow → RED (the #199 rename bypass)
//        (3) delete + '## intentional-workflow-change' in body → GREEN   (4) unrelated change → GREEN, silent
// Run: npx tsx scripts/guard-workflow-integrity.test.ts
//
// ANCHOR: scripts/guard-workflow-integrity.test.ts#workflow-delete-or-rename-goes-red
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const GUARD = resolve('scripts/guard-workflow-integrity.ts')

function git(cwd: string, cmd: string): void {
  execSync(`git ${cmd}`, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
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
      env: { ...process.env, BASE_REF: 'main', PR_BODY: prBody },
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

console.log('✅ guard-workflow-integrity.test.ts — 4 cases passed (delete RED · rename RED · intentional GREEN · unrelated GREEN)')
