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

// ── the two bounds, and why they are two (#393) ──────────────────────────────────────────────────────
// CHILD_TIMEOUT_MS is a HANG detector, not a performance budget. That is why growing the test suite cannot
// make it fire again the way 60s did: "slow" and "hung" are different quantities. Slow has been measured
// (6.7s idle → 85s worst under load) and the guard's VERDICT does not depend on it at all — the verdict is
// read from the victim repo AFTER the child returns, however long that took. Hung has no upper bound at
// all, and before this option existed a hung child would have blocked the run forever, because a vitest
// ceiling cannot interrupt a synchronous execSync (proven; see the note at the call site).
const CHILD_TIMEOUT_MS = 120_000
// Strictly greater, so the bound that can kill the child always fires first and the failure message is the
// one that names what happened. If these two ever cross, the useless timeout wins again.
const VITEST_CEILING_MS = 300_000

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
        const t0 = Date.now()
        let killed = false
        try {
          execSync(`npx tsx ${resolve(spec)}`, {
            cwd: process.cwd(),
            env: { ...GIT_FREE, GIT_DIR: join(victim, '.git') },
            stdio: ['pipe', 'pipe', 'pipe'],
            // 🔴 THE bound that can actually act (#393). A vitest test timeout CANNOT interrupt execSync —
            // it blocks the worker thread, so vitest only reports afterwards, once the child has already
            // finished. Measured: execSync('sleep 6') under a 2s vitest timeout returned normally at
            // 6051ms and vitest reported "timed out" at 6061ms — the child was never killed. With this
            // option the child dies at the bound (2002ms, signal SIGKILL). So the old 60s ceiling bounded
            // NOTHING; it only turned "slow but successful" into "failed".
            timeout: CHILD_TIMEOUT_MS,
            killSignal: 'SIGKILL',
          })
        } catch (e) {
          // The spec's own pass/fail is not what this guard measures — the victim's state is.
          // A KILL is the one exception: the child was cut off, so the victim's state proves nothing
          // either way and must not be read as "clean".
          const err = e as { signal?: string; code?: string }
          if (err?.signal === 'SIGKILL' || err?.code === 'ETIMEDOUT') killed = true
        }
        const elapsed = Date.now() - t0
        // 🔑 The distinction this file has warned about since it was written: a hang must not read as an
        // isolation failure. Now it says so in the message instead of hoping the reader checks.
        assert.ok(
          !killed,
          `TOO SLOW / HUNG — ${spec} was killed after ${elapsed}ms. This is NOT "the isolation guard failed": ` +
            `nothing was proven about the repo either way. Measured baselines on an idle machine: ` +
            `guard-workflow-integrity ~6.7s, pre-push-guard ~3.8s; under a saturated 8-worker suite the same ` +
            `work has been observed at 85s (#393). If this fires, look for a real hang, not for a leak.`,
        )

        const after = sh('git rev-list --count HEAD', victim).trim()
        const branchesAfter = sh(`git for-each-ref --format='%(refname:short)' refs/heads/`, victim).trim()
        const bare = sh('git config --get core.bare || true', victim).trim()

        assert.equal(after, before, `${spec} wrote ${Number(after) - Number(before)} commit(s) into the repo GIT_DIR pointed at`)
        assert.equal(branchesAfter, branchesBefore, `${spec} created or moved branches in the real repo: ${branchesAfter}`)
        assert.notEqual(bare, 'true', `${spec} set core.bare=true on the real repo`)
      } finally {
        rmSync(victim, { recursive: true, force: true })
      }
      // The vitest ceiling is DELIBERATELY larger than CHILD_TIMEOUT_MS and is no longer the protection
      // (#393). It used to be 60s, which sat in the middle of this case's natural spread — measured on one
      // machine, one commit: 16.3s / 17.0s / 21.2s / 39.7s / 40.4s / 47.1s / 85.3s. Same code, same commit;
      // the variable is cache warmth and how many workers are competing, not anything this guard does.
      // A pass/fail line drawn through the middle of that spread is a coin flip, and a coin-flip gate
      // teaches people to rerun until green — which is the same as having no gate.
    }, VITEST_CEILING_MS)
  }
})
