// Beam lane slices 2–3 — the MONEY PATH through the Beam door against a REAL postgres: a signed Beam
// delivery → /api/v2/payment/webhook-beam → the shared dispatcher → settle / revoke, and the reconciler
// asking Beam (fetch stubbed) about a Beam row. Like every db suite it is `describe.skipIf(!TEST_DATABASE_URL)`
// and does not run in the pre-push lane; run it against the testenv pg, ONE FILE AT A TIME (the suites
// rebuild v2_payment and race each other when run together):
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/beam-webhook-db.test.ts
//
// These are the slice-2 acceptance cases the plan names that CAN be proven without Playground: duplicate
// delivery, charge.failed after charge.succeeded, charge.succeeded after our own expiry-abandon, the
// reconciler settling a Beam SUCCEEDED row whose webhook never arrived, a full refund revoking and a
// smaller one changing nothing. The Playground run (beam-smoke.ts + Force Charge) adds only the fact that
// Beam itself sends these shapes.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import postgres from 'postgres'
import { signBeamPayload } from '@/lib/payment/beam-webhook-verify'
import webhookHandler from '@/pages/api/v2/payment/webhook-beam'
import cronHandler from '@/pages/api/cron/reconcile-payment'

const TEST_URL = process.env.TEST_DATABASE_URL
const M = (f: string) => readFileSync(resolve('lib/db', f), 'utf8')
const M0006 = M('0006_member_subscription.sql')
const M0007 = M('0007_v2_payment.sql')
const M0008 = M('0008_discount_code.sql')
const M0010 = M('0010_v2_payment_failure.sql')
const M0011 = M('0011_v2_payment_qr_expiry.sql')
const M0012 = M('0012_v2_payment_prev_member_expire.sql')
const M0019 = M('0019_v2_payment_qi_granted_at.sql')
const M0027 = M('0027_v2_payment_gateway.sql')

const HMAC = Buffer.from('beam-db-suite-hmac-key-32-bytes!!').toString('base64')
const CRON = 'cron-secret-beam'

