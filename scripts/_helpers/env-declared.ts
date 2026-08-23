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

/**
 * Env vars READ by a source file: `process.env.FOO` only.
 * ⚠️ KNOWN BLIND SPOT, stated because a guard that overstates its reach is worse than none:
 * dynamic access (`process.env[key]`) is invisible here. There is no such call in the scanned scope
 * today (the spec pins that), and if one appears this guard will not see the var it reads.
 */
export function envReadsIn(src: string): string[] {
  return [...stripComments(src).matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1])
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
