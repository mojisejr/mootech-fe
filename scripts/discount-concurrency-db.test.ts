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
import { reserveAndRedeem, releaseRedemption, releaseExpiredHolds } from '@/lib/discount/repo'
import { abandonByChargeId } from '@/lib/payment/repo'
import { signOmisePayload } from '@/lib/payment/webhook-verify'
import webhookHandler from '@/pages/api/v2/payment/webhook'
import { Readable } from 'node:stream'

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

  // a PENDING payment that HOLDS a quote (so layer 1 can decide whether the hold is dead)
  async function seedPaymentWithQuote(userId: string, quoteExpiresAt: Date): Promise<string> {
    const qid = randomUUID()
    await sql`INSERT INTO payment_quote (id, user_id, package_code, code_id, list_satang, discount_satang, amount_satang, vat_percent, expires_at)
      VALUES (${qid}, ${userId}, 'MONTHLY', ${CODE}, 50000, 5000, 45000, 0, ${quoteExpiresAt})`
    const id = randomUUID()
    await sql`INSERT INTO v2_payment
      (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status, code_id, discount_satang, quote_id)
      VALUES (${id}, ${userId}, 'MONTHLY', 'PLUS', 45000, 0, '1M', 0, 'promptpay', ${'pending:' + id}, '0000000000', 'PENDING', ${CODE}, 5000, ${qid})`
    return id
  }


  // Fire a REAL webhook through the route (layer 2 lives in the route's branch, so the mutant that removes
  // that branch must be caught HERE, not only at the repo function).
  const WH_SECRET = Buffer.from('whsec_test_361').toString('base64')
  const WH_TS = '1755766800'
  async function fireWebhook(chargeId: string, status: string, paid = false) {
    process.env.OMISE_WEBHOOK_SECRET = WH_SECRET
    const raw = Buffer.from(JSON.stringify({ key: 'charge.update', data: { id: chargeId, status, paid } }), 'utf8')
    const req = Readable.from([raw]) as unknown as { method: string; headers: Record<string, string> }
    req.method = 'POST'
    req.headers = {
      'omise-signature': signOmisePayload(raw, WH_TS, WH_SECRET),
      'omise-signature-timestamp': WH_TS,
    }
    const out = { status: 0 }
    const res = { status(c: number) { out.status = c; return res }, json() { return res } }
    await (webhookHandler(req as never, res as never) as Promise<void>)
    return out
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
      await sql`DELETE FROM payment_quote WHERE code_id = ${CODE}`
      await sql`DELETE FROM discount_code WHERE id = ${CODE}`
      await sql.end()
    }
  })

  beforeEach(async () => {
    await sql`DELETE FROM discount_redemption WHERE code_id = ${CODE}`
    await sql`DELETE FROM v2_payment WHERE order_id = '0000000000'`
    await sql`DELETE FROM payment_quote WHERE code_id = ${CODE}`
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


  // ── #372 ③: a hold must not outlive the chance to pay it ─────────────────────────────────────────────
  // Layer 1 — the QUOTE expired ⇒ the hold is dead ⇒ the slot (and the per-user allowance) comes back.
  // 🔴 MUTANT: remove the releaseExpiredHoldsForCode call from reserveCodeInTx → this test reddens.
  it('🔴 layer 1 — a QR nobody scanned (quote expired) frees the code again for the SAME user (max_use_per_user=1)', async () => {
    await makeCode({ maxUsePerUser: 1 })
    const u = users[0]

    // the user opens a QR: a quote is written, the payment holds the code… and is never paid
    const abandoned = await seedPaymentWithQuote(u, new Date(Date.now() - 60_000)) // quote already expired
    expect((await reserveAndRedeem({ codeId: CODE, userId: u, paymentId: abandoned, discountSatang: 5000, vatPercent: 0, maxUsePerUser: 1 })).ok).toBe(true)

    // they come back and try their own code again — it must work, not "โค้ดไม่ถูกต้อง" forever
    const retry = await seedPaymentWithQuote(u, new Date(Date.now() + 900_000))
    const second = await reserveAndRedeem({ codeId: CODE, userId: u, paymentId: retry, discountSatang: 5000, vatPercent: 0, maxUsePerUser: 1 })
    expect(second.ok).toBe(true)

    const [{ c }] = await sql`SELECT count(*)::int AS c FROM discount_redemption WHERE code_id = ${CODE}`
    expect(c).toBe(1) // the dead hold was removed, the live one remains
    const [row] = await sql`SELECT used_count FROM discount_code WHERE id = ${CODE}`
    expect(row.used_count).toBe(1) // not 2 — the counter did not leak
  })

  it('layer 1 — a hold whose quote is still VALID is NOT released (the slot stays taken)', async () => {
    await makeCode({ maxUseTotal: 1 })
    const live = await seedPaymentWithQuote(users[0], new Date(Date.now() + 900_000))
    expect((await reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: live, discountSatang: 5000, vatPercent: 0, maxUsePerUser: null })).ok).toBe(true)

    const other = await seedPaymentWithQuote(users[1], new Date(Date.now() + 900_000))
    const second = await reserveAndRedeem({ codeId: CODE, userId: users[1], paymentId: other, discountSatang: 5000, vatPercent: 0, maxUsePerUser: null })
    expect(second).toEqual({ ok: false, reason: 'FULL' }) // still held — releasing it would double-spend
  })

  it('releaseExpiredHolds() sweeps every code (the entry point #360s reconciler calls)', async () => {
    await makeCode({ maxUseTotal: 5 })
    const dead = await seedPaymentWithQuote(users[0], new Date(Date.now() - 60_000))
    await reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: dead, discountSatang: 5000, vatPercent: 0, maxUsePerUser: null })
    expect(await releaseExpiredHolds()).toBeGreaterThanOrEqual(1)
    const [row] = await sql`SELECT used_count FROM discount_code WHERE id = ${CODE}`
    expect(row.used_count).toBe(0)
  })

  // Layer 2 — the webhook says the charge ENDED unsuccessfully ⇒ release now, without waiting for the quote.
  // 🔴 MUTANT: drop the isTerminalFailure branch in the webhook route → this test reddens.
  it('🔴 layer 2 — a failed charge frees the hold immediately, while the quote is still valid', async () => {
    await makeCode({ maxUseTotal: 1 })
    const pid = await seedPaymentWithQuote(users[0], new Date(Date.now() + 900_000)) // quote NOT expired
    await sql`UPDATE v2_payment SET charge_id = ${'chrg_fail_361'} WHERE id = ${pid}`
    expect((await reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: pid, discountSatang: 5000, vatPercent: 0, maxUsePerUser: null })).ok).toBe(true)

    expect(await abandonByChargeId('chrg_fail_361')).toEqual({ released: true })
    const [row] = await sql`SELECT used_count FROM discount_code WHERE id = ${CODE}`
    expect(row.used_count).toBe(0)
    const [p] = await sql`SELECT status FROM v2_payment WHERE id = ${pid}`
    expect(p.status).toBe('REJECT')
  })

  it('layer 2 — an APPROVED payment is never un-redeemed by a late failure event', async () => {
    await makeCode({ maxUseTotal: 1 })
    const pid = await seedPaymentWithQuote(users[0], new Date(Date.now() + 900_000))
    await sql`UPDATE v2_payment SET charge_id = ${'chrg_ok_361'} WHERE id = ${pid}`
    await reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: pid, discountSatang: 5000, vatPercent: 0, maxUsePerUser: null })
    await sql`UPDATE v2_payment SET status = 'APPROVED' WHERE id = ${pid}`

    expect(await abandonByChargeId('chrg_ok_361')).toEqual({ released: false })
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM discount_redemption WHERE code_id = ${CODE}`
    expect(c).toBe(1) // a settled payment keeps its redemption
  })


  it('🔴 layer 2 via the ROUTE — a charge.failed webhook frees the hold (quote still valid)', async () => {
    await makeCode({ maxUseTotal: 1 })
    const pid = await seedPaymentWithQuote(users[0], new Date(Date.now() + 900_000))
    await sql`UPDATE v2_payment SET charge_id = ${'chrg_route_fail_361'} WHERE id = ${pid}`
    await reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: pid, discountSatang: 5000, vatPercent: 0, maxUsePerUser: null })

    expect((await fireWebhook('chrg_route_fail_361', 'failed')).status).toBe(200)
    const [row] = await sql`SELECT used_count FROM discount_code WHERE id = ${CODE}`
    expect(row.used_count).toBe(0)
  })

  it('🔴 layer 2 via the ROUTE — a NOT-finished (pending) webhook must NOT free the hold', async () => {
    await makeCode({ maxUseTotal: 1 })
    const pid = await seedPaymentWithQuote(users[0], new Date(Date.now() + 900_000))
    await sql`UPDATE v2_payment SET charge_id = ${'chrg_route_pending_361'} WHERE id = ${pid}`
    await reserveAndRedeem({ codeId: CODE, userId: users[0], paymentId: pid, discountSatang: 5000, vatPercent: 0, maxUsePerUser: null })

    expect((await fireWebhook('chrg_route_pending_361', 'pending')).status).toBe(200)
    const [row] = await sql`SELECT used_count FROM discount_code WHERE id = ${CODE}`
    expect(row.used_count).toBe(1) // still held — it can still be paid
    const [{ c }] = await sql`SELECT count(*)::int AS c FROM discount_redemption WHERE code_id = ${CODE}`
    expect(c).toBe(1)
  })

  it('lower(code) is UNIQUE — a case-variant of an existing code cannot be created', async () => {
    await makeCode()
    await expect(
      sql`INSERT INTO discount_code (id, code, kind, value, applies_to, status, used_count)
          VALUES (${'dup-361'}, ${('SAVE10-' + CODE).toUpperCase()}, 'PERCENT', 10, '{}', 'ACTIVE', 0)`,
    ).rejects.toThrow(/unique|duplicate/i)
  })
})
