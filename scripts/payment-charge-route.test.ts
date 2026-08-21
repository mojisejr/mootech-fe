// #355 — teeth for the /api/v2/payment/charge route (session gate + server-authoritative money). MAIN lane;
// mocks ONLY the transport (session, repo I/O, gateway) so the handler's own branching runs for real.
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MR1  the handler drops the session gate (charges without a session)        → the no-session test reddens
//   MR2  the handler takes user_id/amount from the BODY                         → the client-ignored test reddens
//   MR3  an unknown / unsellable package is charged instead of failing first    → the fail-loud test reddens
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    session: { ok: true, userId: 'sess-user' } as
      | { ok: true; userId: string }
      | { ok: false; status: number; error: string },
    pkg: { packageCode: 'MONTHLY', planCode: 'MEMBER', amount: 500, expire: '1M', bufferDay: 0 } as
      | { packageCode: string; planCode: string; amount: number; expire: string; bufferDay: number }
      | null,
  }
  const captured = {
    chargeArgs: [] as Array<Record<string, unknown>>,
    insertArgs: [] as Array<Record<string, unknown>>,
  }
  const createCardCharge = vi.fn(async (args: Record<string, unknown>) => {
    captured.chargeArgs.push(args)
    return { chargeId: 'chrg_test_1' }
  })
  const insertPending = vi.fn(async (row: Record<string, unknown>) => {
    captured.insertArgs.push(row)
    return 'v2pay-1'
  })
  return { state, captured, createCardCharge, insertPending }
})

vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.state.session) }))
vi.mock('@/lib/payment/omise-gateway', () => ({ omiseGateway: { createCardCharge: h.createCardCharge } }))
vi.mock('@/lib/payment/repo', () => ({
  getPackage: vi.fn(async () => h.state.pkg),
  getUserEmail: vi.fn(async () => 'user@example.com'),
  insertPending: h.insertPending,
  settleAndProvision: vi.fn(),
  listUserPayments: vi.fn(),
}))

import chargeHandler from '@/pages/api/v2/payment/charge'
import { config as webhookConfig } from '@/pages/api/v2/payment/webhook'

function invoke(body: unknown, method = 'POST') {
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
  return { p: chargeHandler({ method, body } as never, res as never), out }
}

beforeEach(() => {
  h.state.session = { ok: true, userId: 'sess-user' }
  h.state.pkg = { packageCode: 'MONTHLY', planCode: 'MEMBER', amount: 500, expire: '1M', bufferDay: 0 }
  h.captured.chargeArgs.length = 0
  h.captured.insertArgs.length = 0
  h.createCardCharge.mockClear()
  h.insertPending.mockClear()
})

describe('POST /api/v2/payment/charge', () => {
  it('MR1 — no session ⇒ 401 and NO charge is created', async () => {
    h.state.session = { ok: false, status: 401, error: 'not signed in' }
    const { p, out } = invoke({ token: 'tok', package_code: 'MONTHLY' })
    await p
    expect(out.status).toBe(401)
    expect(h.createCardCharge).not.toHaveBeenCalled()
    expect(h.insertPending).not.toHaveBeenCalled()
  })

  it('MR2 — a user_id and amount in the BODY are ignored; the SESSION user + SERVER amount are used', async () => {
    const { p, out } = invoke({
      token: 'tok',
      package_code: 'MONTHLY',
      user_id: 'attacker', // must not reach the record
      amount: 1, // must not reach Omise
      discount: 99999,
    })
    await p
    expect(out.status).toBe(200)
    // charged the server-computed satang (500 THB → 50000), NOT the body's 1
    expect(h.captured.chargeArgs[0].amountSatang).toBe(50000)
    // recorded under the SESSION user, never 'attacker'
    expect(h.captured.insertArgs[0].userId).toBe('sess-user')
    expect(h.captured.insertArgs[0].amountSatang).toBe(50000)
    expect(JSON.stringify(h.captured.insertArgs[0])).not.toContain('attacker')
  })

  it('MR3 — an unknown package ⇒ 400 BEFORE any charge', async () => {
    h.state.pkg = null
    const { p, out } = invoke({ token: 'tok', package_code: 'NOPE' })
    await p
    expect(out.status).toBe(400)
    expect(h.createCardCharge).not.toHaveBeenCalled()
  })

  it('MR3 — a package that maps to no paid tier ⇒ 400 BEFORE any charge (fail-loud, not silent)', async () => {
    h.state.pkg = { packageCode: 'FREE', planCode: 'MEMBER', amount: 0, expire: '0D', bufferDay: 0 }
    const { p, out } = invoke({ token: 'tok', package_code: 'FREE' })
    await p
    expect(out.status).toBe(400)
    expect(h.createCardCharge).not.toHaveBeenCalled()
  })

  it('missing token ⇒ 400, no charge', async () => {
    const { p, out } = invoke({ package_code: 'MONTHLY' })
    await p
    expect(out.status).toBe(400)
    expect(h.createCardCharge).not.toHaveBeenCalled()
  })

  it('non-POST ⇒ 405', async () => {
    const { p, out } = invoke({}, 'GET')
    await p
    expect(out.status).toBe(405)
  })
})

describe('webhook route config', () => {
  it('🔴 bodyParser is DISABLED — the HMAC is over raw bytes; Next parsing the body would break every signature', () => {
    // A mutant that drops `export const config = { api: { bodyParser: false } }` reddens here. (The runtime
    // effect itself only shows under a live Next server; this pins the declaration that produces it.)
    expect(webhookConfig?.api?.bodyParser).toBe(false)
  })
})
