// Real application settlement, synthetic rows only. Never point this at a restored database.
// Gateway and QI engine transport are mocked; this does not prove the engine's ledger implementation.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { randomUUID } from 'node:crypto'
import { createResilientSql } from '../lib/db/resilient-sql'
import * as schema from '../lib/db/schema'
import { stallProxy } from './db-stall-proxy'

const h = vi.hoisted(() => ({ db: null as any, grants: [] as string[], credited: new Set<string>() }))
vi.mock('@/lib/db', () => ({ db: new Proxy({}, {
  get: (_target, key) => {
    const value = h.db?.[key]
    return typeof value === 'function' ? value.bind(h.db) : value
  },
}) }))
vi.mock('@/lib/qi/grant', () => ({
  grantQiPurchase: async (ref: { chargeId: string }) => {
    h.grants.push(ref.chargeId)
    h.credited.add(ref.chargeId)
    return true
  },
  fireReferralUpgradeTrigger: async () => {},
}))
import { settleAndProvision, listUnsettledPayments, listUngrantedQiPurchases, markQiGranted } from '../lib/payment/repo'
import { runReconcile } from '../lib/payment/reconcile-run'
import { runQiGrantRetry } from '../lib/payment/reconcile-qi'

const testUrl = process.env.DB_STALL_TEST_DATABASE_URL
if (process.env.DB_STALL_REQUIRE_DB === '1' && !testUrl) throw new Error('DB_STALL_TEST_DATABASE_URL is required')
const namespace = `money_proof_${randomUUID().replaceAll('-', '')}`
let direct: ReturnType<typeof postgres>
let guarded: ReturnType<typeof postgres>
const now = new Date('2026-11-16T11:00:00Z')

