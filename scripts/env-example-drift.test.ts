// #403 — `.env.example` must declare every env var the app reads.
//
// ANCHOR: scripts/env-example-drift.test.ts#env-example-declares-what-the-app-reads
// Bug-class this owns: an env var the code reads but nobody documents. It is NOT a security hole — every
// one of them fails CLOSED. It is a MISDIRECTION hole: the error a missing var produces names the wrong
// cause. `OMISE_WEBHOOK_SECRET` unset → the route answers `401 invalid signature`, so the next person goes
// hunting an HMAC bug; `CONSENT_SECRET` unset → the BE answers 401, so they go hunting BE auth. Only
// `OMISE_SECRET_KEY` says its own name (it throws). Two of those three are on the money/PDPA lane.
//
// 🔴 SCOPE, STATED SO THE NUMBER IS NOT READ WIDER THAN IT IS: lib/ · pages/ · features/.
// next.config.mjs, middleware.ts and testenv/ read env too and are NOT scanned here. Widening the scope
// is a follow-up, not a silent change — this list is the contract, and a reader must be able to see it.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   ME1  delete a key from .env.example that the app reads            → ① reddens, naming that key
//   ME2  add `process.env.TOO_UNDECLARED` to a scanned file           → ① reddens, naming it
//   ME3  break the walk so it returns no files                        → ③ reddens (0 files ≠ clean tree)
//   ME4  stop stripping comments before matching                      → ④ reddens
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { envDrift, envReadsIn, envDeclaredIn } from './_helpers/env-declared'

const SCANNED_ROOTS = ['lib', 'pages', 'features'] as const

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return /\.tsx?$/.test(p) ? [p] : []
  })
}

const files = SCANNED_ROOTS.flatMap((r) => walk(r))
const sources = files.map((f) => readFileSync(f, 'utf8'))
const example = readFileSync('.env.example', 'utf8')
const report = envDrift(sources, example)

describe('#403 .env.example declares every env the app reads', () => {
  // ① THE GUARD.
  it('🔴 ① no env var is read without being declared', () => {
    expect(
      report.undeclared,
      `these are read in ${SCANNED_ROOTS.join('/')} but missing from .env.example:\n  ` +
        report.undeclared.join('\n  '),
    ).toEqual([])
  })

  // ② The file says this about itself on line 2. Now something enforces it.
  it('② the claim .env.example makes in its own header is the claim this file checks', () => {
    expect(example.split('\n')[1]).toContain('process.env')
  })

  // ③ 🔴 A ZERO THAT CAME FROM NOWHERE TO SEARCH IS NOT A PASS.
  // If the walk breaks (a root renamed, a glob that stops matching), `undeclared` is [] and ① goes green
  // while nothing was checked. These lower bounds are deliberately loose — they exist to catch "the
  // scanner found nothing", not to pin a count that drifts with every new file.
  it('🔴 ③ the scan actually opened files and saw reads', () => {
    expect(report.filesScanned).toBeGreaterThan(100)
    expect(report.readsFound).toBeGreaterThan(20)
    expect(envDeclaredIn(example).length).toBeGreaterThan(20)
  })

  // ④ 🔴 THE GUARD MUST STILL REPORT WHEN THERE IS SOMETHING TO REPORT.
  // Run the SAME detector over a synthetic source that declares nothing — if this comes back empty, the
  // detector is broken and ① is green for the wrong reason. This is the control that can fail; without it
  // ① proves only that `undeclared` is an empty array, which it would also be if envReadsIn returned [].
  it('🔴 ④ the same detector, pointed at a tree that IS drifting, reports it', () => {
    // Self-contained on purpose: the example text is synthetic too, so this control cannot be knocked
    // over by an unrelated edit to the real .env.example (removing a key from it used to redden BOTH ①
    // and this — two reds for one cause reads as two problems).
    const synthetic = envDrift(
      [
        'const a = process.env.TOO_SYNTHETIC_UNDECLARED',
        '// process.env.TOO_ONLY_IN_A_COMMENT — must NOT count as a read',
        'const b = process.env.TOO_SYNTHETIC_DECLARED',
      ],
      '# a synthetic example file\nTOO_SYNTHETIC_DECLARED=\n',
    )
    expect(synthetic.undeclared).toEqual(['TOO_SYNTHETIC_UNDECLARED'])
    expect(synthetic.undeclared).not.toContain('TOO_ONLY_IN_A_COMMENT') // comment-stripping has teeth
  })

  // ⑤ The blind spot, pinned rather than described: dynamic access is invisible to this guard, so the
  // guard's promise only holds while nobody uses it in the scanned scope. If this goes red, the guard's
  // reach shrank and the header's claim needs rewriting — that is the point of failing here.
  it('⑤ nothing in the scanned scope reads env dynamically (the one thing this guard cannot see)', () => {
    const dynamic = files.filter((f, i) => /process\.env\s*\[/.test(sources[i]))
    expect(dynamic, `dynamic env access is invisible to this guard: ${dynamic.join(', ')}`).toEqual([])
  })

  it('envReadsIn ignores prose and finds real reads', () => {
    expect(envReadsIn('// process.env.NOPE\nconst x = process.env.YES')).toEqual(['YES'])
    expect(envReadsIn('/* process.env.NOPE */ const x = process.env.YES')).toEqual(['YES'])
  })
})
