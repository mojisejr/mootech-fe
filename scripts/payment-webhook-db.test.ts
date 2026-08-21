// #355 — DB half: the webhook → settle → provision flow against a REAL postgres (the money path). Like the
// other db suites it is `describe.skipIf(!TEST_DATABASE_URL)` and does NOT run in the pre-push lane; run it
// against the testenv pg for the PR proof:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/payment-webhook-db.test.ts
//
// Touches ONLY v2_payment (ours), member_subscription rows for test users, and SYNTHETIC member_payment
// rows for `user` rows that have none — never the 24 real member_payment rows.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import postgres from 'postgres'
import { settleAndProvision } from '@/lib/payment/repo'
import { signOmisePayload } from '@/lib/payment/webhook-verify'
import webhookHandler from '@/pages/api/v2/payment/webhook'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0006 = readFileSync(resolve('lib/db/0006_member_subscription.sql'), 'utf8')
const M0007 = readFileSync(resolve('lib/db/0007_v2_payment.sql'), 'utf8')
const SECRET = Buffer.from('whsec_test_355').toString('base64')
const TS = '1755766800'

function chargeEvent(chargeId: string) {
  return Buffer.from(
    JSON.stringify({ key: 'charge.complete', data: { id: chargeId, status: 'successful', paid: true } }),
    'utf8',
  )
}
function fireWebhook(raw: Buffer, sig: string, ts: string) {
  const req = Readable.from([raw]) as unknown as {
    method: string
    headers: Record<string, string>
  }
  req.method = 'POST'
  req.headers = { 'omise-signature': sig, 'omise-signature-timestamp': ts }
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
  return (webhookHandler(req as never, res as never) as Promise<void>).then(() => out)
}

