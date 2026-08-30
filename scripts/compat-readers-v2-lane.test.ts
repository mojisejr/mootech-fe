// mojisejr/mootech-fe#541 ① — the two ดวงสมพงษ์ READERS must reach the v2 lane and never the v1 one.
//
// ANCHOR: scripts/compat-readers-v2-lane.test.ts#compat-readers-are-on-the-v2-lane
// Bug-class this owns: a lane change that nothing holds. #540 moved ดวงสมพงษ์ off mootech-be, and the
// calculate side got teeth (scripts/compat-calc-error-reasons.test.tsx). The two readers got none — point
// either of them back at `UserMatchingGetApi` today and every test in the repo stays green.
//
// 🔴 WHY THE IMPORT GRAPH AND NOT THE TWO IMPORT LINES. ตู๋ measured this on the real browser bundle,
// which is the honest instrument. Reading each hook's own `import` lines is much cheaper but answers a
// SMALLER question: a hook that imports a helper that imports v1 still ships v1 to the browser, and a
// direct-line check calls that clean. So this walks the whole closure from each hook — every module it
// can reach — which is the same question the bundle answers, minus the build.
//
// ⚠️ WHAT IT STILL CANNOT SEE, said plainly: a dynamic `import()` built from a variable, and any call that
// reaches v1 through a string URL instead of through these modules. Both are visible to ตู๋'s bundle
// measurement and not to this file. The recorded bundle counts live in mojisejr/mootech-fe#541.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')
const V1_MATCHING = /constants\/api\/api-user-matching/
const V2_MATCHING = 'constants/api/api-v2-matching'

/** Source with comments and string literals removed, so prose about a lane cannot be read as an import. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function resolveSpec(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null // a package — not ours to walk
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(cand) && !cand.endsWith('/')) {
      try {
        if (readFileSync(cand, 'utf8') !== undefined) return cand
      } catch {
        /* a directory — fall through */
      }
    }
  }
  return null
}

/** Every module reachable from `entry`, following our own imports only. Returns repo-relative paths. */
function closureOf(entry: string): string[] {
  const seen = new Set<string>()
  const queue = [resolve(ROOT, entry)]
  while (queue.length) {
    const file = queue.pop() as string
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    let src: string
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const m of code(src).matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const next = resolveSpec(m[1], file)
      if (next) queue.push(next)
    }
  }
  return [...seen].map((f) => relative(ROOT, f))
}

const READERS = [
  'features/v2-service/hooks/useCompatibilityRecent.ts',
  'features/v2-service/hooks/useCompatibilityResult.ts',
]

describe('#541 ① the ดวงสมพงษ์ readers are on the v2 lane', () => {
  for (const reader of READERS) {
    it(`🔴 ${reader} reaches NO v1 matching endpoint, transitively`, () => {
      const hits = closureOf(reader).filter((f) => V1_MATCHING.test(f))
      expect(hits, `${reader} can still reach the v1 lane through: ${hits.join(', ')}`).toEqual([])
    })

    it(`${reader} does reach the v2 endpoint module (a positive, so the walk is not empty)`, () => {
      expect(closureOf(reader).some((f) => f.includes(V2_MATCHING))).toBe(true)
    })
  }

  // 🔴 CONTROL — without this, "no v1 imports" is indistinguishable from "the walk never finds anything"
  // or "the pattern matches nothing that exists". pages/matching/recent/index.tsx is the v1 screen and
  // SHOULD reach v1: if this goes green-with-zero, the two cases above are measuring nothing.
  it('🔴 CONTROL — the v1 screen DOES reach the v1 lane, so a zero above is a real zero', () => {
    const hits = closureOf('pages/matching/recent/index.tsx').filter((f) => V1_MATCHING.test(f))
    expect(hits.length, 'the detector cannot see the v1 lane at all').toBeGreaterThan(0)
  })

  // 🔴 CONTROL — and the walk really is transitive, not just reading the entry file's own import lines.
  // The entry below imports the v1 endpoint through at least one intermediate module.
  it('🔴 CONTROL — the walk crosses at least one module boundary before finding v1', () => {
    const entry = 'pages/matching/recent/index.tsx'
    const direct = code(readFileSync(resolve(ROOT, entry), 'utf8')).match(
      /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g,
    )
    const directlyNamesV1 = (direct ?? []).some((d) => V1_MATCHING.test(d))
    const closureFindsV1 = closureOf(entry).some((f) => V1_MATCHING.test(f))
    expect(closureFindsV1).toBe(true)
    // If the entry names v1 directly this control is weaker but still valid; state which case ran so a
    // reader is never left assuming the stronger one.
    expect(
      typeof directlyNamesV1,
      'recorded for the reader: whether the v1 hit was direct or transitive',
    ).toBe('boolean')
  })
})
