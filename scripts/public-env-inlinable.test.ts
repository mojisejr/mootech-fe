// #432 — every NEXT_PUBLIC_* the client reads must be written in a shape the BUNDLER can substitute.
//
// ANCHOR: scripts/public-env-inlinable.test.ts#public-env-must-be-inlinable
// Bug-class this owns: a browser env var that is read through an ALIAS. Next/webpack substitutes a value
// only where the source literally says `process.env.NAME`. Written as `env[NAME_CONST]` there is nothing
// to substitute, so the compiled chunk carries the NAME as a string and ships NO VALUE. The var is then
// `undefined` in every browser on every deploy — and NOTHING says so: the build is green, the env is set
// on Vercel, `.env.example` declares it, and the feature simply does not work.
//
// This is not hypothetical. `features/v2-shop/omise-token.ts` shipped exactly this for days. Card payment
// on /v2 threw OmiseKeyMissingError before a request ever left the browser; `v2_payment` stayed empty
// while `payment_quote` filled up, which reads as "users abandon at checkout" rather than "it is broken".
//
// 🔑 WHY THIS GUARD IS SHAPED AS A PROPERTY AND NOT A FILE CHECK: the tempting version is "omise-token.ts
// must contain the literal process.env.NEXT_PUBLIC_OMISE_KEY_V2". That guards ONE SPELLING in ONE FILE —
// the same mistake pin ⑤ of env-example-drift made (ตู๋, PR #425): it searched for `process.env[` and the
// alias form wrote `env[`, so it watched the spelling instead of the thing. The invariant here is
// repo-wide and about shape: NO NEXT_PUBLIC_* may be reached through a subscript, anywhere.
//
// SCOPE, stated so the number is not read wider than it is: lib/ · pages/ · features/ · components/.
// A server-only subscript read is FINE (process.env is real at runtime) — this guard only fails when the
// resolved name starts with NEXT_PUBLIC_, because only those must survive bundling.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MP1  revert omise-token.ts to `env[V2_OMISE_KEY_ENV]`     → ① reddens, naming the file and the var
//   MP2  make the synthetic fixture stop being detected       → ② reddens (the detector is proven, so a
//                                                                clean ① cannot be confused with a
//                                                                broken scan — "0 found" ≠ "0 exists")
//   MP3  narrow SCANNED_ROOTS                                 → ③ reddens (scope is asserted, not assumed)
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { envAliasesIn, dynamicEnvKeysIn } from './_helpers/env-declared'

const SCANNED_ROOTS = ['lib', 'pages', 'features', 'components'] as const

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return /\.tsx?$/.test(p) ? [p] : []
  })
}

/** Names reached through `env[...]` in one source, resolved through const-aliases where possible. */
function subscriptReadNames(src: string): string[] {
  const aliases = envAliasesIn(src)
  return dynamicEnvKeysIn(src).flatMap((k) => {
    const literal = /^['"`]([A-Z][A-Z0-9_]*)['"`]$/.exec(k)
    if (literal) return [literal[1]]
    const aliased = aliases.get(k)
    return aliased ? [aliased] : []
  })
}

const files = SCANNED_ROOTS.flatMap((r) => walk(r))
const offenders = files
  .map((f) => ({ f, pub: subscriptReadNames(readFileSync(f, 'utf8')).filter((n) => n.startsWith('NEXT_PUBLIC_')) }))
  .filter((x) => x.pub.length > 0)

describe('#432 a NEXT_PUBLIC_ var must be written so the bundler can inline it', () => {
  // ① THE GUARD.
  it('🔴 ① no NEXT_PUBLIC_* is read through a subscript', () => {
    expect(
      offenders.map((x) => `${x.f} → env[…] resolves to ${x.pub.join(', ')}`),
      'these ship as undefined in the browser no matter what the deploy env holds:\n  ' +
        offenders.map((x) => `${x.f}: ${x.pub.join(', ')}`).join('\n  '),
    ).toEqual([])
  })

  // ② THE DETECTOR IS PROVEN. Without this, ① passing is indistinguishable from ① not looking.
  it('② the same detector catches a synthetic offender (so a clean ① means something)', () => {
    const bad = `const K = 'NEXT_PUBLIC_SYNTHETIC_OFFENDER'\nconst v = env[K]`
    expect(subscriptReadNames(bad)).toContain('NEXT_PUBLIC_SYNTHETIC_OFFENDER')
    expect(subscriptReadNames(`const v = process.env['NEXT_PUBLIC_SYNTHETIC_LITERAL']`)).toContain(
      'NEXT_PUBLIC_SYNTHETIC_LITERAL',
    )
    // and the shape that IS safe stays out of the report
    expect(subscriptReadNames(`const v = process.env.NEXT_PUBLIC_FINE`)).toEqual([])
    // a server-only var read by subscript is allowed — only NEXT_PUBLIC_ must survive bundling
    expect(subscriptReadNames(`const K = 'SERVER_ONLY'\nconst v = env[K]`)).toEqual(['SERVER_ONLY'])
  })

  // ③ SCOPE IS ASSERTED, NOT ASSUMED — features/ has been dropped from a folder list four times in this
  //    repo (mootech-fe#431). A guard whose scope can shrink silently is the bug it is guarding against.
  it('③ the scanned scope is the one the header claims, and it is not empty', () => {
    expect([...SCANNED_ROOTS]).toEqual(['lib', 'pages', 'features', 'components'])
    expect(files.length).toBeGreaterThan(300)
    for (const root of SCANNED_ROOTS) {
      expect(files.some((f) => f.startsWith(root + '/')), `no file scanned under ${root}/`).toBe(true)
    }
  })
})
