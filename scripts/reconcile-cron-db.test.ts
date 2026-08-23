// #360 — DB half: the reconciler against a REAL postgres, driven through the REAL cron handler.
//   TEST_DATABASE_URL=… DATABASE_URL=… npx vitest run scripts/reconcile-cron-db.test.ts --no-file-parallelism
//
// The gateway is a FAKE (injected through the module mock) — no live charge is ever created or read.
// What is real: the rows, the transaction, the concurrency, and the secret gate.
//
// 🔴 MUTANT CONTRACT:
//   MC1  drop `ne(status,'APPROVED')` from settleAndProvision's predicate → ③ (parallel runs) reddens
//   MC2  treat an unreachable gateway as "not paid" instead of skipping  → ⑤ reddens
//   MC3  the cron stops checking CRON_SECRET                              → ④ reddens
//   MC4  delete the console.warn on the "switched off" branch             → ⑨ reddens
//   MC5  make both branches log ONE identical line that still contains both keywords
//        ("SKIPPED" and "refused a caller")                                → ⑨d reddens ALONE
//        🔑 the keywords must survive, or ④ and ⑨ redden too and the run stops proving that ⑨d
//        catches something they cannot. บอง wrote this contract wrong on the first pass (said
//        ④/⑨ stay green while deleting the very string ④ watches) and only found out by firing it.
//        (MC4/MC5 added by บอง 2026-08-24 after ตู๋ proved M-too-2 and M-too-3 both stayed green:
//         the DoD line "ปิดอยู่แล้วไม่เงียบ" had nothing in the repo watching it.)
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const h = vi.hoisted(() => ({
  paidCharges: new Set<string>(),
  unreachable: new Set<string>(),
  retrieveCalls: [] as string[],
}))
vi.mock('@/lib/payment/omise-gateway', () => ({
  omiseGateway: {
    async retrieveCharge(chargeId: string) {
      h.retrieveCalls.push(chargeId)
      if (h.unreachable.has(chargeId)) throw new Error('omise unreachable')
      if (!h.paidCharges.has(chargeId)) return null
      return { chargeId, paid: true, status: 'successful' }
    },
  },
}))

import cronHandler from '@/pages/api/cron/reconcile-payment'

const TEST_URL = process.env.TEST_DATABASE_URL
const M0006 = readFileSync(resolve('lib/db/0006_member_subscription.sql'), 'utf8')
const M0007 = readFileSync(resolve('lib/db/0007_v2_payment.sql'), 'utf8')
const M0008 = readFileSync(resolve('lib/db/0008_discount_code.sql'), 'utf8')
const SECRET = 'cron-secret-360'

function callCron(auth?: string) {
  const out: { code?: number; body?: any } = {}
  const res = {
    status(c: number) { out.code = c; return this },
    json(b: unknown) { out.body = b; return this },
  }
  return (cronHandler({ method: 'GET', headers: { authorization: auth } } as never, res as never) as Promise<void>)
    .then(() => out)
}

