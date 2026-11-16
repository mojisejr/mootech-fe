// @vitest-environment node
/**
 * Opt-in real TCP proof. Supply only a disposable loopback database named stall_proof;
 * DATABASE_URL is never read. Run against PostgreSQL and then a transaction-mode pooler.
 * Fixtures use a unique marker table, never application tables or destructive SQL.
 */
import postgres from 'postgres'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createResilientSql, retrySafeRead } from '../lib/db/resilient-sql'
import { stallProxy } from './db-stall-proxy'

const databaseUrl = process.env.DB_STALL_TEST_DATABASE_URL
const required = process.env.DB_STALL_REQUIRE_DB === '1'
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

describe.skipIf(!databaseUrl && !required)('DB resilience with real sockets and synthetic markers', () => {
  let direct: ReturnType<typeof postgres>
  let proxy: ReturnType<typeof stallProxy>
  let proxied: string
  let table: string
  let pools: ReturnType<typeof postgres>[]
  let lines: string[]

  beforeEach(async () => {
    if (!databaseUrl) throw new Error('DB_STALL_TEST_DATABASE_URL is required for the real socket proof')
    const url = new URL(databaseUrl)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/stall_proof') {
      throw new Error('Refusing any target other than a disposable loopback stall_proof database')
    }
    direct = postgres(databaseUrl, { prepare: false, max: 1, ssl: false })
    table = `stall_marker_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
    await direct.unsafe(`create table ${table} (id integer)`)
    proxy = stallProxy(url)
    url.hostname = '127.0.0.1'
    url.port = String(await proxy.listen())
    proxied = url.toString()
    pools = []
    lines = []
  })
  afterEach(async () => {
    proxy?.close()
    await Promise.all((pools ?? []).map((pool) => pool.end({ timeout: 0 }).catch(() => {})))
    await direct?.end({ timeout: 0 })
  })

  const makePool = () => {
    const pool = postgres(proxied, { prepare: false, ssl: false, max: 5, connect_timeout: 2, idle_timeout: 30 })
    pools.push(pool)
    return pool
  }
  const guard = () => createResilientSql(makePool, { queryTimeoutMs: 350, transactionTimeoutMs: 900, log: (line) => lines.push(line) })
  const warm = (sql: ReturnType<typeof postgres>) => Promise.all(Array.from({ length: 5 }, () => sql.unsafe('select pg_sleep(0.03)')))
  const count = async () => Number((await direct.unsafe(`select count(*) as n from ${table}`))[0].n)

  test('control: an existing silent connection does not settle without the guard', async () => {
    const sql = makePool()
    await warm(sql)
    expect(proxy.silenceOpenConnections()).toBe(5)
    const result = sql.unsafe('select 42 as answer').then(() => 'answered', () => 'rejected')
    expect(await Promise.race([result, delay(700).then(() => 'pending')])).toBe('pending')
  })

  test('eight concurrent safe reads recover through one replacement generation', async () => {
    const sql = guard()
    await warm(sql)
    expect(proxy.silenceOpenConnections()).toBe(5)
    const started = Date.now()
    const answers = await Promise.all(Array.from({ length: 8 }, () => retrySafeRead(() => sql.unsafe('select 42 as answer'))))
    expect(answers.map((rows) => rows[0].answer)).toEqual(Array(8).fill(42))
    expect(pools).toHaveLength(2)
    expect(Date.now() - started).toBeLessThan(4_000)
    expect((await sql.unsafe('select 7 as answer'))[0].answer).toBe(7)
  })

  test('a stalled write is not replayed and a later independent query recovers', async () => {
    const sql = guard()
    await warm(sql)
    proxy.silenceOpenConnections()
    await expect(sql.unsafe(`insert into ${table} (id) values (1)`)).rejects.toMatchObject({ code: 'DB_STALL', outcome: 'unknown' })
    expect(await count()).toBe(0)
    expect((await sql.unsafe('select 7 as answer'))[0].answer).toBe(7)
    expect(await count()).toBe(0)
    expect(pools).toHaveLength(2)
  })

  test('a silent BEGIN times out before the callback and never replays it', async () => {
    const sql = guard()
    await warm(sql)
    proxy.silenceOpenConnections()
    let callbacks = 0
    await expect(sql.begin(async (tx) => {
      callbacks++
      await tx.unsafe(`insert into ${table} (id) values (4)`)
    })).rejects.toMatchObject({ code: 'DB_STALL', outcome: 'unknown' })
    expect(callbacks).toBe(0)
    expect(await count()).toBe(0)
    expect((await sql.unsafe('select 13 as answer'))[0].answer).toBe(13)
    expect(pools).toHaveLength(2)
  })

  test('transaction acquisition is bounded when all five connections are busy', async () => {
    const sql = createResilientSql(makePool, { queryTimeoutMs: 2_000, transactionTimeoutMs: 350, log: (line) => lines.push(line) })
    await warm(sql)
    // These harmless server sleeps occupy all client slots; the sixth operation must wait for acquisition.
    const busy = Promise.allSettled(Array.from({ length: 5 }, () => Promise.resolve(sql.unsafe('select pg_sleep(1)'))))
    await delay(50)
    let callbacks = 0
    const started = Date.now()
    await expect(sql.begin(async () => { callbacks++ })).rejects.toMatchObject({ code: 'DB_STALL', outcome: 'unknown' })
    expect(Date.now() - started).toBeLessThan(900)
    expect(callbacks).toBe(0)
    await busy
    expect((await sql.unsafe('select 17 as answer'))[0].answer).toBe(17)
    expect(pools).toHaveLength(2)
  })

  test('normal rollback and nested savepoint preserve transaction semantics', async () => {
    const sql = guard()
    const rollback = new Error('synthetic rollback')
    await expect(sql.begin(async (tx) => {
      await tx`insert into ${tx(table)} (id) values (1)`
      throw rollback
    })).rejects.toBe(rollback)
    expect(await count()).toBe(0)
    await sql.begin(async (tx) => {
      await tx`insert into ${tx(table)} (id) values (10)`
      await expect(tx.savepoint(async (nested) => {
        await nested`insert into ${nested(table)} (id) values (20)`
        throw rollback
      })).rejects.toBe(rollback)
      await tx`insert into ${tx(table)} (id) values (30)`
    })
    expect((await direct.unsafe(`select id from ${table} order by id`)).map((row) => row.id)).toEqual([10, 30])
    expect(pools).toHaveLength(1)
  })

  test('values and parser/serializer overrides survive pool replacement', async () => {
    const sql = guard()
    // Drizzle customizes this shared options object; copied overrides must affect replacement clients too.
    sql.options.parsers[20] = (value: string) => `bigint:${value}`
    sql.options.serializers[20] = (value: unknown) => String(Number(value) + 1)
    const read = () => sql`select ${sql.typed(41, 20)}::bigint as n`.values()
    expect(await read()).toEqual([['bigint:42']])
    proxy.silenceOpenConnections()
    expect(await retrySafeRead(read)).toEqual([['bigint:42']])
    expect(pools).toHaveLength(2)
  })

  test('lost COMMIT response reports unknown outcome without replaying a committed write', async () => {
    const sql = guard()
    await sql.unsafe('select 1')
    proxy.loseCommitResponse()
    let callbacks = 0
    await expect(sql.begin(async (tx) => {
      callbacks++
      await tx.unsafe(`insert into ${table} (id) values (2)`)
    })).rejects.toMatchObject({ code: 'DB_STALL', outcome: 'unknown' })
    expect(proxy.commitsObserved()).toBe(1)
    expect(callbacks).toBe(1)
    expect(await count()).toBe(1)
    expect((await sql.unsafe('select 9 as answer'))[0].answer).toBe(9)
    expect(await count()).toBe(1)
  })

  test('a callback waking after transaction expiry cannot issue a late write', async () => {
    const sql = guard()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    let callbackFinished!: () => void
    const finished = new Promise<void>((resolve) => { callbackFinished = resolve })
    let lateError: unknown
    await expect(sql.begin(async (tx) => {
      await tx.unsafe('select 1')
      await gate
      try { await tx.unsafe(`insert into ${table} (id) values (3)`) } catch (error) { lateError = error }
      finally { callbackFinished() }
    })).rejects.toMatchObject({ code: 'DB_STALL', outcome: 'unknown' })
    release()
    await finished
    expect(lateError).toMatchObject({ code: 'DB_TRANSACTION_EXPIRED' })
    expect(await count()).toBe(0)
    expect((await sql.unsafe('select 11 as answer'))[0].answer).toBe(11)
  })
})
