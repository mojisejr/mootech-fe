// #466 — the half of mootech-fe#456's door that had NO test: the database read.
//
// 🔴 WHAT WAS MISSING AND WHY IT MATTERED. scripts/payment-charge-route.test.ts mocks `decidePurchaseFor`
// wholesale (its vi.mock of '@/lib/payment/repo' supplies a fake), so everything it proves has the shape
// "IF the gate is told to refuse, THEN nothing is reserved and no charge is created". Nothing anywhere
// proved the antecedent: that the gate, handed a real user who really holds PLUS in a real database,
// actually decides to refuse. ฟีม asked exactly that question on the day #456 shipped — "ผมเป็น plus
// แล้วผมเข้าไปใน package ยังกดซื้อได้อยู่" — and the honest answer was that we had read the code and run
// the pure tests, not that we had watched it happen.
//
// The two halves either side of it were tested: decidePurchase (pure, scripts/payment-purchase-gate.test.ts)
// and readEntitlement (exercised through settleAndProvision, scripts/payment-webhook-db.test.ts). This
// covers the composition — the thing the route actually calls.
//
// Run:  TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//       DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//       npx vitest run scripts/purchase-gate-db.test.ts
//
// 🔴 MUTANT CONTRACT (each reddens this file):
//   PD1  readEntitlement stops seeing live member_subscription rows   → every "holds PLUS" test reddens
//   PD2  the gate allows same-tier repurchase                          → ① reddens
//   PD3  the gate allows a downgrade                                   → ② reddens
//   PD4  an EXPIRED row is treated as live                             → ④ reddens
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { decidePurchaseFor, readEntitlement } from '@/lib/payment/repo'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0006 = readFileSync(resolve('lib/db/0006_member_subscription.sql'), 'utf8')
const NOW = new Date()
const bkk = (n: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(n)
const addDaysStr = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

describe.skipIf(!TEST_URL)('#466 the purchase gate against real postgres', () => {
  let sql: ReturnType<typeof postgres>
  let users: string[]
  const today = bkk(NOW)

  beforeAll(async () => {
    sql = postgres(TEST_URL as string, { max: 4, ssl: false })
    await sql.unsafe(M0006) // idempotent
    // Users with NO member_payment row, so the legacy fallback cannot quietly make someone "paid".
    const rows = await sql`SELECT user_id FROM "user"
      WHERE user_id NOT IN (SELECT user_id FROM member_payment) LIMIT 2`
    users = rows.map((r) => r.user_id as string)
    expect(users.length, 'the test database must have spare users').toBeGreaterThan(0)
  })

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
      await sql.end()
    }
  })
  afterEach(async () => {
    await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
  })

  const seed = (id: string, userId: string, tier: string, expireAt: string, status = 'ACTIVE') =>
    sql`INSERT INTO member_subscription (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status)
        VALUES (${id}, ${userId}, ${tier}, ${'PKG-' + tier}, 79000, ${today}, ${expireAt}, ${status})`

  it('PD1 — the read sees a live PLUS row and names it', async () => {
    await seed('pd-1', users[0], 'PLUS', addDaysStr(today, 100))
    const held = await readEntitlement(users[0], NOW)
    expect(held.isPaid).toBe(true)
    expect(held.tier).toBe('PLUS')
    expect(held.expireAt).toBe(addDaysStr(today, 100))
  })

  it('🔴 ① ฟีม’s case: a PLUS member buying PLUS is REFUSED — the antecedent the route test assumed', async () => {
    await seed('pd-2', users[0], 'PLUS', addDaysStr(today, 100))
    const d = await decidePurchaseFor(users[0], 'PLUS', NOW)
    expect(d).toEqual({ allow: false, reason: 'ALREADY_ON_THIS_TIER' })
  })

  it('② a PRO member buying PLUS is REFUSED as a downgrade', async () => {
    await seed('pd-3', users[0], 'PRO', addDaysStr(today, 100))
    const d = await decidePurchaseFor(users[0], 'PLUS', NOW)
    expect(d).toEqual({ allow: false, reason: 'CANNOT_DOWNGRADE' })
  })

  it('③ CONTROL — the same PLUS member buying PRO is ALLOWED, carrying the 100 days', async () => {
    await seed('pd-4', users[0], 'PLUS', addDaysStr(today, 100))
    const d = await decidePurchaseFor(users[0], 'PRO', NOW)
    expect(d).toEqual({ allow: true, carryOverDays: 100 })
  })

  it('④ PD4 — an EXPIRED row is not a membership: they buy again like anyone else', async () => {
    await seed('pd-5', users[0], 'PLUS', addDaysStr(today, -1)) // yesterday
    const d = await decidePurchaseFor(users[0], 'PLUS', NOW)
    expect(d).toEqual({ allow: true, carryOverDays: 0 })
  })

  it('⑤ CONTROL — a user holding nothing at all is allowed, so a refusal means something', async () => {
    const d = await decidePurchaseFor(users[0], 'PLUS', NOW)
    expect(d).toEqual({ allow: true, carryOverDays: 0 })
    const held = await readEntitlement(users[0], NOW)
    expect(held.isPaid).toBe(false)
    expect(held.tier).toBeNull()
  })

  it('⑥ the refusal is per-USER — another account is unaffected by this one’s membership', async () => {
    await seed('pd-6', users[0], 'PLUS', addDaysStr(today, 100))
    expect(await decidePurchaseFor(users[0], 'PLUS', NOW)).toEqual({ allow: false, reason: 'ALREADY_ON_THIS_TIER' })
    if (users[1]) {
      expect(await decidePurchaseFor(users[1], 'PLUS', NOW)).toEqual({ allow: true, carryOverDays: 0 })
    }
  })
})
