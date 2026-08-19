// ฟันของ #337 — เทสต์ที่สร้าง git sandbox ต้องไม่แตะ repo จริง แม้ตอนรันใต้ hook
//
// Bug-class: `execSync` inherits the whole env. Under a git hook, git exports GIT_DIR (and
// GIT_INDEX_FILE), and **GIT_DIR beats cwd** — so a sandbox built with mkdtempSync + `git init` in that
// directory still acts on whatever GIT_DIR points at. On 2026-08-19 this wrote `t <t@t> "base"` commits
// onto an open PR branch, created a `feature` branch nobody asked for, replaced the working tree with the
// synthetic fixture, and set core.bare=true in the shared .git/config (มุน found it, บอง reproduced it).
//
// 🔑 Why it survived review: run from a shell there is no GIT_DIR, so it is green AND harmless. It only
//    bites under a hook — which is the one place it runs every day. #335 wired lane 2 into pre-push and
//    turned a dormant file into a live hazard. **Green in the place you test ≠ safe in the place it runs.**
//
// 🔴 Registered in vitest.config.mts, not left to the tsx lane alone: a guard that only lives inside the
//    lane it guards dies together with it (ตู๋ M1 on #335).
import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const GIT_FREE: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)
const sh = (cmd: string, cwd: string, env = GIT_FREE) =>
  execSync(cmd, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] }).toString()

/** every scripts/*.test.ts that builds its own git sandbox — add here when a new one appears */
const SANDBOX_SPECS = [
  'scripts/guard-workflow-integrity.test.ts', // ตัวที่ระเบิดจริง 2026-08-19
  'scripts/pre-push-guard.test.ts', // รูปเดียวกัน ไม่ได้ระเบิดแต่มีรูปทรงเดียวกัน — สวีปเจอ (#338)
]

describe('#337 — เทสต์ที่สร้าง git sandbox ต้องไม่เขียนลง repo จริง', () => {
  for (const spec of SANDBOX_SPECS) {
    it(`${spec} ไม่แตะ repo ที่ GIT_DIR ชี้อยู่`, () => {
      const victim = mkdtempSync(join(tmpdir(), 'victim-'))
      try {
        sh('git init -q -b main', victim)
        sh('git -c user.email=v@v -c user.name=v commit -q --allow-empty -m first', victim)
        const before = sh('git rev-list --count HEAD', victim).trim()
        const branchesBefore = sh(`git for-each-ref --format='%(refname:short)' refs/heads/`, victim).trim()
        assert.equal(before, '1', 'control: victim repo did not start from a known state')

        // run the spec the way a git hook would: GIT_DIR already exported, pointing at the victim
        try {
          execSync(`npx tsx ${resolve(spec)}`, {
            cwd: process.cwd(),
            env: { ...GIT_FREE, GIT_DIR: join(victim, '.git') },
            stdio: ['pipe', 'pipe', 'pipe'],
          })
        } catch {
          /* the spec's own pass/fail is not what this guard measures — the victim's state is */
        }

        const after = sh('git rev-list --count HEAD', victim).trim()
        const branchesAfter = sh(`git for-each-ref --format='%(refname:short)' refs/heads/`, victim).trim()
        const bare = sh('git config --get core.bare || true', victim).trim()

        assert.equal(after, before, `${spec} wrote ${Number(after) - Number(before)} commit(s) into the repo GIT_DIR pointed at`)
        assert.equal(branchesAfter, branchesBefore, `${spec} created or moved branches in the real repo: ${branchesAfter}`)
        assert.notEqual(bare, 'true', `${spec} set core.bare=true on the real repo`)
      } finally {
        rmSync(victim, { recursive: true, force: true })
      }
      // 60s: this spawns `npx tsx` on another spec that itself builds git repos — the default 5s is not
      // enough, and a timeout here would read as "guard failed" instead of "guard was too slow".
    }, 60_000)
  }
})