function fire(raw: Buffer, event: string) {
  const req = Readable.from([raw]) as unknown as { method: string; headers: Record<string, string> }
  req.method = 'POST'
  req.headers = { 'x-beam-signature': signBeamPayload(raw, HMAC), 'x-beam-event': event }
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
function callCron() {
  const out: { code?: number; body?: any } = {}
  const res = {
    status(c: number) {
      out.code = c
      return this
    },
    json(b: unknown) {
      out.body = b
      return this
    },
  }
  return (cronHandler({ method: 'GET', headers: { authorization: `Bearer ${CRON}` } } as never, res as never) as Promise<void>).then(() => out)
}
const charge = (chargeId: string, orderId: string, status: 'SUCCEEDED' | 'FAILED' | 'PENDING', failureCode = '') =>
  Buffer.from(JSON.stringify({ chargeId, merchantId: 'm_x', referenceId: orderId, status, currency: 'THB', amount: 50000, failureCode, source: 'API' }), 'utf8')
const refund = (chargeId: string, orderId: string, amount: number, status: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED') =>
  Buffer.from(JSON.stringify({ refundId: 're_' + chargeId, chargeId, merchantId: 'm_x', referenceId: orderId, amount, currency: 'THB', status, failureCode: '' }), 'utf8')

describe.skipIf(!TEST_URL)('Beam webhook + reconciler · real pg', () => {
  let sql: ReturnType<typeof postgres>
  let users: string[]

  beforeAll(async () => {
    process.env.BEAM_WEBHOOK_HMAC_KEY = HMAC
    process.env.CRON_SECRET = CRON
    delete process.env.RECONCILE_ENABLED
    delete process.env.QI_GRANT_SECRET // the QI repair pass answers "unrecorded" without a secret; not under test here
    sql = postgres(TEST_URL as string, { max: 6, ssl: false })
    await sql.unsafe(M0006)
    await sql.unsafe('ALTER TABLE member_subscription DROP COLUMN IF EXISTS v2_payment_id;')
    await sql.unsafe('DROP TABLE IF EXISTS v2_payment CASCADE;')
    await sql.unsafe(M0007)
    await sql.unsafe(M0008)
    await sql.unsafe(M0010)
    await sql.unsafe(M0011)
    await sql.unsafe(M0012)
    await sql.unsafe(M0019)
    await sql.unsafe(M0027)
    const rows = await sql`SELECT user_id FROM "user" WHERE user_id NOT IN (SELECT user_id FROM member_payment) LIMIT 4`
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
    vi.unstubAllGlobals()
    await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
    await sql.unsafe('DELETE FROM v2_payment;')
    await sql`DELETE FROM member_payment WHERE user_id = ANY(${users})`
  })

  const seed = (chargeId: string, userId: string, status = 'PENDING', ageMin = 60, failureCode: string | null = null) =>
    sql`INSERT INTO v2_payment (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status, gateway, failure_code, created_at)
        VALUES (${'v2p-' + chargeId}, ${userId}, 'MONTHLY', 'PLUS', 50000, 0, '1M', 0, 'promptpay', ${chargeId}, ${'ord-' + chargeId}, ${status}, 'beam', ${failureCode}, now() - ${ageMin + ' minutes'}::interval)`
  const row = async (chargeId: string) => (await sql`SELECT status, failure_code, gateway FROM v2_payment WHERE charge_id = ${chargeId}`)[0]
  const subs = async (userId: string) => (await sql`SELECT id, status FROM member_subscription WHERE user_id = ${userId}`).length

  it('🔴 ① a signed charge.succeeded on a Beam row → 200, APPROVED, one member_subscription', async () => {
    await seed('ch_a', users[0])
    const out = await fire(charge('ch_a', 'ord-ch_a', 'SUCCEEDED'), 'charge.succeeded')
    expect(out.status).toBe(200)
    expect(await row('ch_a')).toMatchObject({ status: 'APPROVED', gateway: 'beam' })
    expect(await subs(users[0])).toBe(1)
  })

  it('🔴 ② a duplicate delivery (Beam promises duplicates) provisions exactly once', async () => {
    await seed('ch_b', users[1])
    const body = charge('ch_b', 'ord-ch_b', 'SUCCEEDED')
    await fire(body, 'charge.succeeded')
    const again = await fire(body, 'charge.succeeded')
    expect(again.status).toBe(200)
    expect(await subs(users[1])).toBe(1)
  })

  it('🔴 ③ charge.failed arriving AFTER charge.succeeded (out of order) changes nothing — APPROVED stays', async () => {
    await seed('ch_c', users[2])
    await fire(charge('ch_c', 'ord-ch_c', 'SUCCEEDED'), 'charge.succeeded')
    const out = await fire(charge('ch_c', 'ord-ch_c', 'FAILED', 'CH_PROCESSING_FAILED'), 'charge.failed')
    expect(out.status).toBe(200)
    expect(await row('ch_c')).toMatchObject({ status: 'APPROVED' })
    expect(await subs(users[2])).toBe(1)
  })

  it('🔴 ④ charge.succeeded arriving after OUR expiry-abandon (row REJECT gateway_expired) still settles — the customer paid', async () => {
    // Beam calls its QR expiry best-effort and a charge "can stay PENDING indefinitely": a late payment is
    // possible. Money moved ⇒ the buyer gets what they bought; settleAndProvision's predicate is
    // status <> 'APPROVED', so a REJECT row is eligible. This pins that choice so nobody is surprised by it.
    await seed('ch_d', users[3], 'REJECT', 60, 'gateway_expired')
    const out = await fire(charge('ch_d', 'ord-ch_d', 'SUCCEEDED'), 'charge.succeeded')
    expect(out.status).toBe(200)
    expect(await row('ch_d')).toMatchObject({ status: 'APPROVED' })
    expect(await subs(users[3])).toBe(1)
  })

  it('⑤ charge.failed on a PENDING row → REJECT (hold released), no subscription', async () => {
    await seed('ch_e', users[0])
    const out = await fire(charge('ch_e', 'ord-ch_e', 'FAILED', 'CH_INSUFFICIENT_FUNDS'), 'charge.failed')
    expect(out.status).toBe(200)
    expect(await row('ch_e')).toMatchObject({ status: 'REJECT' })
    expect(await subs(users[0])).toBe(0)
  })

  it('🔴 ⑥ a FULL refund.succeeded revokes (failure_code gateway_reversed); a smaller one changes nothing', async () => {
    await seed('ch_f', users[1])
    await fire(charge('ch_f', 'ord-ch_f', 'SUCCEEDED'), 'charge.succeeded')
    expect(await subs(users[1])).toBe(1)

    const partial = await fire(refund('ch_f', 'ord-ch_f', 100), 'refund.succeeded')
    expect(partial.status).toBe(200)
    expect(await row('ch_f')).toMatchObject({ status: 'APPROVED', failure_code: null })

    const full = await fire(refund('ch_f', 'ord-ch_f', 50000), 'refund.succeeded')
    expect(full.status).toBe(200)
    expect(await row('ch_f')).toMatchObject({ status: 'APPROVED', failure_code: 'gateway_reversed' })
    const [sub] = await sql`SELECT status FROM member_subscription WHERE user_id = ${users[1]}`
    expect(sub.status).not.toBe('ACTIVE')
  })

  it('⑦ refund.failed revokes nothing', async () => {
    await seed('ch_g', users[2])
    await fire(charge('ch_g', 'ord-ch_g', 'SUCCEEDED'), 'charge.succeeded')
    const out = await fire(refund('ch_g', 'ord-ch_g', 50000, 'FAILED'), 'refund.failed')
    expect(out.status).toBe(200)
    expect(await row('ch_g')).toMatchObject({ status: 'APPROVED', failure_code: null })
  })

  it('🔴 ⑧ the reconciler asks BEAM (not Omise) about a Beam row whose webhook never came, and settles it', async () => {
    await seed('ch_h', users[3]) // 60 minutes old: past the 15-minute grace
    process.env.BEAM_MERCHANT_ID = 'm_test'
    process.env.BEAM_API_KEY = 'k_test'
    process.env.BEAM_API_BASE = 'https://playground.api.beamcheckout.com'
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.endsWith('/api/v1/charges/ch_h')) {
          return new Response(JSON.stringify({ chargeId: 'ch_h', status: 'SUCCEEDED', referenceId: 'ord-ch_h', failureCode: '' }), { status: 200 })
        }
        return new Response(JSON.stringify({ error: { errorCode: 'NOT_FOUND_ERROR' } }), { status: 404 })
      }),
    )
    const out = await callCron()
    expect(out.code).toBe(200)
    expect(urls).toEqual(['https://playground.api.beamcheckout.com/api/v1/charges/ch_h'])
    expect(out.body.provisioned).toBe(1)
    expect(await row('ch_h')).toMatchObject({ status: 'APPROVED' })
    expect(await subs(users[3])).toBe(1)
  })

  it('⑨ the reconciler abandons a Beam row Beam says FAILED, with Beam’s own reason', async () => {
    await seed('ch_i', users[0])
    process.env.BEAM_MERCHANT_ID = 'm_test'
    process.env.BEAM_API_KEY = 'k_test'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ chargeId: 'ch_i', status: 'FAILED', failureCode: 'CH_CARD_DECLINED' }), { status: 200 })))
    const out = await callCron()
    expect(out.body.abandoned).toBe(1)
    expect(await row('ch_i')).toMatchObject({ status: 'REJECT', failure_code: 'CH_CARD_DECLINED' })
  })

  it('⑩ Beam answering PENDING leaves the row alone for the next run', async () => {
    await seed('ch_j', users[1])
    process.env.BEAM_MERCHANT_ID = 'm_test'
    process.env.BEAM_API_KEY = 'k_test'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ chargeId: 'ch_j', status: 'PENDING', failureCode: '' }), { status: 200 })))
    const out = await callCron()
    expect(out.body).toMatchObject({ provisioned: 0, abandoned: 0 })
    expect(await row('ch_j')).toMatchObject({ status: 'PENDING' })
  })

  // ── slice 3 · Payment Links: the row holds link:<id> until Beam mints the charge ──
  const seedLink = (linkId: string, userId: string, status = 'PENDING', ageMin = 60) =>
    sql`INSERT INTO v2_payment (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status, gateway, created_at)
        VALUES (${'v2p-' + linkId}, ${userId}, 'MONTHLY', 'PLUS', 50000, 0, '1M', 0, 'card', ${'link:' + linkId}, ${'ord-' + linkId}, ${status}, 'beam', now() - ${ageMin + ' minutes'}::interval)`
  const rowById = async (id: string) => (await sql`SELECT status, charge_id, failure_code FROM v2_payment WHERE id = ${id}`)[0]

  it('🔴 ⑪ webhook: charge.succeeded (source PAYMENT_LINK, referenceId = our order) REBINDS the link row to ch_ and settles', async () => {
    await seedLink('L1', users[0])
    const body = Buffer.from(JSON.stringify({ chargeId: 'ch_L1', referenceId: 'ord-L1', status: 'SUCCEEDED', source: 'PAYMENT_LINK', sourceId: 'L1', amount: 50000, currency: 'THB', failureCode: '' }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await fire(body, 'charge.succeeded')
    warn.mockRestore()
    expect(out.status).toBe(200)
    expect(await rowById('v2p-L1')).toMatchObject({ status: 'APPROVED', charge_id: 'ch_L1' })
    expect(await subs(users[0])).toBe(1)
  })

  it('⑫ payment_link.paid itself changes nothing (the charge event is the settling one) — 200, row untouched', async () => {
    await seedLink('L2', users[1])
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const out = await fire(Buffer.from(JSON.stringify({ paymentLinkId: 'L2', status: 'PAID', order: { referenceId: 'ord-L2', netAmount: 50000 } })), 'payment_link.paid')
    info.mockRestore()
    expect(out.status).toBe(200)
    expect(await rowById('v2p-L2')).toMatchObject({ status: 'PENDING', charge_id: 'link:L2' })
  })

  it('🔴 ⑬ a refund on a link-originated charge revokes, because the row was rebound to ch_ (not left as link:)', async () => {
    await seedLink('L3', users[2])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await fire(Buffer.from(JSON.stringify({ chargeId: 'ch_L3', referenceId: 'ord-L3', status: 'SUCCEEDED', source: 'PAYMENT_LINK', amount: 50000 })), 'charge.succeeded')
    const out = await fire(refund('ch_L3', 'ord-L3', 50000), 'refund.succeeded')
    warn.mockRestore()
    expect(out.status).toBe(200)
    expect(await rowById('v2p-L3')).toMatchObject({ status: 'APPROVED', charge_id: 'ch_L3', failure_code: 'gateway_reversed' })
  })

  it('🔴 ⑭ reconciler: link PAID ⇒ asks Beam for the charge, REBINDS, settles (webhook never came)', async () => {
    await seedLink('L4', users[3])
    process.env.BEAM_MERCHANT_ID = 'm_test'
    process.env.BEAM_API_KEY = 'k_test'
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.includes('/api/v1/payment-links/L4')) return new Response(JSON.stringify({ id: 'L4', status: 'PAID' }), { status: 200 })
        if (url.includes('source_in=PAYMENT_LINK&sourceId=L4')) return new Response(JSON.stringify({ data: [{ chargeId: 'ch_L4', status: 'SUCCEEDED' }], totalCount: 1 }), { status: 200 })
        return new Response('{}', { status: 404 })
      }),
    )
    const out = await callCron()
    expect(out.body.provisioned).toBe(1)
    expect(await rowById('v2p-L4')).toMatchObject({ status: 'APPROVED', charge_id: 'ch_L4' })
    expect(await subs(users[3])).toBe(1)
  })

  it('⑮ reconciler: link EXPIRED ⇒ REJECT gateway_expired (nobody paid the hosted page)', async () => {
    await seedLink('L5', users[0])
    process.env.BEAM_MERCHANT_ID = 'm_test'
    process.env.BEAM_API_KEY = 'k_test'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'L5', status: 'EXPIRED' }), { status: 200 })))
    const out = await callCron()
    expect(out.body.abandoned).toBe(1)
    expect(await rowById('v2p-L5')).toMatchObject({ status: 'REJECT', failure_code: 'gateway_expired', charge_id: 'link:L5' })
  })

  it('⑯ recovery guard intact: a row bound to a REAL charge is never adopted by another charge’s success (AMBIGUOUS)', async () => {
    await seed('ch_real', users[1]) // bound to ch_real
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await fire(Buffer.from(JSON.stringify({ chargeId: 'ch_other', referenceId: 'ord-ch_real', status: 'SUCCEEDED', amount: 50000 })), 'charge.succeeded')
    err.mockRestore()
    expect(out.status).toBe(200)
    expect(await row('ch_real')).toMatchObject({ status: 'PENDING' })
    expect(await subs(users[1])).toBe(0)
  })
})
