// #361 — DB half #2: the preview→charge contract on a REAL postgres. skipIf(!TEST_DATABASE_URL); run with
//   TEST_DATABASE_URL=… DATABASE_URL=… npx vitest run scripts/discount-preview-db.test.ts
//
// Covers the DoD items that need real rows: the quote a user was shown is HONOURED or REFUSED (never
// silently re-priced), a v1 payment_code holder is not told "invalid code", and a new code cannot take a
// name the 43 legacy codes already use (case-insensitively).
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { priceFor } from '@/lib/discount/preview-flow'
import { insertQuote, isCodeNameTaken } from '@/lib/discount/repo'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0008 = readFileSync(resolve('lib/db/0008_discount_code.sql'), 'utf8')
const NOW = new Date()

describe.skipIf(!TEST_URL)('discount preview/charge contract · real pg (#361)', () => {
  let sql: ReturnType<typeof postgres>
  let user0: string
  const CODE = 'test-361-prev'
  const CODE_STR = 'SAVE10-PREV'

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 6, ssl: false })
    await sql.unsafe(M0008)
    const [u] = await sql`SELECT user_id FROM "user" LIMIT 1`
    user0 = u.user_id as string
    ;(globalThis as { __u361?: string }).__u361 = user0 // the session mock below answers with this user
  })

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM payment_quote WHERE user_id = ${user0}`
      await sql`DELETE FROM discount_code WHERE id = ${CODE}`
      await sql.end()
    }
  })

  beforeEach(async () => {
    await sql`DELETE FROM payment_quote WHERE user_id = ${user0}`
    await sql`DELETE FROM discount_code WHERE id = ${CODE}`
    await sql`INSERT INTO discount_code (id, code, kind, value, applies_to, status, used_count)
              VALUES (${CODE}, ${CODE_STR}, 'PERCENT', 10, '{}', 'ACTIVE', 0)`
  })

  it('preview prices MONTHLY (฿500) with a 10% code: discount ฿50 → ฿450, from real rows', async () => {
    const p = await priceFor('MONTHLY', CODE_STR, NOW)
    expect(p.ok).toBe(true)
    if (p.ok) {
      expect(p.listSatang).toBe(50000)
      expect(p.discountSatang).toBe(5000)
      expect(p.amountSatang).toBe(45000)
    }
  })

  it('the code lookup is case-INsensitive (v1 s bug: Yijing vs YIJING were two rows)', async () => {
    const lower = await priceFor('MONTHLY', CODE_STR.toLowerCase(), NOW)
    expect(lower.ok).toBe(true)
  })

  it('🔴 a PAUSED code is refused and the price is NOT quietly the full one', async () => {
    await sql`UPDATE discount_code SET status = 'PAUSED' WHERE id = ${CODE}`
    const p = await priceFor('MONTHLY', CODE_STR, NOW)
    expect(p).toMatchObject({ ok: false, codeError: 'STATUS' })
  })

  it('🔴 DoD — a v1 payment_code holder is NOT told "invalid code"', async () => {
    const [legacy] = await sql`SELECT code FROM payment_code LIMIT 1`
    const p = await priceFor('MONTHLY', String(legacy.code), NOW)
    expect(p).toMatchObject({ ok: false, codeError: 'LEGACY_CODE' })
    if (!p.ok) expect(p.error).not.toMatch(/invalid/i) // the message must not call a real code invalid
  })

  it('🔴 DoD — a new code cannot take a legacy name, even in different case', async () => {
    const [legacy] = await sql`SELECT code FROM payment_code LIMIT 1`
    expect(await isCodeNameTaken(String(legacy.code).toLowerCase())) .toBe(true)
    expect(await isCodeNameTaken(String(legacy.code).toUpperCase())).toBe(true)
    expect(await isCodeNameTaken('definitely-not-taken-361')).toBe(false)
  })

  it('🔴 DoD — a quote whose price no longer matches is REFUSED by charge (409), not re-charged silently', async () => {
    const p = await priceFor('MONTHLY', CODE_STR, NOW)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const quoteId = await insertQuote({
      userId: user0,
      packageCode: 'MONTHLY',
      codeId: p.code!.id,
      listSatang: p.listSatang,
      discountSatang: p.discountSatang,
      amountSatang: p.amountSatang,
      vatPercent: p.vatPercent,
      expiresAt: new Date(NOW.getTime() + 15 * 60_000),
    })

    // the world moves: the code's percentage is changed from the back office
    await sql`UPDATE discount_code SET value = 20 WHERE id = ${CODE}`

    const { runChargeFlow } = await import('@/lib/payment/charge-flow')
    const out = await invokeCharge(runChargeFlow, quoteId, user0)
    expect(out.status).toBe(409)
    expect(out.body).toMatchObject({ quoteChanged: true })
  })

  it('🔴 an EXPIRED quote is refused (409) too', async () => {
    const p = await priceFor('MONTHLY', CODE_STR, NOW)
    if (!p.ok) throw new Error('priced')
    const quoteId = await insertQuote({
      userId: user0,
      packageCode: 'MONTHLY',
      codeId: p.code!.id,
      listSatang: p.listSatang,
      discountSatang: p.discountSatang,
      amountSatang: p.amountSatang,
      vatPercent: p.vatPercent,
      expiresAt: new Date(NOW.getTime() - 1000), // already gone
    })
    const { runChargeFlow } = await import('@/lib/payment/charge-flow')
    const out = await invokeCharge(runChargeFlow, quoteId, user0)
    expect(out.status).toBe(409)
    expect(out.body).toMatchObject({ quoteChanged: true })
  })

  // Drive runChargeFlow with a stub gateway; the session is mocked at module level below.
  async function invokeCharge(
    run: typeof import('@/lib/payment/charge-flow').runChargeFlow,
    quoteId: string,
    _userId: string,
  ) {
    const out = { status: 0, body: undefined as unknown }
    const res = {
      status(c: number) {
        out.status = c
        return res
      },
      json(b: unknown) {
        out.body = b
        return res
      },
    }
    await run(
      { method: 'POST', body: { package_code: 'MONTHLY', token: 'tok', code: CODE_STR, quote_id: quoteId } } as never,
      res as never,
      'card',
      async () => {
        throw new Error('the gateway must NEVER be called when the quote is refused')
      },
    )
    return out
  }
})

// The charge flow derives identity from the signed session; these specs act as one known user.
vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSessionUserId: vi.fn(async () => ({ ok: true, userId: (globalThis as { __u361?: string }).__u361 ?? '' })),
}))
