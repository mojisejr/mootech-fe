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
import { computeExpireDate } from '@/lib/payment/provision'
import webhookHandler from '@/pages/api/v2/payment/webhook'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0006 = readFileSync(resolve('lib/db/0006_member_subscription.sql'), 'utf8')
const M0007 = readFileSync(resolve('lib/db/0007_v2_payment.sql'), 'utf8')
// #361 added discount columns to v2_payment via 0008's ALTERs; the drizzle schema (and every select) now
// includes them, so the table must be built with 0008 too or the reads fail on a missing column.
const M0008 = readFileSync(resolve('lib/db/0008_discount_code.sql'), 'utf8')
const SECRET = Buffer.from('whsec_test_355').toString('base64')
const TS = '1755766800'
const NOW = new Date()
const bkk = (n: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(n)

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
    await sql.unsafe(M0008) // + #361's discount columns/tables (schema-wide select needs them)
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
    // 🔴 assert the FULL frozen-1Y date (not just the year — in December, +1Y and the mutant's +1M land in
    // the SAME year and a year-only probe would pass with the freeze removed; ตู๋ #370 T1). Tie it to the
    // pure computeExpireDate so a mutant that settles on +1M reddens in EVERY month.
    const expected = computeExpireDate(bkk(NOW), 0, { value: 1, unit: 'Y' })
    expect(String(sub.expire_at)).toBe(expected)
  })

  it('T2 — the DB REFUSES a malformed frozen expire (CHECK on the format)', async () => {
    await expect(
      sql`INSERT INTO v2_payment (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status)
          VALUES ('v2p-bad', ${users[0]}, 'MONTHLY', 'PLUS', 50000, 0, '1Y 6M', 0, 'card', 'Cbad', 'ordbad', 'PENDING')`,
    ).rejects.toThrow(/check|expire/i)
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

  // ══ #371 · เงินออกแล้วแต่ charge_id ไม่เคยถูกผูกกับแถว ═══════════════════════════════════════════════
  //
  // The ticket described "the row was never written". That order is no longer possible: #361 moved the row
  // (and the discount reservation) to BEFORE the gateway call. What survived the reorder is the window
  // AFTER the money moves and BEFORE `attachChargeId` lands — a deploy, a DB blip, or simply PromptPay's
  // webhook arriving first. The row exists, holds its `pending:<id>` placeholder, and the webhook that
  // could grant the membership cannot find it. Both sides then believe everything is fine.
  //
  // 🔴 MUTANT CONTRACT: delete the order_id fallback in settleAndProvision (or stop reading
  // data.metadata.orderId in parseChargeEvent) → ① and ② below go RED.
  const chargeEventWithOrder = (chargeId: string, orderId: string) =>
    Buffer.from(
      JSON.stringify({
        key: 'charge.complete',
        data: { id: chargeId, status: 'successful', paid: true, metadata: { orderId } },
      }),
      'utf8',
    )
  const seedRow = (
    id: string,
    o: { chargeId: string; orderId: string; status: string; userId: string; codeId?: string | null; quoteId?: string | null; discount?: number },
  ) =>
    sql`INSERT INTO v2_payment (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status, code_id, quote_id, discount_satang)
        VALUES (${id}, ${o.userId}, 'MONTHLY', 'PLUS', 50000, 0, '1M', 0, 'card', ${o.chargeId}, ${o.orderId}, ${o.status},
                ${o.codeId ?? null}, ${o.quoteId ?? null}, ${o.discount ?? 0})`
  const fire = (chargeId: string, orderId: string) => {
    const raw = chargeEventWithOrder(chargeId, orderId)
    return fireWebhook(raw, signOmisePayload(raw, TS, SECRET), TS)
  }

  it('🔴 ① attachChargeId never landed (row still on its placeholder) → recovered by order_id and granted', async () => {
    await seedRow('p371-a', { chargeId: 'pending:p371-a', orderId: 'ORD371A', status: 'PENDING', userId: users[0] })
    const out = await fire('chrg_371_a', 'ORD371A')
    expect(out.status).toBe(200)

    const [pay] = await sql`SELECT status, charge_id FROM v2_payment WHERE id = 'p371-a'`
    expect(pay.status).toBe('APPROVED')
    expect(pay.charge_id).toBe('chrg_371_a') // the real id is now bound, so a replay matches directly
    const subs = await sql`SELECT id FROM member_subscription WHERE user_id = ${users[0]}`
    expect(subs.length).toBe(1) // the membership the customer paid for actually exists
  })

  it('🔴 ② the gateway call THREW although the card was charged (row REJECTed) → still recovered', async () => {
    // abandonPending marks REJECT and leaves the placeholder — a read timeout is indistinguishable from a
    // refusal, so this row is the shape a successful-but-unacknowledged charge leaves behind.
    await seedRow('p371-b', { chargeId: 'pending:p371-b', orderId: 'ORD371B', status: 'REJECT', userId: users[1] })
    await fire('chrg_371_b', 'ORD371B')

    const [pay] = await sql`SELECT status FROM v2_payment WHERE id = 'p371-b'`
    expect(pay.status).toBe('APPROVED')
    expect((await sql`SELECT id FROM member_subscription WHERE user_id = ${users[1]}`).length).toBe(1)
  })

  it('③ replaying the recovered delivery grants nothing more (at-most-once survives the new path)', async () => {
    await seedRow('p371-c', { chargeId: 'pending:p371-c', orderId: 'ORD371C', status: 'PENDING', userId: users[2] })
    await fire('chrg_371_c', 'ORD371C')
    await fire('chrg_371_c', 'ORD371C')
    expect((await sql`SELECT id FROM member_subscription WHERE user_id = ${users[2]}`).length).toBe(1)
  })

  it('🔴 ④ a charge that matches NOTHING grants nothing (and does not invent a row)', async () => {
    const out = await fire('chrg_371_unknown', 'ORD371_UNKNOWN')
    expect(out.status).toBe(200) // Omise must not retry forever on a charge that is not ours
    expect((await sql`SELECT id FROM v2_payment`).length).toBe(0)
    expect((await sql`SELECT id FROM member_subscription WHERE user_id = ANY(${users})`).length).toBe(0)
  })

  it('🔴 ⑤ two rows share an order_id → refuse to guess (nobody is granted)', async () => {
    // order_id is 10 random digits with no uniqueness constraint. Picking "whichever row came back first"
    // would hand one person's payment to another account.
    await seedRow('p371-d1', { chargeId: 'pending:p371-d1', orderId: 'ORD371D', status: 'PENDING', userId: users[0] })
    await seedRow('p371-d2', { chargeId: 'pending:p371-d2', orderId: 'ORD371D', status: 'PENDING', userId: users[1] })
    await fire('chrg_371_d', 'ORD371D')

    const rows = await sql`SELECT status FROM v2_payment WHERE order_id = 'ORD371D'`
    expect(rows.every((r) => r.status === 'PENDING')).toBe(true)
    expect((await sql`SELECT id FROM member_subscription WHERE user_id = ANY(${users})`).length).toBe(0)
  })

  it('🔴 ⑥ a row already bound to a DIFFERENT real charge is never adopted', async () => {
    await seedRow('p371-e', { chargeId: 'chrg_someone_else', orderId: 'ORD371E', status: 'PENDING', userId: users[0] })
    await fire('chrg_371_e', 'ORD371E')

    const [pay] = await sql`SELECT status, charge_id FROM v2_payment WHERE id = 'p371-e'`
    expect(pay.charge_id).toBe('chrg_someone_else') // untouched
    expect(pay.status).toBe('PENDING')
  })

  it('🔴 ⑦ the discount slot the failed charge gave back is put BACK when the charge turns out paid', async () => {
    // The sale happened, so the slot was really spent. Leaving it released undercounts used_count and lets
    // the next buyer spend a slot this sale already consumed.
    // 🔴 clean FIRST, not only in `finally`. The first run of this case crashed IN the cleanup (FK order),
    // which left the code row behind and made the NEXT run fail on a duplicate key — a failure that says
    // nothing about the money path. A fixture that cannot survive the previous run's crash is a fixture
    // that reports the wrong thing exactly when something is already wrong.
    // dependency order, deepest first: member_subscription → discount_redemption → v2_payment →
    // payment_quote → discount_code. Getting it wrong makes the CLEANUP the thing that fails.
    await sql`DELETE FROM member_subscription WHERE v2_payment_id = 'p371-f'`
    await sql`DELETE FROM discount_redemption WHERE payment_id = 'p371-f'`
    await sql`DELETE FROM v2_payment WHERE id = 'p371-f'`
    await sql`DELETE FROM payment_quote WHERE id = 'q371'`
    await sql`DELETE FROM discount_code WHERE id = 'dc371'`
    await sql`INSERT INTO discount_code (id, code, kind, value, applies_to, status, used_count, max_use_total)
              VALUES ('dc371', 'GOO371', 'PERCENT', 10, '{}', 'ACTIVE', 0, 5)`
    await sql`INSERT INTO payment_quote (id, user_id, package_code, code_id, list_satang, discount_satang, amount_satang, vat_percent, expires_at)
              VALUES ('q371', ${users[3]}, 'MONTHLY', 'dc371', 50000, 5000, 45000, 7, now() + interval '1 hour')`
    await seedRow('p371-f', {
      chargeId: 'pending:p371-f', orderId: 'ORD371F', status: 'REJECT', userId: users[3],
      codeId: 'dc371', quoteId: 'q371', discount: 5000,
    })
    try {
      await fire('chrg_371_f', 'ORD371F')

      const [pay] = await sql`SELECT status FROM v2_payment WHERE id = 'p371-f'`
      expect(pay.status).toBe('APPROVED')
      const red = await sql`SELECT vat_percent_at_purchase FROM discount_redemption WHERE payment_id = 'p371-f'`
      expect(red.length).toBe(1)
      expect(red[0].vat_percent_at_purchase).toBe(7) // taken from the quote, never guessed
      const [code] = await sql`SELECT used_count FROM discount_code WHERE id = 'dc371'`
      expect(code.used_count).toBe(1)

      await fire('chrg_371_f', 'ORD371F') // replay must not double-count the slot
      const [after] = await sql`SELECT used_count FROM discount_code WHERE id = 'dc371'`
      expect(after.used_count).toBe(1)
    } finally {
      // 🔴 restore in `finally`: an assertion that throws above must not leave these rows behind for the
      // next test to trip over (the leak class that cost two red suites on 08-22).
      // order matters: v2_payment references BOTH the quote and the code, so it goes first — otherwise the
      // cleanup itself throws on the FK and the test reports a failure that has nothing to do with the money
      // path it just proved (it did that on the first run).
      await sql`DELETE FROM member_subscription WHERE v2_payment_id = 'p371-f'`
      await sql`DELETE FROM discount_redemption WHERE payment_id = 'p371-f'`
      await sql`DELETE FROM v2_payment WHERE id = 'p371-f'`
      await sql`DELETE FROM payment_quote WHERE id = 'q371'`
      await sql`DELETE FROM discount_code WHERE id = 'dc371'`
    }
  })

  // ⑧ 🔴 THE SEPARATOR THE OTHER SEVEN CASES DO NOT TEST (ตู๋, review of #405).
  //
  // Every case above sends `paid:true, status:'successful'`. That proves recovery WORKS, and proves nothing
  // at all about the thing recovery must never do: wake a REJECTed row on an event that is not a payment.
  // The behaviour is correct today — `isSettleable` requires key/paid/status together, so a non-paid event
  // never reaches settleAndProvision — but "correct today" with nothing watching is how a separator dies:
  // the day someone relaxes isSettleable (or moves the recovery call outside that `if`), a `charge.pending`
  // or a failed charge would adopt the charge id and grant a membership nobody paid for.
  //
  // 🔴 MUTANT CONTRACT: drop the `paid` (or the `status === 'successful'`) requirement from isSettleable
  // → this case goes RED. Nothing else in the suite does.
  const nonPaidEvent = (chargeId: string, orderId: string, over: Record<string, unknown>) =>
    Buffer.from(
      JSON.stringify({
        key: 'charge.complete',
        data: { id: chargeId, status: 'successful', paid: true, metadata: { orderId }, ...over },
      }),
      'utf8',
    )

  it('🔴 ⑧ an event that is not a completed PAYMENT never wakes a REJECTed row through the order_id path', async () => {
    // the shape a charge that was cut off leaves behind: REJECT + still on its placeholder
    const shapes: Array<[string, Record<string, unknown>]> = [
      ['paid:false', { paid: false }],
      ['status failed', { status: 'failed', paid: false }],
      ['status pending (not finished yet)', { status: 'pending', paid: false }],
      ['paid but status failed', { status: 'failed', paid: true }],
      ['a different event key', { }],
    ]
    for (const [label, over] of shapes) {
      await sql`DELETE FROM member_subscription WHERE user_id = ${users[0]}`
      await sql.unsafe('DELETE FROM v2_payment;')
      await seedRow('p371-g', { chargeId: 'pending:p371-g', orderId: 'ORD371G', status: 'REJECT', userId: users[0] })

      const raw =
        label === 'a different event key'
          ? Buffer.from(
              JSON.stringify({ key: 'charge.create', data: { id: 'chrg_371_g', status: 'successful', paid: true, metadata: { orderId: 'ORD371G' } } }),
              'utf8',
            )
          : nonPaidEvent('chrg_371_g', 'ORD371G', over)
      const out = await fireWebhook(raw, signOmisePayload(raw, TS, SECRET), TS)
      expect(out.status).toBe(200) // still a well-formed delivery — we just do not act on it

      const [pay] = await sql`SELECT status, charge_id FROM v2_payment WHERE id = 'p371-g'`
      expect(pay.status, `${label}: must not be granted`).not.toBe('APPROVED')
      // and the charge id must NOT be adopted — adopting it would let a later paid event for a DIFFERENT
      // charge miss this row, and it silently rewrites which charge this payment belongs to.
      expect(pay.charge_id, `${label}: must not adopt the charge id`).toBe('pending:p371-g')
      expect(
        (await sql`SELECT id FROM member_subscription WHERE user_id = ${users[0]}`).length,
        `${label}: nobody may be granted a membership`,
      ).toBe(0)
    }
  })
})