describe.skipIf(!TEST_URL)('payment webhook · real pg (#355)', () => {
  let sql: ReturnType<typeof postgres>
  let users: string[] // real `user` rows that have NO member_payment (FK-safe + synthetic-shadow-safe)

  beforeAll(async () => {
    process.env.OMISE_WEBHOOK_SECRET = SECRET
    sql = postgres(TEST_URL as string, { max: 6, ssl: false })
    await sql.unsafe(M0006) // ensure member_subscription exists (idempotent)
    await sql.unsafe('ALTER TABLE member_subscription DROP COLUMN IF EXISTS v2_payment_id;')
    await sql.unsafe('DROP TABLE IF EXISTS v2_payment CASCADE;')
    await sql.unsafe(M0007) // fresh v2_payment + re-add v2_payment_id
    const rows = await sql`SELECT user_id FROM "user"
      WHERE user_id NOT IN (SELECT user_id FROM member_payment) LIMIT 4`
    users = rows.map((r) => r.user_id as string)
  })

  afterAll(async () => {
    if (sql) {
      await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
      await sql.unsafe('DELETE FROM v2_payment;')
      await sql`DELETE FROM member_payment WHERE user_id = ANY(${users})`
      await sql.end()
    }
  })

  afterEach(async () => {
    await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
    await sql.unsafe('DELETE FROM v2_payment;')
    await sql`DELETE FROM member_payment WHERE user_id = ANY(${users})`
  })

  const seedPending = (
    chargeId: string,
    userId: string,
    pkg = 'MONTHLY',
    tier = 'PLUS',
    amount = 50000,
    expire = '1M',
    bufferDay = 0,
  ) =>
    sql`INSERT INTO v2_payment (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status)
        VALUES (${'v2p-' + chargeId}, ${userId}, ${pkg}, ${tier}, ${amount}, 0, ${expire}, ${bufferDay}, 'card', ${chargeId}, ${'ord' + chargeId}, 'PENDING')`

  it('full path: a signed charge.complete webhook → 200, APPROVED, and a member_subscription + shadow', async () => {
    await seedPending('C1', users[0])
    const raw = chargeEvent('C1')
    const out = await fireWebhook(raw, signOmisePayload(raw, TS, SECRET), TS)
    expect(out.status).toBe(200)

    const [pay] = await sql`SELECT status FROM v2_payment WHERE charge_id = 'C1'`
    expect(pay.status).toBe('APPROVED')
    const subs = await sql`SELECT tier_code, status FROM member_subscription WHERE user_id = ${users[0]}`
    expect(subs.length).toBe(1)
    expect(subs[0].tier_code).toBe('PLUS')
    const [mp] = await sql`SELECT plan_code FROM member_payment WHERE user_id = ${users[0]}`
    expect(mp.plan_code).toBe('MEMBER')
  })

  it('🔴 bad signature ⇒ 401, nothing settled', async () => {
    await seedPending('C2', users[0])
    const raw = chargeEvent('C2')
    const out = await fireWebhook(raw, 'deadbeef'.repeat(8), TS)
    expect(out.status).toBe(401)
    const [pay] = await sql`SELECT status FROM v2_payment WHERE charge_id = 'C2'`
    expect(pay.status).toBe('PENDING') // untouched
    const subs = await sql`SELECT id FROM member_subscription WHERE user_id = ${users[0]}`
    expect(subs.length).toBe(0)
  })

  it('🔴 two settlements of the SAME charge IN PARALLEL ⇒ provisions exactly ONCE (1 subscription row)', async () => {
    await seedPending('C3', users[1])
    const [a, b] = await Promise.all([settleAndProvision('C3'), settleAndProvision('C3')])
    expect([a.provisioned, b.provisioned].filter(Boolean).length).toBe(1) // DB arbiter: exactly one wins
    const subs = await sql`SELECT id FROM member_subscription WHERE user_id = ${users[1]}`
    expect(subs.length).toBe(1)
  })

  it('🔴 a replayed webhook (settle twice, sequential) provisions once', async () => {
    await seedPending('C4', users[1])
    const first = await settleAndProvision('C4')
    const second = await settleAndProvision('C4')
    expect(first.provisioned).toBe(true)
    expect(second.provisioned).toBe(false)
    const subs = await sql`SELECT id FROM member_subscription WHERE user_id = ${users[1]}`
    expect(subs.length).toBe(1)
  })

  it('🔴 B2 — settle uses the FROZEN expire on v2_payment, NOT a fresh payment_package read', async () => {
    // v2_payment for MONTHLY but with a FROZEN expire of 1Y (payment_package.MONTHLY is 1M). If settle read
    // payment_package it would grant ~1 month; reading the frozen term grants ~1 year. A mutant that
    // re-reads payment_package reddens this (the year vs month gap).
    await seedPending('C6', users[3], 'MONTHLY', 'PLUS', 50000, '1Y')
    const out = await fireWebhook(chargeEvent('C6'), signOmisePayload(chargeEvent('C6'), TS, SECRET), TS)
    expect(out.status).toBe(200)
    const [sub] = await sql`SELECT expire_at::text AS expire_at FROM member_subscription WHERE user_id = ${users[3]}`
    // ~1 year out (frozen '1Y'), so the year is next year — NOT this year + 1 month
    const nextYear = new Date().getFullYear() + 1
    expect(String(sub.expire_at).slice(0, 4)).toBe(String(nextYear))
  })

  it('🔴 shadow MERGE: an existing member with a LATER expiry keeps it (days never burn), plan stays MEMBER', async () => {
    // synthetic member_payment for a user that has none — far-future expiry
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
      VALUES (${users[2]}, 'MEMBER', 'SOULMATE', '2026-01-01 00:00:00', '2026-01-01', '2027-12-31')`
    await seedPending('C5', users[2]) // MONTHLY → +1 month, much sooner than 2027-12-31
    const out = await fireWebhook(chargeEvent('C5'), signOmisePayload(chargeEvent('C5'), TS, SECRET), TS)
    expect(out.status).toBe(200)
    const [mp] = await sql`SELECT plan_code, expire_at FROM member_payment WHERE user_id = ${users[2]}`
    expect(mp.plan_code).toBe('MEMBER')
    expect(String(mp.expire_at)).toBe('2027-12-31') // GREATEST — NOT shortened to next month
    // and a fresh subscription row was still recorded for this purchase
    const subs = await sql`SELECT id FROM member_subscription WHERE user_id = ${users[2]}`
    expect(subs.length).toBe(1)
  })
})
