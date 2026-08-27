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
// #437 added failure_code/failure_message to v2_payment via 0010's ALTERs. Same trap as 0008 above:
// the drizzle schema now includes them, so EVERY schema-wide select/returning asks for them — including
// settleAndProvision's. Build the table without 0010 and the money path dies on a missing column.
const M0010 = readFileSync(resolve('lib/db/0010_v2_payment_failure.sql'), 'utf8')
// 🔴 0011 and 0012 are ALTERs on v2_payment too, and this suite was already missing 0011 before #484
// touched it: the drizzle schema has carried charge_expires_at since #455, so every schema-wide
// select/returning here has been asking for a column this fixture never created. It did not show up
// because these suites are skipIf(!TEST_DATABASE_URL) and nothing in the pre-push lane runs them.
// The pattern is the point: an ALTER that lands in schema.ts must land in every fixture that builds
// the table by hand, and there is nothing that enforces it — so the list is checked by running them.
const M0011 = readFileSync(resolve('lib/db/0011_v2_payment_qr_expiry.sql'), 'utf8')
const M0012 = readFileSync(resolve('lib/db/0012_v2_payment_prev_member_expire.sql'), 'utf8')
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
    await sql.unsafe(M0010) // #437 — failure_code/failure_message (schema-wide select needs them)
    await sql.unsafe(M0011) // #455 — charge_expires_at (schema-wide select needs it)
    await sql.unsafe(M0012) // #484 — prev_member_expire_at (schema-wide select needs it)
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

  const seedSub = (
    id: string,
    userId: string,
    tier: string,
    expireAt: string,
    status = 'ACTIVE',
    startAt = bkk(NOW),
  ) =>
    sql`INSERT INTO member_subscription (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, status)
        VALUES (${id}, ${userId}, ${tier}, ${'PKG-' + tier}, 79000, ${startAt}, ${expireAt}, ${status})`

  const addDaysStr = (ymd: string, n: number) => {
    const [y, m, d] = ymd.split('-').map(Number)
    const t = new Date(Date.UTC(y, m - 1, d + n))
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
  }
  const dateOf = (v: unknown) => (v instanceof Date ? bkk(v) : String(v).slice(0, 10))

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

  // 🔴 CHANGED BY #456 — READ THIS BEFORE TRUSTING THE OLD NUMBER. Until #456 this test asserted the shadow
  // stayed at exactly '2027-12-31', and it passed. It passed while the user was LOSING fifteen months.
  //
  // The reason is the gap between what this test measured and what the user experiences:
  // lib/v2/subscription.ts:142 picks a live member_subscription row OVER the legacy member_payment date. So
  // a legacy member who bought one month got a v2 row expiring next month, and THAT is what every screen
  // then read — their 2027-12-31 was still sitting in member_payment, correct, preserved, and no longer
  // consulted by anybody. This test watched the store that had stopped deciding.
  //
  // Under #456 the purchase carries their remaining days: 2027-12-31 + the month they just bought =
  // 2028-01-31, in BOTH stores. The original claim ("days never burn") is now asserted where it can
  // actually be observed — at the reader — and the shadow is additionally pinned as never-shortened rather
  // than never-changed.
  it('🔴 shadow MERGE + #456 carry-over: a legacy member with a LATER expiry keeps every day AND gains the month they bought', async () => {
    // synthetic member_payment for a user that has none — far-future expiry
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
      VALUES (${users[2]}, 'MEMBER', 'SOULMATE', '2026-01-01 00:00:00', '2026-01-01', '2027-12-31')`
    await seedPending('C5', users[2]) // MONTHLY → +1 month, on TOP of 2027-12-31 (was: instead of it)
    const out = await fireWebhook(chargeEvent('C5'), signOmisePayload(chargeEvent('C5'), TS, SECRET), TS)
    expect(out.status).toBe(200)

    const [mp] = await sql`SELECT plan_code, expire_at FROM member_payment WHERE user_id = ${users[2]}`
    expect(mp.plan_code).toBe('MEMBER')
    // GREATEST still holds: the shadow is never SHORTENED. It may now move forward, because the purchase
    // genuinely added time — a mutant that shortens it below the legacy date still reddens here.
    expect(dateOf(mp.expire_at) >= '2027-12-31').toBe(true)
    expect(dateOf(mp.expire_at)).toBe(addDaysStr('2027-12-31', 31)) // Dec 31 + the 1M package = 2028-01-31

    // and a fresh subscription row was still recorded for this purchase
    const subs = await sql`SELECT id, expire_at FROM member_subscription WHERE user_id = ${users[2]}`
    expect(subs.length).toBe(1)

    // 🔴 THE ASSERTION THE OLD VERSION WAS MISSING: what the user's screen actually reads. This is the one
    // that would have caught the loss, and the one a future mutant has to get past.
    const { resolveSubscription } = await import('@/lib/v2/subscription')
    const verdict = await resolveSubscription(users[2], NOW)
    expect(verdict.isPaid).toBe(true)
    expect(dateOf(subs[0].expire_at) >= '2027-12-31', 'the live v2 row must not expire before the legacy date it overrides').toBe(true)
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

  // ⑧b CONTROL — ตู๋'s addition, taken as written (his reasoning, my file). Without it, ⑧ could go green
  // for the boring reason: the recovery path broken outright makes every "must not recover" case pass.
  // Case ② already covers that from a distance, but a negative test whose control lives in another test is
  // a negative test the next reader has to go looking for — and the day ② is edited for its own reasons,
  // ⑧ quietly stops meaning anything. The control belongs next to the claim it protects.
  it('⑧ b control: the SAME shape of row IS recovered by a charge that really succeeded', async () => {
    await seedRow('p371-i', { chargeId: 'pending:p371-i', orderId: 'ORD371I', status: 'REJECT', userId: users[0] })
    try {
      const out = await fire('C371I', 'ORD371I')
      expect(out.status).toBe(200)
      const [row] = await sql`SELECT status, charge_id FROM v2_payment WHERE id = 'p371-i'`
      expect(row.status).toBe('APPROVED')
      expect(row.charge_id).toBe('C371I')
      expect((await sql`SELECT id FROM member_subscription WHERE v2_payment_id = 'p371-i'`).length).toBe(1)
    } finally {
      await sql`DELETE FROM member_subscription WHERE v2_payment_id = 'p371-i'`
      await sql`DELETE FROM v2_payment WHERE id = 'p371-i'`
    }
  })

  // ── #456 — ซื้อซ้ำ / อัปเกรด, against real postgres ──────────────────────────────────────────────
  //
  // This is the half the pure tests cannot reach: the DoD's "แถวเก่ากลายเป็น REPLACED และ
  // pickActiveSubscriptionRow หยิบแถวใหม่" is a claim about two writes landing together in one
  // transaction, and about what the READER then sees. Only a real DB can answer it.
  it('#456 ① upgrade PLUS→PRO: the old row becomes REPLACED and the 100 days left FOLLOW onto the new row', async () => {
    const u = users[2]
    const today = bkk(NOW)
    const oldExpire = addDaysStr(today, 100)
    await seedSub('s456-old', u, 'PLUS', oldExpire)
    await seedPending('C456A', u, 'YEARLY-PRO', 'PRO', 129000, '1Y', 0)

    const r = await settleAndProvision('C456A')
    expect(r.provisioned).toBe(true)

    const rows = await sql`SELECT id, tier_code, status, expire_at FROM member_subscription
                           WHERE user_id = ${u} ORDER BY status`
    expect(rows.length).toBe(2) // history is preserved — nothing is deleted (Principle 1)

    const oldRow = rows.find((r) => r.id === 's456-old')
    const newRow = rows.find((r) => r.id !== 's456-old')
    expect(oldRow?.status, 'the superseded row must be REPLACED').toBe('REPLACED')
    expect(newRow?.status).toBe('ACTIVE')
    expect(newRow?.tier_code).toBe('PRO')

    // 🔴 THE NUMBER THIS TICKET EXISTS FOR: 1 year from today PLUS the 100 days they had left.
    const expected = addDaysStr(computeExpireDate(today, 0, { value: 1, unit: 'Y' }), 100)
    expect(dateOf(newRow?.expire_at)).toBe(expected)
  })

  it('#456 ② the READER then answers PRO — the new row wins and the REPLACED one is invisible', async () => {
    const u = users[2]
    const today = bkk(NOW)
    await seedSub('s456-old2', u, 'PLUS', addDaysStr(today, 100))
    await seedPending('C456B', u, 'YEARLY-PRO', 'PRO', 129000, '1Y', 0)
    await settleAndProvision('C456B')

    const { resolveSubscription } = await import('@/lib/v2/subscription')
    const verdict = await resolveSubscription(u, NOW)
    expect(verdict.isPaid).toBe(true)
    expect(verdict.tier).toBe('PRO')
    expect(verdict.source).toBe('v2')
  })

  it('#456 ③ a FIRST purchase is unchanged — no prior row ⇒ the span is exactly the package, not a day more', async () => {
    const u = users[3]
    const today = bkk(NOW)
    await seedPending('C456C', u, 'MONTHLY', 'PLUS', 50000, '1M', 0)
    await settleAndProvision('C456C')

    const rows = await sql`SELECT status, expire_at FROM member_subscription WHERE user_id = ${u}`
    expect(rows.length).toBe(1)
    expect(rows[0].status).toBe('ACTIVE')
    expect(dateOf(rows[0].expire_at)).toBe(computeExpireDate(today, 0, { value: 1, unit: 'M' }))
  })

  it('#456 ④ an EXPIRED row is not superseded and carries nothing — a lapsed member simply buys again', async () => {
    const u = users[2]
    const today = bkk(NOW)
    await seedSub('s456-dead', u, 'PLUS', addDaysStr(today, -30)) // ACTIVE status, but past its expiry
    await seedPending('C456D', u, 'MONTHLY', 'PLUS', 50000, '1M', 0)
    await settleAndProvision('C456D')

    const [dead] = await sql`SELECT status FROM member_subscription WHERE id = 's456-dead'`
    expect(dead.status, 'a row that already expired was not superseded by this purchase').toBe('ACTIVE')
    const [fresh] = await sql`SELECT expire_at FROM member_subscription WHERE user_id = ${u} AND id <> 's456-dead'`
    expect(dateOf(fresh.expire_at)).toBe(computeExpireDate(today, 0, { value: 1, unit: 'M' })) // nothing carried
  })

  it('#456 ⑤ two accepted charges settling one after the other CHAIN — the second carries the first\'s days', async () => {
    const u = users[3]
    const today = bkk(NOW)
    await seedPending('C456E', u, 'MONTHLY', 'PLUS', 50000, '1M', 0)
    await seedPending('C456F', u, 'YEARLY-PRO', 'PRO', 129000, '1Y', 0)

    await settleAndProvision('C456E') // → PLUS, 1 month
    await settleAndProvision('C456F') // → PRO, 1 year + whatever the month had left

    const rows = await sql`SELECT status, tier_code, expire_at FROM member_subscription WHERE user_id = ${u}`
    expect(rows.length).toBe(2)
    expect(rows.filter((r) => r.status === 'ACTIVE').length, 'exactly ONE live row — the bug was two').toBe(1)

    const live = rows.find((r) => r.status === 'ACTIVE')
    expect(live?.tier_code).toBe('PRO')
    // The month's remaining days = its expiry minus today; they ride onto the year.
    const monthExpire = computeExpireDate(today, 0, { value: 1, unit: 'M' })
    const carried = Math.round((Date.parse(monthExpire) - Date.parse(today)) / 86_400_000)
    expect(dateOf(live?.expire_at)).toBe(addDaysStr(computeExpireDate(today, 0, { value: 1, unit: 'Y' }), carried))
  })

  // 🔴 #456 ⑦ — THE POLAR OPPOSITE OF ⑤ (ตู๋, review of 2c196b8). ⑤ proves the way UP; nothing proved the
  // way DOWN, and the way down was broken: the door asks the matrix when the charge is CREATED, but a
  // PromptPay QR that the user closed stays PENDING forever (no writer expires it — ตู๋ confirmed while
  // reviewing #452). So:
  //
  //   free user taps PLUS with PromptPay  → QR issued, tab closed          (v2_payment PENDING, forever)
  //   changes their mind, taps PRO with a card → door says yes (they ARE free) → settles → PRO
  //   days later they find the old QR and pay it → the webhook lands       → they become PLUS
  //
  // ตู๋'s probe on real postgres: 1,790 บาท paid, tier PLUS held, the PRO row marked REPLACED. The days
  // survived (carry-over worked); the LEVEL did not. That is "PRO buys PLUS ⇒ refuse" from ฟีม's matrix,
  // arriving at the webhook instead of at the door — and nobody was asking the matrix there.
  it('#456 ⑦ REVERSE ORDER: a stale LOWER-tier charge settling after an upgrade must NOT take the level away', async () => {
    const u = users[2]
    const today = bkk(NOW)
    // Both charges were created while the user was free — both legitimately passed the door.
    await seedPending('C456H', u, 'MONTHLY', 'PLUS', 50000, '1M', 0) // the abandoned QR
    await seedPending('C456I', u, 'YEARLY-PRO', 'PRO', 129000, '1Y', 0) // the card they actually used

    await settleAndProvision('C456I') // the card lands first → PRO
    const { resolveSubscription } = await import('@/lib/v2/subscription')
    expect((await resolveSubscription(u, NOW)).tier, 'precondition: the card purchase granted PRO').toBe('PRO')

    await settleAndProvision('C456H') // the old QR is finally paid

    // 🔴 THE CLAIM: money that was already spent may be recorded, but it may never DOWNGRADE anybody.
    const after = await resolveSubscription(u, NOW)
    expect(after.tier, 'a stale PLUS charge must not demote a PRO member').toBe('PRO')
    expect(after.isPaid).toBe(true)

    // and the PRO row must still be the live one — not superseded by the thing that came after it
    const rows = await sql`SELECT tier_code, status FROM member_subscription WHERE user_id = ${u}`
    const pro = rows.find((r) => r.tier_code === 'PRO')
    expect(pro?.status, 'the higher row must survive the lower settlement').toBe('ACTIVE')
    expect(
      rows.filter((r) => r.status === 'ACTIVE').length,
      'and exactly ONE row may be live — two live rows is the bug this ticket exists for',
    ).toBe(1)

    // The payment is still RECORDED — money that moved is never un-recorded. It simply never became live.
    const [paid] = await sql`SELECT status FROM v2_payment WHERE charge_id = 'C456H'`
    expect(paid.status, 'the stale charge is still marked APPROVED — it really was paid').toBe('APPROVED')
    expect(rows.find((r) => r.tier_code === 'PLUS')?.status, 'and its row exists, born superseded').toBe('REPLACED')

    // 🔴 and the shadow may not be SHORTENED by any of this — the never-burn rule still holds.
    const [mp] = await sql`SELECT expire_at FROM member_payment WHERE user_id = ${u}`
    expect(dateOf(mp.expire_at) >= computeExpireDate(today, 0, { value: 1, unit: 'Y' })).toBe(true)
  })

  // 🔴 #456 ⑧ — ฟีม'S OWN CASE, END TO END. This is the account that opened the ticket: one card and one
  // PromptPay, BOTH PLUS, both settled. Before #456 it produced two live rows and one year of membership
  // for 1,580 บาท. It must now produce ONE live row carrying BOTH spans.
  //
  // It is also the tooth that keeps decideSettlement from over-correcting: the door refuses same-tier
  // repurchase, and it would be easy to make the webhook refuse it too. That would give ฟีม back exactly
  // the bug he reported. This test reddens the moment anyone does that.
  // 🔴 #456 ⑨ — ตู๋'s case C (review r2). LEGACY DATA ONLY: two live rows at different tiers, where the
  // LOWER one expires later and therefore wins the reader's sort. #456 cannot create this state any more
  // (a grant supersedes every live row; a refusal is born REPLACED), so this is about rows already in the
  // database when it ships.
  //
  // The trap: `held` from the picker is PLUS, so a stale PLUS would rank "equal" and be granted — closing
  // the PRO row as REPLACED permanently, which is the one state from which the data could still be
  // repaired. Comparing against the HIGHEST live tier is what stops that.
  it('#456 ⑨ legacy conflict: a stale PLUS must not close a live PRO row that expires sooner', async () => {
    const u = users[2]
    const today = bkk(NOW)
    await seedSub('s456-pro-short', u, 'PRO', addDaysStr(today, 30)) // higher tier, expires SOONER
    await seedSub('s456-plus-long', u, 'PLUS', addDaysStr(today, 100)) // lower tier, wins the reader's sort
    await seedPending('C456N', u, 'MONTHLY', 'PLUS', 50000, '1M', 0)

    const { resolveSubscription } = await import('@/lib/v2/subscription')
    expect((await resolveSubscription(u, NOW)).tier, 'precondition: the reader already answers PLUS').toBe('PLUS')

    await settleAndProvision('C456N')

    const [pro] = await sql`SELECT status FROM member_subscription WHERE id = 's456-pro-short'`
    expect(pro.status, 'the PRO row must NOT be closed by a PLUS payment').toBe('ACTIVE')
    const [fresh] = await sql`SELECT status FROM member_subscription WHERE v2_payment_id = 'v2p-C456N'`
    expect(fresh.status, 'the stale PLUS row is born superseded').toBe('REPLACED')
    // the reader's answer is unchanged — nothing was taken from the user either way
    expect((await resolveSubscription(u, NOW)).tier).toBe('PLUS')
  })

  it('#456 ⑨ b CONTROL — a PRO settling into that same legacy state IS granted and cleans it up', async () => {
    const u = users[3]
    const today = bkk(NOW)
    await seedSub('s456-pro-short2', u, 'PRO', addDaysStr(today, 30))
    await seedSub('s456-plus-long2', u, 'PLUS', addDaysStr(today, 100))
    await seedPending('C456O', u, 'YEARLY-PRO', 'PRO', 129000, '1Y', 0)

    await settleAndProvision('C456O')

    const rows = await sql`SELECT status, tier_code FROM member_subscription WHERE user_id = ${u}`
    expect(rows.filter((r) => r.status === 'ACTIVE').length, 'the conflict is resolved to ONE live row').toBe(1)
    expect(rows.find((r) => r.status === 'ACTIVE')?.tier_code).toBe('PRO')
  })

  it('#456 ⑧ ฟีม case: TWO PLUS charges settle ⇒ ONE live row holding BOTH years, not one year', async () => {
    const u = users[2]
    const today = bkk(NOW)
    await seedPending('C456L', u, 'V2_PLUS_YEARLY', 'PLUS', 79000, '1Y', 0) // the card
    await seedPending('C456M', u, 'V2_PLUS_YEARLY', 'PLUS', 79000, '1Y', 0) // the PromptPay

    await settleAndProvision('C456L')
    await settleAndProvision('C456M')

    const rows = await sql`SELECT status, tier_code, expire_at FROM member_subscription WHERE user_id = ${u}`
    expect(rows.length).toBe(2) // history: one row per payment, both kept
    expect(rows.filter((r) => r.status === 'ACTIVE').length, 'exactly ONE live row').toBe(1)

    const live = rows.find((r) => r.status === 'ACTIVE')
    expect(live?.tier_code).toBe('PLUS')
    // 🔴 THE NUMBER FROM THE TICKET: 790 + 790 must buy TWO years, not one.
    const oneYear = computeExpireDate(today, 0, { value: 1, unit: 'Y' })
    const carried = Math.round((Date.parse(oneYear) - Date.parse(today)) / 86_400_000)
    expect(dateOf(live?.expire_at)).toBe(addDaysStr(oneYear, carried))

    const { resolveSubscription } = await import('@/lib/v2/subscription')
    expect((await resolveSubscription(u, NOW)).tier).toBe('PLUS')
  })

  it('#456 ⑦ b CONTROL — the SAME two charges in the other order still upgrade correctly', async () => {
    const u = users[3]
    await seedPending('C456J', u, 'MONTHLY', 'PLUS', 50000, '1M', 0)
    await seedPending('C456K', u, 'YEARLY-PRO', 'PRO', 129000, '1Y', 0)
    await settleAndProvision('C456J') // PLUS first
    await settleAndProvision('C456K') // then the upgrade
    const { resolveSubscription } = await import('@/lib/v2/subscription')
    expect((await resolveSubscription(u, NOW)).tier).toBe('PRO')
    const rows = await sql`SELECT status FROM member_subscription WHERE user_id = ${u}`
    expect(rows.filter((r) => r.status === 'ACTIVE').length).toBe(1)
  })

  it('#456 ⑥ a LEGACY member (member_payment only, no tier name) may buy, and their days follow', async () => {
    const u = users[3]
    const today = bkk(NOW)
    const legacyExpire = addDaysStr(today, 60)
    await sql`INSERT INTO member_payment (user_id, plan_code, package_code, create_at, start_at, expire_at)
              VALUES (${u}, 'MEMBER', 'LEGACY', ${today + ' 00:00:00'}, ${today}, ${legacyExpire})`
    await seedPending('C456G', u, 'YEARLY-PRO', 'PRO', 129000, '1Y', 0)
    await settleAndProvision('C456G')

    const rows = await sql`SELECT status, tier_code, expire_at FROM member_subscription WHERE user_id = ${u}`
    expect(rows.length).toBe(1)
    expect(rows[0].tier_code).toBe('PRO')
    expect(dateOf(rows[0].expire_at)).toBe(addDaysStr(computeExpireDate(today, 0, { value: 1, unit: 'Y' }), 60))

    // 🔴 And the shadow must not have been shortened either — GREATEST still holds.
    const [mp] = await sql`SELECT expire_at FROM member_payment WHERE user_id = ${u}`
    expect(dateOf(mp.expire_at) >= legacyExpire).toBe(true)
  })
})