describe.skipIf(!TEST_URL)('#360 reconcile cron · real pg', () => {
  let sql: ReturnType<typeof postgres>
  let users: string[]

  beforeAll(async () => {
    process.env.CRON_SECRET = SECRET
    sql = postgres(TEST_URL as string, { max: 6, ssl: false })
    await sql.unsafe(M0006)
    await sql.unsafe('ALTER TABLE member_subscription DROP COLUMN IF EXISTS v2_payment_id;')
    await sql.unsafe('DROP TABLE IF EXISTS v2_payment CASCADE;')
    await sql.unsafe(M0007)
    await sql.unsafe(M0008)
    const rows = await sql`SELECT user_id FROM "user" WHERE user_id NOT IN (SELECT user_id FROM member_payment) LIMIT 4`
    users = rows.map((r) => r.user_id as string)
    expect(users.length, 'fixture: need 4 member_payment-free users').toBeGreaterThan(3)
  })
  afterAll(async () => {
    if (!sql) return
    await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
    await sql.unsafe('DELETE FROM v2_payment;')
    await sql`DELETE FROM member_payment WHERE user_id = ANY(${users})`
    await sql.end()
  })
  afterEach(async () => {
    await sql`DELETE FROM member_subscription WHERE user_id = ANY(${users})`
    await sql.unsafe('DELETE FROM v2_payment;')
    await sql`DELETE FROM member_payment WHERE user_id = ANY(${users})`
    h.paidCharges = new Set()
    h.unreachable = new Set()
    h.retrieveCalls = []
  })

  // created_at is set explicitly: the grace window is part of the rule, so the fixture has to be able to
  // place a row on either side of it.
  const seed = (id: string, chargeId: string, userId: string, status = 'PENDING', ageMs = 60 * 60_000) =>
    sql`INSERT INTO v2_payment (id, user_id, package_code, tier_code, amount_satang, vat_satang, expire, buffer_day, method, charge_id, order_id, status, created_at)
        VALUES (${id}, ${userId}, 'MONTHLY', 'PLUS', 50000, 0, '1M', 0, 'card', ${chargeId}, ${'ORD-' + id}, ${status},
                now() - ${ageMs + ' milliseconds'}::interval)`

  it('🔴 ① a paid charge whose webhook never arrived is granted on the next run', async () => {
    await seed('r360-a', 'chrg_a', users[0])
    h.paidCharges.add('chrg_a')

    const out = await callCron(`Bearer ${SECRET}`)
    expect(out.code).toBe(200)
    expect(out.body.provisioned).toBe(1)

    const [pay] = await sql`SELECT status FROM v2_payment WHERE id = 'r360-a'`
    expect(pay.status).toBe('APPROVED')
    expect((await sql`SELECT id FROM member_subscription WHERE user_id = ${users[0]}`).length).toBe(1)
  })

  it('② a charge the gateway says is NOT paid is left exactly as it was', async () => {
    await seed('r360-b', 'chrg_b', users[1]) // not in paidCharges → retrieve returns null
    const out = await callCron(`Bearer ${SECRET}`)
    expect(out.body.provisioned).toBe(0)
    const [pay] = await sql`SELECT status FROM v2_payment WHERE id = 'r360-b'`
    expect(pay.status).toBe('PENDING') // still reconcilable next run — not marked, not rejected
    expect((await sql`SELECT id FROM member_subscription WHERE user_id = ${users[1]}`).length).toBe(0)
  })

  // ③ 🔴 THE DoD LINE: two runs at once must grant once. No claim phase exists — the DB predicate is the
  // arbiter, the same one that keeps duplicate webhooks at-most-once.
  it('🔴 ③ two runs in PARALLEL grant exactly one membership', async () => {
    await seed('r360-c', 'chrg_c', users[2])
    h.paidCharges.add('chrg_c')

    const [r1, r2] = await Promise.all([callCron(`Bearer ${SECRET}`), callCron(`Bearer ${SECRET}`)])
    expect(r1.code).toBe(200)
    expect(r2.code).toBe(200)
    // exactly one run may claim it; the other sees the row already APPROVED and reports 0
    expect(r1.body.provisioned + r2.body.provisioned).toBe(1)
    expect((await sql`SELECT id FROM member_subscription WHERE user_id = ${users[2]}`).length).toBe(1)
  })

  it('🔴 ④ the secret gate: no header → 401 · wrong secret → 401 · and nothing is read from the gateway', async () => {
    await seed('r360-d', 'chrg_d', users[0])
    h.paidCharges.add('chrg_d')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect((await callCron(undefined)).code).toBe(401)
      expect((await callCron('Bearer nope')).code).toBe(401)
      // #409 DoD "ปิดอยู่แล้วไม่เงียบ": a refused caller must leave a line behind. Somebody is knocking on a
      // public endpoint that grants memberships — silence here is how that goes unnoticed.
      expect(warn.mock.calls.flat().join(' ')).toMatch(/refused a caller/)
    } finally {
      warn.mockRestore()
    }
    expect(h.retrieveCalls.length, 'an unauthorized call must not even reach the gateway').toBe(0)
    const [pay] = await sql`SELECT status FROM v2_payment WHERE id = 'r360-d'`
    expect(pay.status).toBe('PENDING')
  })

  it('🔴 ⑤ an UNREACHABLE gateway is not read as "not paid" — the row survives for the next run', async () => {
    await seed('r360-e', 'chrg_e', users[3])
    h.unreachable.add('chrg_e')

    const out = await callCron(`Bearer ${SECRET}`)
    expect(out.body.unreachable).toBe(1)
    expect(out.body.provisioned).toBe(0)
    const [pay] = await sql`SELECT status FROM v2_payment WHERE id = 'r360-e'`
    expect(pay.status).toBe('PENDING') // untouched — the next run asks again

    // and once the gateway comes back, the same row is recovered
    h.unreachable = new Set()
    h.paidCharges.add('chrg_e')
    const second = await callCron(`Bearer ${SECRET}`)
    expect(second.body.provisioned).toBe(1)
  })

  it('⑥ a row still on its placeholder is never touched by this cron (that is #371 territory)', async () => {
    await seed('r360-f', 'pending:r360-f', users[0])
    const out = await callCron(`Bearer ${SECRET}`)
    expect(out.body.considered).toBe(0)
    expect(h.retrieveCalls.length, 'the gateway must not be asked about a charge id we invented').toBe(0)
  })

  it('⑦ a row younger than the grace period is left for the webhook to win normally', async () => {
    await seed('r360-g', 'chrg_g', users[1], 'PENDING', 60_000) // one minute old
    h.paidCharges.add('chrg_g')
    const out = await callCron(`Bearer ${SECRET}`)
    expect(out.body.considered).toBe(0)
    expect((await sql`SELECT status FROM v2_payment WHERE id = 'r360-g'`)[0].status).toBe('PENDING')
  })

  it('⑧ an already-APPROVED row makes the run a no-op (no second subscription, no gateway call)', async () => {
    await seed('r360-h', 'chrg_h', users[2], 'APPROVED')
    h.paidCharges.add('chrg_h')
    const out = await callCron(`Bearer ${SECRET}`)
    expect(out.body.considered).toBe(0)
    expect(h.retrieveCalls.length).toBe(0)
    expect((await sql`SELECT id FROM member_subscription WHERE user_id = ${users[2]}`).length).toBe(0)
  })

  // ⑨ 🔴 #409 — the kill switch, proven on the REAL handler with a REAL database behind it.
  // The pure rule has its own teeth (scripts/reconcile-flag.test.ts); what this pins is that the switch is
  // actually WIRED and sits in the right place: nothing is read, nothing is asked of the gateway, and above
  // all nobody is granted anything while it is off.
  // 🔴 MUTANT: delete the `isReconcileEnabled` guard in the handler → ⑨ reddens.
  // The case that stays GREEN and so tells you the job itself is alive is ⑨c, NOT ⑨b:
  // ⑨b sets the flag to 'off' on its own first line, so removing the guard reddens it too.
  // (ตู๋ fired the mutant and proved it 2026-08-23; the comment used to name ⑨b and was simply wrong.)
  it('🔴 ⑨ switched off → grants nothing, asks the gateway nothing, and says so', async () => {
    const prev = process.env.RECONCILE_ENABLED
    await seed('r360-i', 'chrg_i', users[0])
    h.paidCharges.add('chrg_i')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      process.env.RECONCILE_ENABLED = 'off'
      const out = await callCron(`Bearer ${SECRET}`)
      expect(out.code).toBe(200) // being off is not a failure — an error would make Vercel retry it
      expect(out.body.skipped).toBe('disabled')
      // #409 DoD "ปิดอยู่แล้วไม่เงียบ". The symptom of a silently-off reconciler is "nothing happens",
      // which nobody notices until somebody goes looking. The line is the only thing that says otherwise.
      expect(warn.mock.calls.flat().join(' ')).toMatch(/SKIPPED/)
      expect(out.body.provisioned).toBe(0)
      expect(h.retrieveCalls.length, 'a disabled run must not touch the gateway at all').toBe(0)
      const [pay] = await sql`SELECT status FROM v2_payment WHERE id = 'r360-i'`
      expect(pay.status).toBe('PENDING') // untouched, and still recoverable the moment it is switched on
      expect((await sql`SELECT id FROM member_subscription WHERE user_id = ${users[0]}`).length).toBe(0)
    } finally {
      warn.mockRestore()
      if (prev === undefined) delete process.env.RECONCILE_ENABLED
      else process.env.RECONCILE_ENABLED = prev
    }
  })

  // ⑨b CONTROL — the same row, the same charge, switch back on. Without this, ⑨ would also pass if the
  // reconciler were broken outright, which is the boring way a negative test goes green.
  it('⑨ b control: switched back on → the same payment IS recovered', async () => {
    const prev = process.env.RECONCILE_ENABLED
    await seed('r360-j', 'chrg_j', users[1])
    h.paidCharges.add('chrg_j')
    try {
      process.env.RECONCILE_ENABLED = 'off'
      expect((await callCron(`Bearer ${SECRET}`)).body.provisioned).toBe(0)

      process.env.RECONCILE_ENABLED = 'on'
      const out = await callCron(`Bearer ${SECRET}`)
      expect(out.body.skipped).toBeUndefined()
      expect(out.body.provisioned).toBe(1)
      expect((await sql`SELECT id FROM member_subscription WHERE user_id = ${users[1]}`).length).toBe(1)
    } finally {
      if (prev === undefined) delete process.env.RECONCILE_ENABLED
      else process.env.RECONCILE_ENABLED = prev
    }
  })

  it('⑨ c unset behaves exactly like on (the default keeps repairing)', async () => {
    const prev = process.env.RECONCILE_ENABLED
    await seed('r360-k', 'chrg_k', users[2])
    h.paidCharges.add('chrg_k')
    try {
      delete process.env.RECONCILE_ENABLED
      const out = await callCron(`Bearer ${SECRET}`)
      expect(out.body.skipped).toBeUndefined()
      expect(out.body.provisioned).toBe(1)
    } finally {
      if (prev === undefined) delete process.env.RECONCILE_ENABLED
      else process.env.RECONCILE_ENABLED = prev
    }
  })

  // ⑨d — the two refusals must not share a line. The handler comment says so; nothing enforced it.
  // Both paths answer "the job did nothing", and the reason is the ONLY thing that separates
  //   "somebody is probing a public endpoint that grants memberships"   from   "we turned it off".
  // Collapse them and the first hides inside the second on exactly the day it matters.
  // 🔴 MUTANT MC5: collapse both branches onto ONE identical line that still contains "SKIPPED" and
  //    "refused a caller" → ④ green · ⑨ green · THIS case red, alone. Fired 2026-08-24, all three
  //    verified one at a time. That is the whole argument for this case existing: a per-branch
  //    assertion can only see its own line, never that two lines became the same line.
  it('🔴 ⑨ d a refused caller and a switched-off job never log the same line', async () => {
    const prev = process.env.RECONCILE_ENABLED
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // path 1 — refused caller (the flag is irrelevant here; the secret gate runs first)
      warn.mockClear()
      await callCron('Bearer nope')
      const refused = warn.mock.calls.flat().join(' ')

      // path 2 — switched off, with a VALID secret
      warn.mockClear()
      process.env.RECONCILE_ENABLED = 'off'
      await callCron(`Bearer ${SECRET}`)
      const disabled = warn.mock.calls.flat().join(' ')

      expect(refused, 'a refused caller must log something').not.toBe('')
      expect(disabled, 'a switched-off run must log something').not.toBe('')
      expect(disabled, 'the two refusals must be distinguishable in the log').not.toBe(refused)
    } finally {
      warn.mockRestore()
      if (prev === undefined) delete process.env.RECONCILE_ENABLED
      else process.env.RECONCILE_ENABLED = prev
    }
  })
})
