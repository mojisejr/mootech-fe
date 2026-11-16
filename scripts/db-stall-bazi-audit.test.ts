// Optional forensic proof of the PRE-EXISTING deployed bazi grant race, not a passing safety claim.
// Reads three exact Git blobs from BAZI_SOURCE_ROOT; modifies no bazi files or customer data.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as orm from 'drizzle-orm'
import * as pg from 'drizzle-orm/pg-core'
import * as zod from 'zod'
import ts from 'typescript'

const revision = '366b9437e66511de09eccb49274c5877fff6513b'
const sourceRoot = process.env.BAZI_SOURCE_ROOT
const url = process.env.DB_STALL_TEST_DATABASE_URL
const enabled = Boolean(sourceRoot && url)
const namespace = `bazi_audit_${randomUUID().replaceAll('-', '')}`
let sql: ReturnType<typeof postgres>
let POST: (request: Request) => Promise<Response>
let synchronize = false
let arrivals = 0
let release: () => void
let barrier: Promise<void>

// Compile exact source modules with an explicit dependency map. The only substituted behaviors are
// DB connection selection and the unrelated first-buy bonus. The grant and ledger bodies are intact.
function load(source: string, dependencies: Record<string, unknown>) {
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText
  const compiledModule = { exports: {} as Record<string, any> }
  const require = (name: string) => {
    if (!(name in dependencies)) throw new Error(`unapproved forensic dependency: ${name}`)
    return dependencies[name]
  }
  new Function('require', 'exports', 'module', compiled)(require, compiledModule.exports, compiledModule)
  return compiledModule.exports
}

describe.skipIf(!enabled)('deployed bazi QI audit · known race reproduction', () => {
  beforeAll(async () => {
    const target = new URL(url!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/stall_proof') {
      throw new Error('Forensic proof requires loopback /stall_proof')
    }
    sql = postgres(url!, { ssl: false, prepare: false, max: 5, connection: { search_path: namespace } })
    await sql.unsafe(`CREATE SCHEMA "${namespace}"`)
    await sql.unsafe(`CREATE TABLE "${namespace}".bazi_wallet (
      anon_id text PRIMARY KEY, coins integer NOT NULL DEFAULT 0, xp integer NOT NULL DEFAULT 0,
      qi integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`)
    await sql.unsafe(`CREATE TABLE "${namespace}".bazi_ledger_txn (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anon_id text NOT NULL,
      coin_delta integer NOT NULL DEFAULT 0, xp_delta integer NOT NULL DEFAULT 0,
      qi_delta integer NOT NULL DEFAULT 0, reason text NOT NULL, ref text,
      created_at timestamptz NOT NULL DEFAULT now())`)
    const read = (path: string) => execFileSync('git', ['show', `${revision}:${path}`], { cwd: sourceRoot, encoding: 'utf8' })
    const schemaSource = read('src/db/schema.ts')
    const first = schemaSource.indexOf('export const baziWallet =')
    const last = schemaSource.indexOf('/** metadata', first)
    if (first < 0 || last < 0) throw new Error('Pinned bazi schema block not found')
    const tables = load('import { pgTable, text, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";\n' + schemaSource.slice(first, last), {
      'drizzle-orm/pg-core': pg,
    })
    const db = drizzle(sql)
    const dbFacade = new Proxy(db, {
      get(target, key) {
        if (key !== 'select') {
          const value = (target as any)[key]
          return typeof value === 'function' ? value.bind(target) : value
        }
        // Hold both completed idempotency reads before either request can increment the wallet.
        return (...args: any[]) => {
          const query = (target.select as any)(...args)
          const wrap = (value: any): any => new Proxy(value, {
            get(q, method) {
              if (method === 'limit') return async (...limitArgs: any[]) => {
                const rows = await q.limit(...limitArgs)
                if (synchronize && arrivals < 2) {
                  arrivals++
                  if (arrivals === 2) release()
                  await barrier
                }
                return rows
              }
              const member = q[method]
              return typeof member === 'function' ? (...values: any[]) => wrap(member.apply(q, values)) : member
            },
          })
          return wrap(query)
        }
      },
    })
    const client = { createDbClient: () => dbFacade }
    const ledger = load(read('src/lib/bazi/manifest/ledger.ts'), {
      'drizzle-orm': orm, '@/db/client': client, '@/db/schema': tables,
    })
    class QiError extends Error { status = 500 }
    const route = load(read('src/app/api/qi/grant/route.ts'), {
      'drizzle-orm': orm, zod, '@/db/client': client, '@/db/schema': tables,
      '@/lib/bazi/manifest/ledger': ledger,
      '@/lib/bazi/qi/engine': { QiError, earnQi: async () => ({ awarded: false }) },
    })
    POST = route.POST
    process.env.QI_GRANT_SECRET = 'synthetic-forensic-proof'
  })

  afterAll(async () => { await sql?.end({ timeout: 0 }); delete process.env.QI_GRANT_SECRET })

  const grant = (id: string) => POST(new Request('http://localhost/api/qi/grant', {
    method: 'POST', body: JSON.stringify({ secret: 'synthetic-forensic-proof', anonId: id, kind: 'qi', qi: 100, reason: 'proof', ref: id }),
  }))

  it('sequential duplicate is deduplicated by the existing lookup', async () => {
    const id = `sequential_${randomUUID()}`
    expect((await grant(id)).status).toBe(200)
    expect((await (await grant(id)).json()).alreadyGranted).toBe(true)
    expect((await sql`SELECT qi FROM bazi_wallet WHERE anon_id = ${id}`)[0].qi).toBe(100)
    expect((await sql`SELECT count(*)::int AS n FROM bazi_ledger_txn WHERE ref = ${id}`)[0].n).toBe(1)
  })

  it('reproduces concurrent duplicate credit: same ref produces two ledger rows and 200 QI', async () => {
    const id = `concurrent_${randomUUID()}`
    barrier = new Promise<void>(resolve => { release = resolve })
    synchronize = true
    const results = await Promise.all([grant(id), grant(id)])
    synchronize = false
    expect(arrivals).toBe(2)
    expect(results.map(result => result.status)).toEqual([200, 200])
    expect((await sql`SELECT qi FROM bazi_wallet WHERE anon_id = ${id}`)[0].qi).toBe(200)
    expect((await sql`SELECT count(*)::int AS n FROM bazi_ledger_txn WHERE ref = ${id}`)[0].n).toBe(2)
  })
})
