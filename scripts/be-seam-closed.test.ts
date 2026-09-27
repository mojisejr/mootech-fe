// CIEL mumate-be-retirement-001 slice 2b, DoD V2 (+ the code half of V3) — no reachable page or API route
// can call mootech-be.
//
// "Reachable" is computed, not asserted: an import graph from every entry the server can still run —
// middleware, the service worker, _app/_document, every pages/api route, and every page that the v1
// retirement rule (lib/v1-retired-routes.ts) does NOT redirect. Nothing in that closure may import
// constants/api/endpoint.ts (the ledger that still holds v1's backendURLGenerator entries and ENDPOINT) or
// carry a backend marker in code. v1 files may — they are kept on the owner's word (R1) and are unreachable,
// and the PR body lists them.
//
// Why endpoint.ts itself must be unreachable, not just "not called": Next puts a module into the chunk of
// every page that imports it, so a v2 wrapper that imported ./endpoint for one same-origin path shipped every
// BE path and the ENDPOINT host to the browser in _app's chunk (measured on the slice 1 build). v2 names its
// routes through constants/api/endpoint-local.ts instead.
//
// MUTANTS (each reddens this file):
//   M1  a v2 wrapper goes back to `import { API } from './endpoint'`      → ② names the chain
//   M2  endpoint.ts reads process.env.NEXT_PUBLIC_BACKEND_URL again      → ④
//   M3  pages/api/chat/balance.ts proxies the BE again (wallet-client)    → ② / ③
//   M4  a LOCAL_API path drifts from the API ledger                       → ⑤
//   M5  the graph walker stops following imports                          → ① (control)
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative, extname } from 'node:path'
import { retiredV1Target } from '../lib/v1-retired-routes'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

const ROOT = process.cwd()
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']
const SKIP = new Set(['node_modules', '.next', '.git', 'scripts', 'e2e', 'testenv', 'harness', 'docs', 'public'])
const LEGACY = 'constants/api/endpoint.ts'

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return []
    const p = join(dir, e.name)
    if (e.isDirectory()) return walk(p)
    return EXTS.includes(extname(e.name)) ? [p] : []
  })
}

const files = walk(ROOT).map((f) => relative(ROOT, f))
const src = new Map(files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]))

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

function resolveSpec(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(join(ROOT, from)), spec)
  else return null
  for (const c of [base, ...EXTS.map((x) => base + x), ...EXTS.map((x) => join(base, 'index' + x))]) {
    if (existsSync(c) && statSync(c).isFile()) return relative(ROOT, c)
  }
  return null
}

const edges = new Map<string, string[]>()
for (const [f, text] of src) {
  const out: string[] = []
  for (const m of text.matchAll(IMPORT_RE)) {
    const r = resolveSpec(f, m[1] || m[2] || m[3] || m[4])
    if (r) out.push(r)
  }
  edges.set(f, out)
}

const routeOf = (f: string) => {
  const r = '/' + f.replace(/^pages\//, '').replace(/\.(tsx|ts|jsx|js)$/, '').replace(/(^|\/)index$/, '')
  return r === '/' ? '/' : r.replace(/\/$/, '')
}

function entries(redirects: boolean): string[] {
  return files.filter((f) => {
    if (f === 'middleware.ts' || f === 'sw.ts') return true
    if (!f.startsWith('pages/')) return false
    if (f.startsWith('pages/api/') || /^pages\/_(app|document|error)\./.test(f)) return true
    return !redirects || retiredV1Target(routeOf(f)) === null
  })
}

/** reachable file → the chain that reaches it (entry first) */
function reach(from: string[]): Map<string, string[]> {
  const chain = new Map<string, string[]>(from.map((e) => [e, [e]]))
  const queue = [...from]
  while (queue.length) {
    const f = queue.shift()!
    for (const t of edges.get(f) ?? []) {
      if (!chain.has(t)) {
        chain.set(t, [...chain.get(f)!, t])
        queue.push(t)
      }
    }
  }
  return chain
}

// Code only: a comment that tells the history ("was mootech-be …") is not a call.
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
// (Not a bare `ENDPOINT`: pages/api/fortune/card-image has an unrelated local table of that name. The legacy
// ENDPOINT constant can only arrive by importing constants/api/endpoint.ts, which ② already forbids.)
const BE_MARKER = /backendURLGenerator|NEXT_PUBLIC_BACKEND_URL|onrender\.com|localhost:4000/

const live = reach(entries(true))

describe('be-retirement 2b · the seam is closed', () => {
  it('① control: with no redirect rule, the same walker DOES reach the legacy ledger (a clean result below is not 0-from-0)', () => {
    const all = reach(entries(false))
    expect(all.has(LEGACY)).toBe(true)
    expect(entries(true).length).toBeGreaterThan(150)
    expect(live.size).toBeGreaterThan(500)
  })

  it('② constants/api/endpoint.ts is unreachable from every page, API route and middleware that can still run', () => {
    expect(live.get(LEGACY)?.join(' → ') ?? null).toBeNull()
  })

  it('③ no reachable module carries a backend marker in code', () => {
    const hits = [...live.keys()]
      .filter((f) => BE_MARKER.test(code(src.get(f) ?? '')))
      .map((f) => live.get(f)!.join(' → '))
    expect(hits).toEqual([])
  })

  it('④ nothing in the app reads the retired env any more', () => {
    const RETIRED = /process\.env\.(NEXT_PUBLIC_BACKEND_URL|AI_CONSUME_SECRET|CREDIT_ENFORCE|RENDER_API_KEY|CONSENT_SECRET)\b/
    const readers = files.filter((f) => RETIRED.test(code(src.get(f)!)))
    expect(readers).toEqual([])
  })

  it('⑤ LOCAL_API is same-origin only and is exactly what the API ledger re-exports', async () => {
    const localSrc = code(src.get('constants/api/endpoint-local.ts')!)
    expect(localSrc).not.toMatch(/ENDPOINT|backendURLGenerator|next\/config|from ['"]\.\/endpoint['"]/)
    const { LOCAL_API } = await import('../constants/api/endpoint-local')
    const { API } = await import('../constants/api/endpoint')
    let n = 0
    for (const [group, entries] of Object.entries(LOCAL_API)) {
      for (const [key, value] of Object.entries(entries)) {
        expect(value, `${group}.${key}`).toMatch(/^\/api\//)
        expect((API as Record<string, Record<string, string>>)[group][key], `${group}.${key}`).toBe(value)
        n++
      }
    }
    expect(n).toBeGreaterThan(20)
  })

  it('⑥ /api/chat/balance answers 410 and reaches nothing', async () => {
    const { default: handler } = await import('../pages/api/chat/balance')
    let status = 0
    let body: unknown
    const res = {
      setHeader: () => res,
      status(c: number) { status = c; return res },
      json(b: unknown) { body = b; return res },
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    handler({ method: 'GET', cookies: { 'cookie-mumate-id': '5c7befb3-ebd3-4740-989e-fd6a1cca9662' } } as never, res as never)
    expect(status).toBe(410)
    expect(body).toMatchObject({ error: 'gone' })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
