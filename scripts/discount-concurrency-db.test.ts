// #361 — DB half: the discount quota gate on a REAL postgres. `describe.skipIf(!TEST_DATABASE_URL)`; run it
// against the testenv pg for the PR proof (the money lane's db suite is a Ready-gate, per #370 B1):
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/discount-concurrency-db.test.ts
//
// 🔴 The gate under test is the CONDITIONAL UPDATE on discount_code.used_count (lib/discount/repo), not any
// index. Mutant contract (must go RED here):
//   • drop `AND (max_use_total IS NULL OR used_count < max_use_total)` → the 20-parallel test reddens
//   • move the per-user count out of the transaction                   → the max_use_per_user test reddens
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { reserveAndRedeem, releaseRedemption } from '@/lib/discount/repo'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0008 = readFileSync(resolve('lib/db/0008_discount_code.sql'), 'utf8')

describe.skipIf(!TEST_URL)('discount quota · real pg (#361)', () => {
  let sql: ReturnType<typeof postgres>
  let users: string[]
  const CODE = 'test-361-code'

  // seed a v2_payment PENDING row so discount_redemption.payment_id has its FK target (the real flow does
  // this inside the same txn; here we pre-create rows so the test can drive reserve directly).
  async function seedPayment(userId: string): Promise<string> {
    const id = randomUUID()
    await sql`INSERT INTO v2_payment
      (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status)
      VALUES (${id}, ${userId}, 'MONTHLY', 'PLUS', 143100, 0, '1M', 0, 'card', ${'pending:' + id}, '0000000000', 'PENDING')`
    return id
  }

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 24, ssl: false })
    await sql.unsafe(M0008) // idempotent
    const rows = await sql`SELECT user_id FROM "user" LIMIT 6`
    users = rows.map((r) => r.user_id as string)
  })

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM discount_redemption WHERE code_id = ${CODE}`
      await sql`DELETE FROM v2_payment WHERE order_id = '0000000000'`
      await sql`DELETE FROM discount_code WHERE id = ${CODE}`
      await sql.end()
    }
  })

  beforeEach(async () => {
    await sql`DELETE FROM discount_redemption WHERE code_id = ${CODE}`
    await sql`DELETE FROM v2_payment WHERE order_id = '0000000000'`
    await sql`DELETE FROM discount_code WHERE id = ${CODE}`
  })

  const makeCode = (o: { maxUseTotal?: number | null; maxUsePerUser?: number | null; status?: string } = {}) =>
    sql`INSERT INTO discount_code (id, code, kind, value, applies_to, max_use_total, max_use_per_user, status, used_count)
        VALUES (${CODE}, ${'SAVE10-' + CODE}, 'PERCENT', 10, '{}', ${o.maxUseTotal ?? null},
                ${o.maxUsePerUser ?? null}, ${o.status ?? 'ACTIVE'}, 0)`

  it('🔴 max_use_total = 1 · TWO reservations fired in PARALLEL ⇒ exactly ONE succeeds', async () => {
    await makeCode({ maxUseTotal: 1 })
    const [p1, p2] = [await seedPayment(users[0]), await seedPayment(users[1])]
    const [a, b] = await Promise.all([
      reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: p1, discountSatang: 15900, vatPercent: 0, maxUsePerUser: null }),
      reserveAndRedeem({ codeId: CODE, userId: users[1], paymentId: p2, discountSatang: 15900, vatPercent: 0, maxUsePerUser: null }),
    ])
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1)
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM discount_redemption WHERE code_id = ${CODE}`
    expect(c).toBe(1)
    const [row] = await sql`SELECT used_count FROM discount_code WHERE id = ${CODE}`
    expect(row.used_count).toBe(1)
  })

  it('🔴 max_use_total = 5 · TWENTY parallel lines ⇒ exactly 5 succeed (and the overlap is proven)', async () => {
    await makeCode({ maxUseTotal: 5 })
    const payments = await Promise.all(Array.from({ length: 20 }, (_, i) => seedPayment(users[i % users.length])))
    // 🔴 timestamps prove the requests actually OVERLAP in time (ตู๋ B1③: firing 20 does not by itself mean
    // they were concurrent). We record start/end per line and assert the window of the LAST start is before
    // the FIRST end — i.e. at least one moment where all lines were in flight together.
    const marks: Array<{ i: number; start: number; end: number; ok: boolean }> = []
    await Promise.all(
      payments.map(async (pid, i) => {
        const start = performance.now()
        const r = await reserveAndRedeem({
          codeId: CODE,
          userId: users[i % users.length] + '', // per-user ceiling not used here
          paymentId: pid,
          discountSatang: 15900,
          vatPercent: 0,
          maxUsePerUser: null,
        })
        marks.push({ i, start, end: performance.now(), ok: r.ok })
      }),
    )
    const succeeded = marks.filter((m) => m.ok).length
    expect(succeeded).toBe(5)
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM discount_redemption WHERE code_id = ${CODE}`
    expect(c).toBe(5)

    const lastStart = Math.max(...marks.map((m) => m.start))
    const firstEnd = Math.min(...marks.map((m) => m.end))
    // print for the PR evidence (the ticket asks for the timestamps)
    console.info(
      `[#361 overlap] lines=20 lastStart=${lastStart.toFixed(1)}ms firstEnd=${firstEnd.toFixed(1)}ms overlapped=${lastStart < firstEnd}`,
    )
    expect(lastStart).toBeLessThan(firstEnd) // every line was in flight at the same instant
  })

  it('🔴 max_use_per_user = 3 · the SAME user fires 5 in parallel ⇒ exactly 3 pass', async () => {
    await makeCode({ maxUsePerUser: 3 })
    const u = users[0]
    const payments = await Promise.all(Array.from({ length: 5 }, () => seedPayment(u)))
    const results = await Promise.all(
      payments.map((pid) =>
        reserveAndRedeem({ codeId: CODE, userId: u, paymentId: pid, discountSatang: 15900, vatPercent: 0, maxUsePerUser: 3 }),
      ),
    )
    expect(results.filter((r) => r.ok).length).toBe(3)
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM discount_redemption WHERE code_id = ${CODE} AND user_id = ${u}`
    expect(c).toBe(3)
    // the refused lines rolled back their increment too
    const [row] = await sql`SELECT used_count FROM discount_code WHERE id = ${CODE}`
    expect(row.used_count).toBe(3)
  })

  it('a PAUSED code is refused (status is part of the conditional UPDATE, not a read-then-write)', async () => {
    await makeCode({ status: 'PAUSED' })
    const pid = await seedPayment(users[0])
    const r = await reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: pid, discountSatang: 1, vatPercent: 0, maxUsePerUser: null })
    expect(r).toEqual({ ok: false, reason: 'FULL' })
  })

  it('🔴 release path: a failed charge gives the quota back (used_count down, redemption gone) and is idempotent', async () => {
    await makeCode({ maxUseTotal: 1 })
    const pid = await seedPayment(users[0])
    expect((await reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: pid, discountSatang: 15900, vatPercent: 0, maxUsePerUser: null })).ok).toBe(true)

    expect(await releaseRedemption(CODE, pid)).toEqual({ released: true })
    const [row] = await sql`SELECT used_count FROM discount_code WHERE id = ${CODE}`
    expect(row.used_count).toBe(0) // the code is usable again — never "full" with nobody discounted
    expect(await releaseRedemption(CODE, pid)).toEqual({ released: false }) // idempotent

    // and the freed slot is really usable
    const pid2 = await seedPayment(users[1])
    expect((await reserveAndRedeem({ codeId: CODE, userId: users[1], paymentId: pid2, discountSatang: 15900, vatPercent: 0, maxUsePerUser: null })).ok).toBe(true)
  })

  it('lower(code) is UNIQUE — a case-variant of an existing code cannot be created', async () => {
    await makeCode()
    await expect(
      sql`INSERT INTO discount_code (id, code, kind, value, applies_to, status, used_count)
          VALUES (${'dup-361'}, ${('SAVE10-' + CODE).toUpperCase()}, 'PERCENT', 10, '{}', 'ACTIVE', 0)`,
    ).rejects.toThrow(/unique|duplicate/i)
  })
})
