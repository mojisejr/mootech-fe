// scripts/evidence-dir.test.tsx — teeth on harness/evidence-dir.mjs (#417).
//
// WHY THIS SPEC EXISTS. #417 moved harness output to ONE ignored root so that the `.gitignore` rule
// could finally reach the harnesses (six of them had the path spelled out in their own source, which
// is how `harness/pixel-proof/` grew to 75 files / 19.24 MB while a rule two directories away said
// run dumps must not be committed). Collapsing a rule into one function makes the function the rule —
// and ตู๋'s adversarial pass on that PR walked straight out of it: `evidenceDir('../pixel-proof')`
// handed back the tracked directory, and `evidenceDir('../../..')` created a directory in the parent
// of the repo. Nothing anywhere would have gone red.
//
// 🔴 WHAT THIS SPEC DOES NOT COVER, stated so nobody reads it as more than it is: it only binds
// callers that USE evidenceDir. A seventh harness that types `join(REPO, 'harness', 'pixel-proof')`
// by hand is invisible to every assertion here — that gap is #420, and it is the same gap one layer
// up that #417 was closing one layer down.
//
// .tsx on purpose: ci.yml's tsx lane globs `*.test.ts`, so a `.tsx` spec is vitest-only and needs no
// entry in that lane's skip list (the #212 hand-synced-copies debt).
import { describe, it, expect } from 'vitest'
import { existsSync, rmSync, writeFileSync, unlinkSync, symlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidenceDir } from '../harness/evidence-dir.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = join(REPO, 'harness', '.tmp')

describe('evidenceDir — the one place that decides where harness output lands', () => {
  it('returns the ignored root, and a subdir under it', () => {
    expect(evidenceDir()).toBe(ROOT)
    expect(evidenceDir('414')).toBe(join(ROOT, '414'))
    expect(evidenceDir('a/b')).toBe(join(ROOT, 'a', 'b'))
    rmSync(join(ROOT, 'a'), { recursive: true, force: true })
    rmSync(join(ROOT, '414'), { recursive: true, force: true })
  })

  // the exact strings ตู๋ escaped with, kept verbatim so a future "simplification" has to face them
  it.each([
    ['../pixel-proof', 'lands back inside the TRACKED directory this whole change exists to stop'],
    ['a/../../pixel-proof', 'same target, past any check that only looks for a leading ".."'],
    ['../../..', 'the parent of the repo — where every worktree on the machine lives'],
    ['/etc', 'an absolute path ignores the root entirely'],
    ['../.tmpX', 'a sibling whose name merely starts the same — a bare startsWith would pass it'],
  ])('refuses %s (%s)', (name) => {
    expect(() => evidenceDir(name)).toThrow(/outside the evidence root/)
  })

  it('validates BEFORE creating anything — a guard that throws after mkdir has already done the damage', () => {
    const escaped = join(dirname(REPO), '__evidence_dir_spec_probe')
    expect(existsSync(escaped)).toBe(false)
    expect(() => evidenceDir(`../../../__evidence_dir_spec_probe`)).toThrow()
    expect(existsSync(escaped)).toBe(false) // ← the assertion the first version would have failed
  })

  // 🔴 THIS TEST USED TO BE A LIE, AND THE NAME IS WHY IT MATTERED. The first version asserted the
  // path ENDS IN '.tmp' and called that "the one .gitignore covers" — it never opened .gitignore.
  // ตู๋ mutated the ignore rule to `harness/.tmpp/`, which breaks the entire point of #417, and all
  // eight specs stayed green plus the full 640-test suite. A tooth named after a class it does not
  // guard is worse than no tooth: the name is what stops the next person from writing the real one.
  // So git answers now, not string arithmetic.
  it('the root it hands out is REALLY ignored — git says so, not the string', () => {
    const probe = join(evidenceDir(), '__ignore_probe.png')
    writeFileSync(probe, '')
    try {
      // exit 0 = ignored. execFileSync throws on exit 1, which is exactly the failure we want to see.
      execFileSync('git', ['check-ignore', '-q', probe], { cwd: REPO })
    } finally {
      unlinkSync(probe)
    }
  })

  it('and the tracked directory this replaced is NOT ignored — the probe can tell the two apart', () => {
    // negative control on the probe itself: a check that answers "ignored" for everything proves nothing.
    const tracked = join(REPO, 'harness', 'pixel-proof', '__ignore_probe.png')
    writeFileSync(tracked, '')
    try {
      expect(() => execFileSync('git', ['check-ignore', '-q', tracked], { cwd: REPO })).toThrow()
    } finally {
      unlinkSync(tracked)
    }
  })

  // ตู๋'s second pass: `resolve` reads the string, so a symlinked root passes a check that is true
  // about the path and false about where the bytes land. The dangerous direction is .tmp -> pixel-proof.
  it('refuses to hand out a root that is a symlink', () => {
    const root = evidenceDir()
    const target = join(REPO, 'harness', '.tmp-symlink-spec-target')
    rmSync(root, { recursive: true, force: true })
    mkdirSync(target, { recursive: true })
    try {
      symlinkSync(target, root)
      expect(() => evidenceDir('shot')).toThrow(/symlink/)
    } finally {
      rmSync(root, { force: true })          // removes the LINK, not the target
      rmSync(target, { recursive: true, force: true })
      mkdirSync(root, { recursive: true })   // put the real directory back
    }
  })
})
