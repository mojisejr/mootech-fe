// #441 — a new test file that nobody registers must not stay INVISIBLE.
//
// ANCHOR: scripts/vitest-include-drift.test.ts#every-test-file-is-owned-by-a-lane
//
// 🔴 THE BUG-CLASS THIS OWNS. `vitest.config.mts` names the specs it runs in a HAND-WRITTEN list. Write a
// new spec, forget to add it, and there is no red anywhere: `npm test` is green (it never saw the file),
// `npx vitest run <that file>` says "No test files found", and the PR looks tidy. The tooth you think you
// just grew was never in the mouth. That happened on #437 and was only caught because the author happened
// to run the single file to look at its output.
//
// 🔴 WHAT IS ALREADY COVERED — do not re-guard it here, and do not report it as a hole.
// `.githooks/pre-push` (#334) globs `scripts/*.test.ts` and runs everything vitest does NOT own through
// `tsx`. So an unregistered **.test.ts** already reddens at push time (a spec that imports from 'vitest'
// cannot run under tsx, so it dies loudly). Measured on this tree: "tsx lane green (75 files)".
//
// 🔴 THE HOLE THAT IS LEFT, AND IT IS EXACTLY ONE. That glob is `scripts/*.test.ts` — it does not match
// `.tsx`. `vitest.config.mts:14` says so in a comment ("invisible to that lane by extension") and then
// nothing enforces it. So an unregistered **.test.tsx** is run by NOBODY and says NOTHING. Today all 52
// .test.tsx files are registered; this file is what keeps that true tomorrow.
//
// 🔴 THE TARGET IS "N THAT WE CAN EXPLAIN", NOT ZERO. 75 scripts/*.test.ts are deliberately outside
// vitest's include — they are plain node:assert scripts owned by the tsx lane. A guard demanding 0 would
// be wrong about this repo and would be silenced within a week. So ④ does not ask them to join vitest; it
// asks them to still be runnable by the lane that DOES own them.
//
// 🔴 MUTANT CONTRACT (each must redden `npm test`; fired for real, results in the PR):
//   M1  add scripts/anything.test.tsx and leave it out of include   → ① reddens, naming the file
//   M2  add an include entry pointing at a file that does not exist → ② reddens, naming the entry
//   M3  add scripts/anything.test.ts that imports from 'vitest' and leave it out of include → ④ reddens
//   M4  break the disk read so it yields nothing                    → ③ reddens (0-from-0 is not clean)
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const CONFIG = 'vitest.config.mts'

// The include list, read the same way `.githooks/pre-push` reads it — one source of truth, on purpose.
// If these two ever disagree about what vitest owns, the tsx lane runs a vitest spec under tsx and the
// failure names nothing that has to do with the change being pushed.
function includedSpecs(configText: string): string[] {
  return [...configText.matchAll(/'(scripts\/[^']+\.test\.tsx?)'/g)].map((m) => m[1]).sort()
}

function testFilesOnDisk(): string[] {
  return readdirSync('scripts', { withFileTypes: true })
    .filter((e) => e.isFile() && /\.test\.tsx?$/.test(e.name))
    .map((e) => `scripts/${e.name}`)
    .sort()
}

const config = readFileSync(CONFIG, 'utf8')
const included = includedSpecs(config)
const onDisk = testFilesOnDisk()
const tsx = onDisk.filter((f) => f.endsWith('.test.tsx'))
const ts = onDisk.filter((f) => f.endsWith('.test.ts'))
const unlistedTs = ts.filter((f) => !included.includes(f))

describe('every scripts/ test file is owned by a lane (#441)', () => {
  it('① every .test.tsx is in vitest include — the tsx lane globs *.test.ts and cannot see them', () => {
    const orphans = tsx.filter((f) => !included.includes(f))
    expect(
      orphans,
      `these .test.tsx files are run by NOTHING: not by vitest (absent from ${CONFIG} include) and not by ` +
        `the pre-push tsx lane (its glob is scripts/*.test.ts). Add them to the include list.`,
    ).toEqual([])
  })

  it('② every include entry points at a file that exists — a stale entry is a lane pointed at nothing', () => {
    const stale = included.filter((f) => !onDisk.includes(f))
    expect(stale, `${CONFIG} include lists files that are not on disk`).toEqual([])
  })

  it('③ the disk read actually found test files — 0-from-0 reads exactly like a clean tree', () => {
    // Without this, breaking the readdir turns ① ② ④ into three assertions over empty sets, and the suite
    // reports green while checking nothing. The floor is read from the tree, never hard-coded: pinning a
    // number here would rot the same way #442's `toBe(24)` did.
    expect(onDisk.length).toBeGreaterThan(0)
    expect(tsx.length).toBeGreaterThan(0)
    expect(included.length).toBeGreaterThan(0)
  })

  it('④ every .test.ts outside include is still runnable by the tsx lane (no vitest import)', () => {
    const broken = unlistedTs.filter((f) => /from '(vitest)'/.test(readFileSync(f, 'utf8')))
    expect(
      broken,
      `these .test.ts files import from 'vitest' but are NOT in ${CONFIG} include. vitest never runs them, ` +
        `and the pre-push tsx lane dies on the import with an error that names nothing about your change. ` +
        `Either add them to include, or rewrite them as node:assert scripts.`,
    ).toEqual([])
  })
})
