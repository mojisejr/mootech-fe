// #484 — DB half: a REVERSED charge takes the entitlement with it, against a REAL postgres.
// skipIf(!TEST_DATABASE_URL) like the other db suites, so it does NOT run in the pre-push lane. Run it
// against the testenv pg for the PR proof:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/reversal-revoke-db.test.ts
//
// 🔴 MUTANT CONTRACT — delete either of these and a named test below goes RED:
//   lib/payment/repo.ts       the member_subscription UPDATE inside revokeByChargeId
//                             ⇒ "a reversal ends the v2 lane" fails: status stays ACTIVE
//   pages/api/v2/payment/webhook.ts   the `isReversal(evt)` branch
//                             ⇒ "a reversal arriving with paid:true still reaches us" fails: nothing moves
// The second one is the assertion that matters most: isTerminalFailure returns false the moment
// `paid === true` (gateway.ts:109), so without its own branch a reversal that reports itself as paid
// falls through the entire handler silently — which is the bug this ticket is about, one layer earlier
// than the ticket described it.
//
// Touches ONLY v2_payment (ours), and member_subscription/member_payment rows for `user` rows that have
// no member_payment of their own — never a real member's row.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import postgres from 'postgres'
import { signOmisePayload } from '@/lib/payment/webhook-verify'
import webhookHandler from '@/pages/api/v2/payment/webhook'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0006 = readFileSync(resolve('lib/db/0006_member_subscription.sql'), 'utf8')
const M0007 = readFileSync(resolve('lib/db/0007_v2_payment.sql'), 'utf8')
const M0008 = readFileSync(resolve('lib/db/0008_discount_code.sql'), 'utf8')
const M0010 = readFileSync(resolve('lib/db/0010_v2_payment_failure.sql'), 'utf8')
const M0011 = readFileSync(resolve('lib/db/0011_v2_payment_qr_expiry.sql'), 'utf8')
const M0012 = readFileSync(resolve('lib/db/0012_v2_payment_prev_member_expire.sql'), 'utf8')
const SECRET = Buffer.from('whsec_test_484').toString('base64')
const TS = '1755766800'
const NOW = new Date()
const bkk = (n: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(n)

// 🔴 paid defaults to TRUE here, the opposite of the only reversal fixture that existed before this ticket
// (scripts/reconcile-expiry.test.ts:123 sets paid:false). Neither shape has ever been observed on a real
// reversal from Omise — no reversed event has reached this webhook — so the code must not care, and these
// tests assert both shapes produce the same outcome rather than picking a winner.
function reversalEvent(chargeId: string, paid = true) {
  return Buffer.from(JSON.stringify({ key: 'charge.complete', data: { id: chargeId, status: 'reversed', paid } }), 'utf8')
}
function completeEvent(chargeId: string) {
  return Buffer.from(JSON.stringify({ key: 'charge.complete', data: { id: chargeId, status: 'successful', paid: true } }), 'utf8')
}
function statusEvent(chargeId: string, status: string) {
  return Buffer.from(JSON.stringify({ key: 'charge.complete', data: { id: chargeId, status, paid: false } }), 'utf8')
}

function fireWebhook(raw: Buffer, sig: string, ts: string) {
  const req = Readable.from([raw]) as unknown as { method: string; headers: Record<string, string> }
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
  return (webhookHandler as unknown as (q: unknown, s: unknown) => Promise<void>)(req, res).then(() => out)
}
const fire = (raw: Buffer) => fireWebhook(raw, signOmisePayload(raw, TS, SECRET), TS)

describe.skipIf(!TEST_URL)('#484 a reversed charge takes the entitlement with it', () => {
  let sql: ReturnType<typeof postgres>
  let users: string[] = []

  beforeAll(async () => {
    process.env.OMISE_WEBHOOK_SECRET = SECRET
    sql = postgres(TEST_URL as string, { max: 6, ssl: false })
    await sql.unsafe(M0006)
    await sql.unsafe('ALTER TABLE member_subscription DROP COLUMN IF EXISTS v2_payment_id;')
    await sql.unsafe('DROP TABLE IF EXISTS v2_payment CASCADE;')
    await sql.unsafe(M0007)
    await sql.unsafe(M0008)
    await sql.unsafe(M0010)
    await sql.unsafe(M0011)
    await sql.unsafe(M0012)
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

  const seedPending = (chargeId: string, userId: string) =>
    sql`INSERT INTO v2_payment (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status)
        VALUES (${'v2p-' + chargeId}, ${userId}, 'MONTHLY', 'PLUS', 50000, 0, '1M', 0, 'promptpay', ${chargeId}, ${'ord' + chargeId}, 'PENDING')`

  const shadowOf = async (userId: string) => {
    const [mp] = await sql`SELECT expire_at FROM member_payment WHERE user_id = ${userId}`
    return mp ? String(mp.expire_at).slice(0, 10) : null
  }
  const subStatuses = async (userId: string) => {
    const rows = await sql`SELECT status FROM member_subscription WHERE user_id = ${userId} ORDER BY expire_at`
    return rows.map((r) => String(r.status))
  }

  it('a reversal arriving with paid:true still reaches us — the routing does not depend on that field', async () => {
    await seedPending('R1', users[0])
    expect((await fire(completeEvent('R1'))).status).toBe(200)
    expect(await subStatuses(users[0])).toEqual(['ACTIVE'])

    const out = await fire(reversalEvent('R1', true)) // paid:true is the shape isTerminalFailure drops
    expect(out.status).toBe(200)
    const [pay] = await sql`SELECT failure_code FROM v2_payment WHERE charge_id = 'R1'`
    expect(pay.failure_code).toBe('gateway_reversed')
  })

  it('a reversal ends the v2 lane — member_subscription leaves ACTIVE', async () => {
    await seedPending('R2', users[0])
    await fire(completeEvent('R2'))
    await fire(reversalEvent('R2'))
    expect(await subStatuses(users[0])).toEqual(['EXPIRED'])
  })

  it('paid:false produces exactly the same outcome as paid:true', async () => {
    await seedPending('R3', users[0])
    await fire(completeEvent('R3'))
    await fire(reversalEvent('R3', false))
    expect(await subStatuses(users[0])).toEqual(['EXPIRED'])
  })

  it('the shadow goes back to what it was before this purchase, not to a guess', async () => {
    const before = '2027-01-31'
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
              VALUES (${users[1]}, 'MEMBER', 'LEGACY', ${bkk(NOW)}, ${bkk(NOW)}, ${before})`
    await seedPending('R4', users[1])
    await fire(completeEvent('R4'))
    // settlement pushed the shadow forward; the pre-purchase value was captured on the payment row
    const [pay] = await sql`SELECT prev_member_expire_at FROM v2_payment WHERE charge_id = 'R4'`
    expect(String(pay.prev_member_expire_at).slice(0, 10)).toBe(before)

    await fire(reversalEvent('R4'))
    expect(await shadowOf(users[1])).toBe(before)
  })

  it('a purchase made AFTER the reversed one keeps its own expiry — the restore takes the later date', async () => {
    await seedPending('R5a', users[2])
    await fire(completeEvent('R5a'))
    await seedPending('R5b', users[2])
    await fire(completeEvent('R5b'))
    const laterShadow = await shadowOf(users[2])

    await fire(reversalEvent('R5a')) // reverse the FIRST one
    const survivors = await sql`SELECT expire_at FROM member_subscription WHERE user_id = ${users[2]} AND status = 'ACTIVE'`
    expect(survivors.length).toBe(1)
    expect(await shadowOf(users[2])).toBe(laterShadow)
  })

  it('a row that predates 0012 is NOT guessed over — the shadow is left exactly as it was', async () => {
    await seedPending('R6', users[3])
    await fire(completeEvent('R6'))
    // simulate the pre-migration world: the capture never happened for this row
    await sql`UPDATE v2_payment SET prev_member_expire_at = NULL WHERE charge_id = 'R6'`
    await sql`UPDATE member_subscription SET status = 'REPLACED' WHERE user_id = ${users[3]}`
    const untouched = await shadowOf(users[3])

    await fire(reversalEvent('R6'))
    expect(await shadowOf(users[3])).toBe(untouched) // no ACTIVE survivor and nothing captured ⇒ hands off
    const [pay] = await sql`SELECT failure_code FROM v2_payment WHERE charge_id = 'R6'`
    expect(pay.failure_code).toBe('gateway_reversed') // the v2 lane still records the reversal
  })

  // 🔴 ตู๋ proved this one with rows, on 9bb1915, and it was RED then: the naive restore read the reversed
  // purchase's own captured value and left the user a month they had been refunded for.
  it('two purchases, both reversed — the shadow goes back to the ORIGINAL base, not to the reversed one', async () => {
    const base = '2026-09-30'
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
              VALUES (${users[2]}, 'MEMBER', 'LEGACY', ${bkk(NOW)}, ${bkk(NOW)}, ${base})`
    await seedPending('RA', users[2])
    await fire(completeEvent('RA'))
    const afterA = await shadowOf(users[2])
    await seedPending('RB', users[2])
    await fire(completeEvent('RB'))
    const afterB = await shadowOf(users[2])
    expect(afterA).not.toBe(base) // the grants really did push the shadow forward
    expect(afterB).not.toBe(afterA)

    // 🔴 ลำดับสำคัญ และผมเขียนกลับด้านในรอบแรกจนเทสต์ผ่านทั้งที่บั๊กยังอยู่ (มิวแทนต์ไม่แดง)
    // ตีกลับ A ก่อน: แถวของ A เป็น REPLACED ไปแล้วเพราะ B มาทับ ⇒ เงายังถือวันของ B ซึ่งถูกต้อง
    // แล้วค่อยตีกลับ B: ถึงตรงนี้ไม่เหลือแถว ACTIVE เลย ⇒ ถ้าอ่าน prev ของ B จะได้วันของ A ที่ถูกคืนไปแล้ว
    await fire(reversalEvent('RA'))
    await fire(reversalEvent('RB'))
    // เงินคืนครบทั้งสองครั้ง ⇒ ไม่มีเดือนไหนเหลือให้ถือ
    expect(await shadowOf(users[2])).toBe(base)
  })

  it('a second delivery of the same reversal changes nothing', async () => {
    const before = '2027-03-31'
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
              VALUES (${users[1]}, 'MEMBER', 'LEGACY', ${bkk(NOW)}, ${bkk(NOW)}, ${before})`
    await seedPending('R7', users[1])
    await fire(completeEvent('R7'))
    await fire(reversalEvent('R7'))
    const after = await shadowOf(users[1])
    await fire(reversalEvent('R7')) // re-delivery
    expect(await shadowOf(users[1])).toBe(after)
    expect(await subStatuses(users[1])).toEqual(['EXPIRED'])
  })

  it('failed and expired do NOT revoke — only a reversal grants-then-takes-back', async () => {
    for (const [i, status] of ['failed', 'expired'].entries()) {
      const c = `R8${i}`
      await seedPending(c, users[0])
      await fire(completeEvent(c))
      await fire(statusEvent(c, status))
      expect(await subStatuses(users[0])).toEqual(['ACTIVE'])
      await sql`DELETE FROM member_subscription WHERE user_id = ${users[0]}`
      await sql.unsafe('DELETE FROM v2_payment;')
      await sql`DELETE FROM member_payment WHERE user_id = ${users[0]}`
    }
  })

  it('#371 is untouched: a duplicate charge.complete after a reversal does NOT grant again', async () => {
    await seedPending('R9', users[0])
    await fire(completeEvent('R9'))
    await fire(reversalEvent('R9'))
    expect(await subStatuses(users[0])).toEqual(['EXPIRED'])

    await fire(completeEvent('R9')) // late duplicate of the original success
    expect(await subStatuses(users[0])).toEqual(['EXPIRED'])
    const [pay] = await sql`SELECT status FROM v2_payment WHERE charge_id = 'R9'`
    expect(pay.status).toBe('APPROVED') // history, never rewritten
  })
})