describe.skipIf(!testUrl)('DB stall money boundary · disposable synthetic PostgreSQL', () => {
  beforeAll(async () => {
    const target = new URL(testUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || target.pathname !== '/stall_proof') {
      throw new Error('Money proof requires loopback /stall_proof; production and restored staging are refused')
    }
    direct = postgres(testUrl!, { ssl: false, max: 2, prepare: false })
    await direct.unsafe(`CREATE SCHEMA "${namespace}"`)
    // Three deliberately synthetic application tables. No customer tables, migration, or cleanup SQL.
    await direct.unsafe(`CREATE TABLE "${namespace}".v2_payment (
      id varchar(36) PRIMARY KEY, user_id text NOT NULL, package_code text NOT NULL,
      tier_code text NOT NULL, amount_satang integer NOT NULL, vat_satang integer NOT NULL DEFAULT 0,
      expire text NOT NULL, buffer_day integer NOT NULL DEFAULT 0, method text NOT NULL,
      charge_id text NOT NULL UNIQUE, order_id text NOT NULL, status text NOT NULL,
      failure_code text, failure_message text, charge_expires_at timestamptz,
      prev_member_expire_at text, qi_granted_at timestamptz, gateway text NOT NULL DEFAULT 'omise',
      code_id varchar(36), discount_satang integer NOT NULL DEFAULT 0, quote_id varchar(36),
      created_at timestamptz NOT NULL DEFAULT now())`)
    await direct.unsafe(`CREATE TABLE "${namespace}".member_subscription (
      id varchar(36) PRIMARY KEY, user_id text NOT NULL, tier_code text NOT NULL,
      package_code text NOT NULL, amount_satang integer NOT NULL, start_at date NOT NULL,
      expire_at date NOT NULL, payment_id text, v2_payment_id varchar(36), status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await direct.unsafe(`CREATE TABLE "${namespace}".member_payment (
      user_id varchar(255) PRIMARY KEY, plan_code text NOT NULL, package_code text NOT NULL,
      create_at varchar(255) NOT NULL, start_at varchar(255) NOT NULL, expire_at varchar(255) NOT NULL)`)
    guarded = createResilientSql(() => postgres(testUrl!, {
      ssl: false, max: 5, prepare: false, connection: { search_path: namespace },
    }), { queryTimeoutMs: 1000, transactionTimeoutMs: 3000, log: () => {} })
    h.db = drizzle(guarded, { schema })
    // Any accidental network gateway invocation is a failed proof, never an external side effect.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('external network forbidden in money proof'))))
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await guarded?.end({ timeout: 0 })
    await direct?.end({ timeout: 0 })
  })

  async function payment(tier: 'PLUS' | 'QI') {
    const id = randomUUID()
    const chargeId = `proof_${id}`
    const userId = `synthetic_${id}`
    await h.db.insert(schema.v2Payment).values({
      id, userId, chargeId, orderId: id, tierCode: tier, packageCode: tier === 'QI' ? 'QI_100' : 'MONTHLY',
      amountSatang: 10000, expire: '1M', method: 'promptpay', status: 'PENDING',
      createdAt: new Date(now.getTime() - 60 * 60 * 1000),
    })
    return { id, chargeId, userId }
  }

  it('concurrent webhook settlement and reconciler grant one membership and one shadow', async () => {
    const p = await payment('PLUS')
    const outcomes = await Promise.all([
      settleAndProvision(p.chargeId, null, now, h.db),
      runReconcile({
        listUnsettled: since => listUnsettledPayments(since, h.db),
        retrieveCharge: async chargeId => ({ chargeId, paid: true, status: 'successful' }),
        settle: chargeId => settleAndProvision(chargeId, null, now, h.db),
        abandon: async () => { throw new Error('paid charge must never be abandoned') },
      }, now),
    ])
    expect(outcomes.reduce((n, x) => n + Number(x.provisioned), 0)).toBe(1)
    expect(await settleAndProvision(p.chargeId, null, now, h.db)).toEqual({ provisioned: false, outcome: 'ALREADY' })
    const subscriptions = await direct.unsafe(`SELECT count(*)::int AS n FROM "${namespace}".member_subscription WHERE user_id = $1`, [p.userId])
    const shadow = await direct.unsafe(`SELECT count(*)::int AS n FROM "${namespace}".member_payment WHERE user_id = $1`, [p.userId])
    expect(subscriptions[0].n).toBe(1)
    expect(shadow[0].n).toBe(1)
  })

  it('concurrent QI settlements call the engine once, mark confirmation, and create no membership', async () => {
    const p = await payment('QI')
    const results = await Promise.all(Array.from({ length: 4 }, () => settleAndProvision(p.chargeId, null, now, h.db)))
    expect(results.filter(r => r.provisioned)).toHaveLength(1)
    expect(h.grants.filter(id => id === p.chargeId)).toHaveLength(1)
    expect((await listUngrantedQiPurchases(h.db)).some(purchase => purchase.chargeId === p.chargeId)).toBe(false)
    const memberships = await direct.unsafe(`SELECT count(*)::int AS n FROM "${namespace}".member_subscription WHERE user_id = $1`, [p.userId])
    expect(memberships[0].n).toBe(0)
  })

  it('lost QI COMMIT response is not replayed; approved goods remain repairable', async () => {
    const p = await payment('QI')
    const proxy = stallProxy(new URL(testUrl!))
    const port = await proxy.listen()
    const proxyUrl = new URL(testUrl!)
    proxyUrl.hostname = '127.0.0.1'
    proxyUrl.port = String(port)
    const faulted = createResilientSql(() => postgres(proxyUrl.toString(), {
      ssl: false, max: 1, prepare: false, connection: { search_path: namespace },
    }), { queryTimeoutMs: 500, transactionTimeoutMs: 1000, log: () => {} })
    try {
      await faulted.unsafe('SELECT 1')
      proxy.loseCommitResponse()
      const db = drizzle(faulted, { schema })
      await expect(settleAndProvision(p.chargeId, null, now, db as typeof h.db)).rejects.toMatchObject({ code: 'DB_STALL', outcome: 'unknown' })
      expect(proxy.commitsObserved()).toBe(1)
      const rows = await direct.unsafe(`SELECT status, qi_granted_at FROM "${namespace}".v2_payment WHERE charge_id = $1`, [p.chargeId])
      expect(rows[0]).toMatchObject({ status: 'APPROVED', qi_granted_at: null })
      expect(h.grants.filter(id => id === p.chargeId)).toHaveLength(0)
    } finally {
      await faulted.end({ timeout: 0 })
      await proxy.close()
    }
    expect(await settleAndProvision(p.chargeId, null, now, h.db)).toEqual({ provisioned: false, outcome: 'ALREADY' })
    const repair = () => runQiGrantRetry({
      listUngranted: () => listUngrantedQiPurchases(h.db),
      grant: async ref => { h.grants.push(ref.chargeId); h.credited.add(ref.chargeId); return true },
      markGranted: chargeId => markQiGranted(chargeId, h.db),
    })
    await Promise.all([repair(), repair()])
    expect(h.credited.has(p.chargeId)).toBe(true)
    expect((await listUngrantedQiPurchases(h.db)).some(ref => ref.chargeId === p.chargeId)).toBe(false)
    const calls = h.grants.length
    await repair()
    expect(h.grants).toHaveLength(calls)
  })
})
