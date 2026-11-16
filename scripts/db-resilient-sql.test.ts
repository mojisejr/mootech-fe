import assert from 'node:assert/strict'
import type postgres from 'postgres'
import { createResilientSql, DbStallError, retrySafeRead } from '../lib/db/resilient-sql'

type Sql = ReturnType<typeof postgres>
const never = () => new Promise<never>(() => {})
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function harness(run: (generation: number, text: string) => Promise<unknown>) {
  const pools: Array<{ calls: string[]; ends: number; options: { parsers: Record<string, unknown>; serializers: Record<string, unknown> } }> = []
  const log: string[] = []
  const createPool = () => {
    const id = pools.length
    const state = { calls: [] as string[], ends: 0, options: { parsers: {}, serializers: {} } }
    pools.push(state)
    const query = (text: string) => {
      let started: Promise<unknown> | undefined
      const begin = () => started ??= (state.calls.push(text), run(id, text))
      const handle = {
        then: (yes: any, no: any) => begin().then(yes, no),
        values: () => handle,
        raw: () => handle,
      }
      return handle
    }
    const sql = ((strings: TemplateStringsArray) => query(strings.join('?'))) as any
    sql.unsafe = query
    sql.options = state.options
    sql.end = async () => { state.ends++ }
    sql.begin = sql.savepoint = async (...args: any[]) => {
      const result = await args.at(-1)(sql)
      await query('COMMIT')
      return result
    }
    return sql as Sql
  }
  return { sql: createResilientSql(createPool, { queryTimeoutMs: 20, transactionTimeoutMs: 45, log: line => log.push(line) }), pools, log }
}

async function main() {
  {
    const h = harness(async () => [{ n: 1 }])
    assert.deepEqual(await h.sql.unsafe('SELECT 1').values(), [{ n: 1 }])
    const q = h.sql.unsafe('SELECT 2')
    await q; await q
    assert.deepEqual(h.pools[0].calls, ['SELECT 1', 'SELECT 2'])
  }
  {
    const h = harness(async generation => generation === 0 ? never() : [{ n: 1 }])
    h.sql.options.parsers[12345] = String
    await assert.rejects(async () => { await h.sql.unsafe('INSERT') }, DbStallError)
    assert.equal(h.pools.length, 2)
    assert.equal(h.pools[0].ends, 1)
    assert.deepEqual(h.pools[1].calls, []) // no write replay
    assert.equal(h.sql.options.parsers[12345], String)
    assert.deepEqual(await h.sql.unsafe('SELECT 1'), [{ n: 1 }])
  }
  {
    const h = harness(async generation => generation === 0 ? never() : [{ n: 1 }])
    const result = await Promise.all(Array.from({ length: 8 }, () => retrySafeRead(() => h.sql.unsafe('SELECT 1'))))
    assert.equal(result.length, 8)
    assert.equal(h.pools.length, 2)
    assert.equal(h.log.length, 1)
    assert.equal(h.pools[0].calls.length, 8)
    assert.equal(h.pools[1].calls.length, 8)
  }
  {
    const h = harness(never)
    await assert.rejects(retrySafeRead(() => h.sql.unsafe('SELECT 1')), DbStallError)
    assert.equal(h.pools.length, 3) // two attempts, never a third query
    assert.deepEqual(h.pools.map(p => p.calls.length), [1, 1, 0])
  }
  {
    let calls = 0
    await assert.rejects(retrySafeRead(async () => { calls++; throw new Error('constraint') }), /constraint/)
    assert.equal(calls, 1)
  }
  {
    const h = harness(async () => [])
    let resume!: () => void
    const pause = new Promise<void>(resolve => { resume = resolve })
    let lateError: unknown
    const tx = h.sql.begin(async sql => {
      const queued = sql.unsafe('LATE WRITE')
      await pause
      try { await queued } catch (error) { lateError = error; throw error }
    })
    await assert.rejects(tx, DbStallError)
    resume()
    await sleep(5)
    assert.equal((lateError as any)?.code, 'DB_TRANSACTION_EXPIRED')
    assert.deepEqual(h.pools.flatMap(p => p.calls), [])
  }
  {
    const h = harness(async (_generation, text) => text === 'COMMIT' ? never() : [])
    await assert.rejects(h.sql.begin(async tx => { await tx.unsafe('WRITE') }), error => {
      assert.equal((error as DbStallError).outcome, 'unknown')
      return error instanceof DbStallError
    })
    assert.deepEqual(h.pools.map(p => p.calls), [['WRITE', 'COMMIT'], []])
  }
  {
    const h = harness(async () => [])
    let escaped!: Sql
    await h.sql.begin(async tx => { escaped = tx as Sql; await tx.unsafe('WRITE') })
    await assert.rejects(Promise.resolve().then(() => escaped.unsafe('LATE WRITE')), { code: 'DB_TRANSACTION_EXPIRED' })
    assert.deepEqual(h.pools[0].calls, ['WRITE', 'COMMIT'])
  }
  {
    let constructions = 0
    const sql = createResilientSql(() => {
      constructions++
      if (constructions === 2) throw new Error('temporary factory failure')
      const pool = (() => {}) as any
      const first = constructions === 1
      pool.unsafe = () => first ? never() : Promise.resolve([{ n: 1 }])
      pool.end = async () => {}
      pool.options = { parsers: {}, serializers: {} }
      return pool
    }, { queryTimeoutMs: 20, log: () => { throw new Error('logger unavailable') } })
    await assert.rejects(async () => { await sql.unsafe('SELECT 1') }, DbStallError)
    assert.deepEqual(await sql.unsafe('SELECT 1'), [{ n: 1 }])
    assert.equal(constructions, 3)
  }
  console.log('db-resilient-sql: 9 safety cases passed')
}

void main().catch(error => { console.error(error); process.exitCode = 1 })
