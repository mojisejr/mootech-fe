// ฟันของ #334 — .githooks/pre-push ต้องยังรัน tsx lane อยู่.
//
// Bug-class this exists for: #321 moved ci.yml into .github/workflows/archive/, and ci.yml's lane 2 was
// the ONLY thing running the 74 plain node:assert scripts/*.test.ts. Nothing said so — `npm test`
// (vitest, 27 files from a hand-listed include) stayed green about a pile that had shrunk ~3x.
// #334 moved that lane into pre-push. If someone deletes it again, this test goes red.
//
// 🔴 It asserts the LOOP, not a comment: a mutant that keeps the echo line and deletes the `for` still fails.
// 🔴 REGISTERED IN vitest.config.mts ON PURPOSE (ตู๋ M1, #335). It used to run ONLY inside lane 2, and
//    that made it blind to the one mutant that matters: DELETE the lane and both teeth vanish with it, so
//    `npm test` stays green — the exact shape of #321 (ci.yml archived, npm test green for 12 more hours).
//    A guard that dies together with the thing it guards is not a guard. Living in vitest means the tsx
//    lane skips it (derived skip list) and `npm test` runs it, so removing the lane goes RED.
import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

describe('#334 — .githooks/pre-push ยังรัน tsx lane อยู่', () => {
  it('hook ยังมี lane 2 ครบทุกคุณสมบัติที่ทำให้มันเป็นด่าน ไม่ใช่แค่คำสั่ง', () => {
  const hook = readFileSync(join(process.cwd(), '.githooks/pre-push'), 'utf8')

  // ① the loop exists and globs the whole directory (a hand-listed set would drift like vitest's include — debt #212)
  assert.match(hook, /for f in scripts\/\*\.test\.ts; do/, 'pre-push lost the tsx lane loop over scripts/*.test.ts')
  assert.match(hook, /npx tsx "\$f"/, 'pre-push lane no longer executes the files it globs')

  // ② it must FAIL the push when a file fails — a lane that only prints is not a gate
  assert.match(hook, /lane2_failed=1/, 'pre-push lane no longer records failures')
  assert.match(hook, /\[ "\$lane2_failed" -eq 0 \]/, 'pre-push lane no longer blocks the push on failure')

  // ③ empty-run guard: matching 0 files must NOT read as green (the exact shape #334 was opened for)
  assert.match(hook, /\[ "\$lane2_ran" -gt 0 \]/, 'pre-push lane would pass silently when the glob matches nothing')

  // ④ the skip list must be DERIVED from vitest.config.mts, never hand-copied.
  //    Hard-coded names were the original bug: a spec that imports from 'vitest' cannot run under tsx, so
  //    the moment someone adds a .test.ts spec to vitest's include, this lane grabs it and blocks every
  //    push in the repo. #332 does exactly that with five files. (มุน found it by merging all three
  //    open branches together — each one was green alone.)
  assert.match(hook, /vitest_specs=\$\(grep .*vitest\.config\.mts/, 'pre-push lane no longer derives its skip list from vitest.config.mts')
  assert.match(hook, /grep -qxF "\$f"/, 'pre-push lane no longer consults the derived list per file')
  assert.doesNotMatch(hook, /scripts\/logout-clears-caches\.test\.ts\|scripts\/v2-tier\.test\.ts/, 'a hand-copied skip list is back — that is the bug this guard exists for')

  // ⑤ THE invariant, checked against real files rather than hook text:
  //    every scripts/*.test.ts that imports from 'vitest' must be registered in vitest.config.mts.
  //    Unregistered → vitest never runs it AND the tsx lane dies on it. Both lanes lose at once.
  const cfg = readFileSync(join(process.cwd(), 'vitest.config.mts'), 'utf8')
  const registered = new Set((cfg.match(/'scripts\/[^']+\.test\.tsx?'/g) ?? []).map((q) => q.slice(1, -1)))
  assert.ok(registered.size > 0, 'parsed 0 specs out of vitest.config.mts — the check below would be vacuous')

  const all = readdirSync(join(process.cwd(), 'scripts')).filter((f) => f.endsWith('.test.ts'))
  assert.ok(all.length > 0, 'found 0 scripts/*.test.ts — this guard would pass over an empty set')
  const orphans = all
    .map((f) => `scripts/${f}`)
    .filter((p) => /^import .*from 'vitest'/m.test(readFileSync(join(process.cwd(), p), 'utf8')))
    .filter((p) => !registered.has(p))
  assert.deepEqual(orphans, [], `these import from 'vitest' but are not in vitest.config.mts include — vitest skips them and the tsx lane dies on them:\n  ${orphans.join('\n  ')}`)

  // ⑥ the two guards that went down with ci.yml must have a runner here (#334)
  assert.match(hook, /npx tsx scripts\/verify-architecture\.ts/, 'pre-push lost verify-architecture — it has run nowhere since #321 archived ci.yml')
  assert.match(hook, /scripts\/guard-workflow-integrity\.ts/, 'pre-push lost guard-workflow-integrity — same orphan as above')

  // ⑦ a skipped spec must be announced, not swallowed. vitest prints "N skipped" in a line that scrolls
  //    past; push-concurrency is gated behind TEST_DATABASE_URL and would otherwise never run silently
  //    (ตู๋'s N3 on #332) — the same shape as the 74 files this whole lane exists to recover.
  assert.match(hook, /skipped=\$\(printf/, 'pre-push no longer looks for skipped specs')
  assert.match(hook, /ไม่ได้วิ่ง/, 'pre-push no longer says out loud that a skipped spec did not run')

  // ⑧ negative control — proves the matchers are not vacuously true against any text
  assert.doesNotMatch('echo hello', /for f in scripts\/\*\.test\.ts; do/, 'control: matcher fires on unrelated text')

  // eslint-disable-next-line no-console
    console.log(`✓ pre-push tsx lane guard: loop present · fails closed · empty run blocked · skip list derived (${registered.size} specs) · ${all.length} .test.ts scanned, 0 orphaned`)

  })
})