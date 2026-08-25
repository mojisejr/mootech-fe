// #403 — the pure half of the ".env.example must declare every env the app reads" guard.
//
// WHY THE PARSING LIVES HERE AND NOT IN THE SPEC: the spec's job is to state the invariant; this file's
// job is to be WRONG-ABLE. Everything below is a pure string→string function, so the guard can be pointed
// at a SYNTHETIC tree in the same test run and asked to prove it still reports — a guard that only ever
// runs against a passing tree cannot tell "nothing is undeclared" from "nothing was searched"
// (that failure mode has bitten this team: a grep over a directory that moved returns 0 and reads as green).

/** Strip comments so a var NAMED in prose is not counted as a read. */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .map((l) => l.replace(/\s\/\/.*$/, ''))
    .join('\n')
}

/** `const FOO_ENV = 'BAR'` -> Map('FOO_ENV' -> 'BAR'). Only ALL-CAPS values, i.e. env-name shaped. */
export function envAliasesIn(src: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of stripComments(src).matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*['"`]([A-Z][A-Z0-9_]*)['"`]/g,
  )) {
    out.set(m[1], m[2])
  }
  return out
}

/** Every `env[...]` / `process.env[...]` subscript in a file, as the raw text inside the brackets. */
export function dynamicEnvKeysIn(src: string): string[] {
  return [...stripComments(src).matchAll(/(?:process\.)?env\s*\[\s*([^\]\n]+?)\s*\]/g)].map((m) => m[1])
}

/**
 * Env vars READ by a source file. THREE shapes, because the app uses all three:
 *   1. `process.env.FOO`                          - direct
 *   2. `env['FOO']` / `process.env['FOO']`         - literal subscript
 *   3. `const FOO_ENV = 'FOO'` + `env[FOO_ENV]`    - const alias (lib/payment/webhook-endpoint.ts:24,49)
 *
 * WHY SHAPE 3 EXISTS HERE (too 2026-08-24, PR #425): this function used to read shape 1 only. A var read
 * through an alias was invisible, so deleting its line from `.env.example` left the guard GREEN - the
 * protection we believed in was not there. Pin 5 was supposed to make that loud and did not: it searched
 * for the literal `process.env[`, and the alias form writes `env[`.
 *
 * STILL BLIND (stated, because a guard that overstates its reach is worse than none): a computed key
 * (`env[prefix + name]`) resolves to no literal. Pin 5 REDDENS on that case instead of ignoring it - the
 * guard refuses to stay green over a read it cannot name.
 */
export function envReadsIn(src: string): string[] {
  const clean = stripComments(src)
  const direct = [...clean.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1])
  const aliases = envAliasesIn(src)
  const viaSubscript = dynamicEnvKeysIn(src).flatMap((k) => {
    const literal = /^['"`]([A-Z][A-Z0-9_]*)['"`]$/.exec(k)
    if (literal) return [literal[1]]
    const aliased = aliases.get(k)
    return aliased ? [aliased] : []
  })
  return [...direct, ...viaSubscript]
}

/** Subscript reads this guard could NOT resolve to an env name - pin 5 fails on any of these. */
export function unresolvedDynamicKeysIn(src: string): string[] {
  const aliases = envAliasesIn(src)
  return dynamicEnvKeysIn(src).filter(
    (k) => !/^['"`][A-Z][A-Z0-9_]*['"`]$/.test(k) && !aliases.has(k),
  )
}

/** Keys DECLARED by a .env.example — `KEY=` at the start of a line; `#` comments and blanks ignored. */
export function envDeclaredIn(exampleText: string): string[] {
  return exampleText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1])
    .filter((k): k is string => !!k)
}

export type DriftReport = {
  /** how many files were actually opened — 0 means the walk found nothing, NOT that the tree is clean */
  filesScanned: number
  /** how many `process.env.X` reads were seen in total */
  readsFound: number
  /** vars the code reads that .env.example does not declare, sorted */
  undeclared: string[]
}

/** PURE: given the already-read sources and the example text, report the drift. */
export function envDrift(sources: string[], exampleText: string): DriftReport {
  const declared = new Set(envDeclaredIn(exampleText))
  const reads = new Set(sources.flatMap(envReadsIn))
  return {
    filesScanned: sources.length,
    readsFound: reads.size,
    undeclared: [...reads].filter((k) => !declared.has(k)).sort(),
  }
}
