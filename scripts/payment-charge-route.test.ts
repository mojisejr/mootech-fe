// #355 — teeth for the /api/v2/payment/charge route (session gate + server-authoritative money). MAIN lane;
// mocks ONLY the transport (session, repo I/O, gateway) so the handler's own branching runs for real.
//
// 🔴 MUTANT CONTRACT (each reddens npm test):
//   MR1  the handler drops the session gate (charges without a session)        → the no-session test reddens
//   MR2  the handler takes user_id/amount from the BODY                         → the client-ignored test reddens
//   MR3  an unknown / unsellable package is charged instead of failing first    → the fail-loud test reddens
//   MR4  the handler stops asking the gateway's verdict (#437 isRefusedCharge)   → the declined-card test reddens
//   MR5  the refusal is marked but the REASON is not written down (#437)         → the failure-code test reddens
//   MR6  recording the reason is allowed to abort the hold release (#440 ตู๋)    → the leaked-hold test reddens
//   MR7  the reason is written AFTER the verdict instead of before (#440 ตู๋)   → the ordering test reddens
//   MR8  the repurchase gate is dropped, or moved AFTER the money (#456)        → the already-entitled tests redden
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    session: { ok: true, userId: 'sess-user' } as
      | { ok: true; userId: string }
      | { ok: false; status: number; error: string },
    // #377: a package row now carries its tier and its on-sale flag (they used to be a hardcoded map).
    pkg: { packageCode: 'MONTHLY', planCode: 'MEMBER', amount: 500, expire: '1M', bufferDay: 0, tierCode: 'PLUS', isActive: true } as
      | { packageCode: string; planCode: string; amount: number; expire: string; bufferDay: number; tierCode: string; isActive: boolean }
      | null,
  }
  const captured = {
    chargeArgs: [] as Array<Record<string, unknown>>,
    insertArgs: [] as Array<Record<string, unknown>>,
  }
  // #437 — the gateway's own verdict is now part of what it returns. Default: it said nothing (the shape
  // every pre-#437 test relied on), so ABSENT must keep reading as "not finished yet", never as refused.
  const gatewayAnswer = { value: {} as Record<string, unknown> }
  const createCardCharge = vi.fn(async (args: Record<string, unknown>) => {
    captured.chargeArgs.push(args)
    return { chargeId: 'chrg_test_1', ...gatewayAnswer.value }
  })
  // #361: the flow now RESERVES (v2_payment row + any discount) before the charge, then attaches the id.
  const insertPendingReserved = vi.fn(async (row: Record<string, unknown>) => {
    captured.insertArgs.push(row)
    return { ok: true as const, paymentId: 'v2pay-1' }
  })
  const abandonPending = vi.fn(async () => undefined)
  const recordChargeFailure = vi.fn(async () => undefined)
  // #456 — what the repurchase gate answers. Default: allow, carry nothing (a first-time buyer), which is
  // the world every pre-#456 spec in this file assumed, so none of them change meaning.
  const purchaseDecision = {
    value: { allow: true, carryOverDays: 0 } as
      | { allow: true; carryOverDays: number }
      | { allow: false; reason: string },
  }
  const decidePurchaseFor = vi.fn(async () => purchaseDecision.value)
  return { state, captured, createCardCharge, insertPendingReserved, gatewayAnswer, abandonPending, recordChargeFailure, purchaseDecision, decidePurchaseFor }
})

vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.state.session) }))
vi.mock('@/lib/payment/omise-gateway', () => ({ omiseGateway: { createCardCharge: h.createCardCharge } }))
vi.mock('@/lib/payment/repo', () => ({
  getPackage: vi.fn(async () => h.state.pkg),
  getUserEmail: vi.fn(async () => 'user@example.com'),
  insertPendingReserved: h.insertPendingReserved,
  attachChargeId: vi.fn(async () => undefined),
  abandonPending: h.abandonPending,
  recordChargeFailure: h.recordChargeFailure,
  decidePurchaseFor: h.decidePurchaseFor,
  settleAndProvision: vi.fn(),
  listUserPayments: vi.fn(),
}))
// #361 quote store — no quote_id is sent by these specs, so the lookup is never hit.
vi.mock('@/lib/discount/repo', () => ({
  getQuote: vi.fn(async () => null),
  getCodeByString: vi.fn(async () => null),
  toSpec: vi.fn(),
  insertQuote: vi.fn(),
  reserveCodeInTx: vi.fn(),
  releaseRedemption: vi.fn(),
  Refuse: class extends Error {},
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
  h.state.pkg = { packageCode: 'MONTHLY', planCode: 'MEMBER', amount: 500, expire: '1M', bufferDay: 0, tierCode: 'PLUS', isActive: true }
  h.captured.chargeArgs.length = 0
  h.captured.insertArgs.length = 0
  h.createCardCharge.mockClear()
  h.insertPendingReserved.mockClear()
  h.abandonPending.mockClear()
  h.recordChargeFailure.mockClear()
  h.gatewayAnswer.value = {}
  h.purchaseDecision.value = { allow: true, carryOverDays: 0 }
  h.decidePurchaseFor.mockClear()
})

describe('POST /api/v2/payment/charge', () => {
  it('MR1 — no session ⇒ 401 and NO charge is created', async () => {
    h.state.session = { ok: false, status: 401, error: 'not signed in' }
    const { p, out } = invoke({ token: 'tok', package_code: 'MONTHLY' })
    await p
    expect(out.status).toBe(401)
    expect(h.createCardCharge).not.toHaveBeenCalled()
    expect(h.insertPendingReserved).not.toHaveBeenCalled()
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

  // 🔴 #437 — the incident this ticket exists for. Omise answers a DECLINED card with HTTP 200 and a normal
  // charge object (status 'failed'), never an error object, so nothing throws. Before #437 the handler read
  // only `id` off that response and replied `status: 'PENDING'`, and the screen said "กำลังดำเนินการ" until
  // the tab was closed. Real charge: chrg_test_68smuuztswneop8au3z, 2026-08-25.
  it('MR4 — a card the gateway DECLINED is not reported as pending', async () => {
    h.gatewayAnswer.value = { status: 'failed', paid: false, failureCode: 'payment_rejected', failureMessage: 'Payment was rejected' }
    const { p, out } = invoke({ token: 'tok', package_code: 'MONTHLY' })
    await p
    expect(out.status).toBe(200) // the REQUEST succeeded; the PAYMENT did not — two different things
    expect((out.body as { status: string }).status).toBe('REJECT')
    expect((out.body as { status: string }).status).not.toBe('PENDING')
    // and the row is marked, so the poller/webhook cannot keep treating it as in flight
    expect(h.abandonPending).toHaveBeenCalled()
  })

  it('MR5 — the REASON the bank gave is written down, not just the refusal', async () => {
    h.gatewayAnswer.value = { status: 'failed', paid: false, failureCode: 'insufficient_fund', failureMessage: 'Insufficient funds' }
    const { p } = invoke({ token: 'tok', package_code: 'MONTHLY' })
    await p
    expect(h.recordChargeFailure).toHaveBeenCalled()
    const [, failure] = h.recordChargeFailure.mock.calls[0] as [string, { code: string | null; message: string | null }]
    expect(failure.code).toBe('insufficient_fund')
    expect(failure.message).toBe('Insufficient funds')
  })

  // The other half of MR4: absence of an answer must NOT be read as refusal, or a gateway that simply
  // did not report a status would start killing perfectly good charges.
  it('a gateway that says nothing is still PENDING — silence is not a refusal', async () => {
    h.gatewayAnswer.value = {} // exactly what every pre-#437 fake returned
    const { p, out } = invoke({ token: 'tok', package_code: 'MONTHLY' })
    await p
    expect((out.body as { status: string }).status).toBe('PENDING')
    expect(h.abandonPending).not.toHaveBeenCalled()
    expect(h.recordChargeFailure).not.toHaveBeenCalled()
  })

  // 🔴 MR6 — ตู๋'s finding on #440. Deploying this code before migration 0010 makes recordChargeFailure
  // raise 42703 (undefined_column). Unguarded, that throw skipped abandonPending on the very next line:
  // the caller got a 500 AND the user's discount code stayed spent on a payment that never happened.
  // The teeth here are NOT about ordering — they are about the nicety being unable to kill the necessity.
  it('MR6 — the reason failing to save must NOT leak the discount hold', async () => {
    h.gatewayAnswer.value = { status: 'failed', paid: false, failureCode: 'payment_rejected', failureMessage: 'x' }
    // exactly what Postgres raises when 0010 has not been applied yet
    h.recordChargeFailure.mockRejectedValueOnce(Object.assign(new Error('column "failure_code" does not exist'), { code: '42703' }))
    const { p, out } = invoke({ token: 'tok', package_code: 'MONTHLY' })
    await p
    // the hold is released and the row is marked, even though the reason could not be written
    expect(h.abandonPending).toHaveBeenCalled()
    // and the caller still gets a truthful answer, not a 500
    expect(out.status).toBe(200)
    expect((out.body as { status: string }).status).toBe('REJECT')
  })

  // 🔴 MR7 — ตู๋ overruled my "ordering stopped mattering" argument on #440 round 2, and he was right.
  // I claimed the catch around recordChargeFailure made the order irrelevant. It does not, because the two
  // things being protected are NOT equally recoverable:
  //
  //   hold left held      abandonByChargeId in the webhook releases it later   → recoverable
  //   reason not written  recordChargeFailure has exactly ONE caller in the     → LOST FOREVER
  //                       whole repo (lib/payment/charge-flow.ts) and the
  //                       webhook never writes failure_code at all
  //
  // So if abandonPending is the one that throws (a plain DB hiccup — the same argument I used to justify
  // the catch applies to it too), writing the reason FIRST is the only thing that keeps it. Reversed, we
  // lose the one fact nothing else in the system can ever reproduce.
  it('MR7 — the reason is written BEFORE the verdict, because only the reason is unrecoverable', async () => {
    h.gatewayAnswer.value = { status: 'failed', paid: false, failureCode: 'stolen_or_lost_card', failureMessage: 'y' }
    const { p } = invoke({ token: 'tok', package_code: 'MONTHLY' })
    await p
    expect(h.recordChargeFailure).toHaveBeenCalled()
    expect(h.abandonPending).toHaveBeenCalled()
    expect(
      h.recordChargeFailure.mock.invocationCallOrder[0],
      'recordChargeFailure must run BEFORE abandonPending — see the comment above this test',
    ).toBeLessThan(h.abandonPending.mock.invocationCallOrder[0])
  })

  // A charge the gateway took successfully must still be PENDING here: only settleAndProvision (webhook /
  // reconcile cron) may write APPROVED, because that is the step that also creates member_subscription.
  it('an ACCEPTED card is still PENDING here — accepted is not settled', async () => {
    h.gatewayAnswer.value = { status: 'successful', paid: true }
    const { p, out } = invoke({ token: 'tok', package_code: 'MONTHLY' })
    await p
    expect((out.body as { status: string }).status).toBe('PENDING')
    expect(h.abandonPending).not.toHaveBeenCalled()
  })

  it('MR3 — a package that maps to no paid tier ⇒ 400 BEFORE any charge (fail-loud, not silent)', async () => {
    h.state.pkg = { packageCode: 'FREE', planCode: 'MEMBER', amount: 0, expire: '0D', bufferDay: 0, tierCode: 'FREE', isActive: true }
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

  // ── #456 — the repurchase gate ───────────────────────────────────────────────────────────────
  it('MR8 — already on this tier ⇒ 409 and NOTHING is reserved and NO charge is created', async () => {
    h.purchaseDecision.value = { allow: false, reason: 'ALREADY_ON_THIS_TIER' }
    const { p, out } = invoke({ package_code: 'MONTHLY', token: 'tokn_1' })
    await p
    expect(out.status).toBe(409)
    expect((out.body as { purchaseError?: string }).purchaseError).toBe('ALREADY_ON_THIS_TIER')
    // 🔴 THE POINT OF THE TICKET: the refusal happens BEFORE the money. Not "the charge was reversed" —
    // no v2_payment row was reserved, no discount hold was taken, and Omise was never called at all.
    expect(h.insertPendingReserved).not.toHaveBeenCalled()
    expect(h.createCardCharge).not.toHaveBeenCalled()
    expect(h.abandonPending).not.toHaveBeenCalled() // nothing to unwind ⇒ nothing was wound
  })

  it('MR8 — a downgrade is refused the same way, and names its own reason', async () => {
    h.purchaseDecision.value = { allow: false, reason: 'CANNOT_DOWNGRADE' }
    const { p, out } = invoke({ package_code: 'MONTHLY', token: 'tokn_1' })
    await p
    expect(out.status).toBe(409)
    expect((out.body as { purchaseError?: string }).purchaseError).toBe('CANNOT_DOWNGRADE')
    expect(h.createCardCharge).not.toHaveBeenCalled()
  })

  it('the gate is asked about the SESSION user and the tier the SERVER priced — never the body', async () => {
    const { p } = invoke({ package_code: 'MONTHLY', token: 'tokn_1', user_id: 'attacker', tier_code: 'FREE' })
    await p
    expect(h.decidePurchaseFor).toHaveBeenCalledWith('sess-user', 'PLUS', expect.any(Date))
  })

  it('an allowed purchase is untouched by the gate — it charges exactly as before', async () => {
    const { p, out } = invoke({ package_code: 'MONTHLY', token: 'tokn_1' })
    await p
    expect(out.status).toBe(200)
    expect((out.body as { status?: string }).status).toBe('PENDING')
    expect(h.createCardCharge).toHaveBeenCalledTimes(1)
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
