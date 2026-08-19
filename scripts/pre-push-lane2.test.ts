// ฟันของ #334 — .githooks/pre-push ต้องยังรัน tsx lane อยู่.
//
// Bug-class this exists for: #321 moved ci.yml into .github/workflows/archive/, and ci.yml's lane 2 was
// the ONLY thing running the 74 plain node:assert scripts/*.test.ts. Nothing said so — `npm test`
// (vitest, 27 files from a hand-listed include) stayed green about a pile that had shrunk ~3x.
// #334 moved that lane into pre-push. If someone deletes it again, this test goes red.
//
// 🔴 It asserts the LOOP, not a comment: a mutant that keeps the echo line and deletes the `for` still fails.
// ⚠️ This file itself only runs in that lane — which is the point: the lane proves it can run its own guard.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const hook = readFileSync(join(process.cwd(), '.githooks/pre-push'), 'utf8')

// ① the loop exists and globs the whole directory (a hand-listed set would drift like vitest's include — debt #212)
assert.match(hook, /for f in scripts\/\*\.test\.ts; do/, 'pre-push lost the tsx lane loop over scripts/*.test.ts')
assert.match(hook, /npx tsx "\$f"/, 'pre-push lane no longer executes the files it globs')

// ② it must FAIL the push when a file fails — a lane that only prints is not a gate
assert.match(hook, /lane2_failed=1/, 'pre-push lane no longer records failures')
assert.match(hook, /\[ "\$lane2_failed" -eq 0 \]/, 'pre-push lane no longer blocks the push on failure')

// ③ empty-run guard: matching 0 files must NOT read as green (the exact shape #334 was opened for)
assert.match(hook, /\[ "\$lane2_ran" -gt 0 \]/, 'pre-push lane would pass silently when the glob matches nothing')

// ④ negative control — proves the assertions above are not vacuously true against any text
assert.doesNotMatch('echo hello', /for f in scripts\/\*\.test\.ts; do/, 'control: matcher fires on unrelated text')

console.log('✓ pre-push tsx lane guard: loop present · fails closed · empty run blocked')
