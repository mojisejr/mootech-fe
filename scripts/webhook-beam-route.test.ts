// Beam lane — the Beam webhook ROUTE (pages/api/v2/payment/webhook-beam.ts) end to end with the real
// codec and the repo mocked: signature gate, body gate, and that a verified event reaches the SAME
// dispatcher the Omise route uses. Real-pg proof of the money path lives in beam-webhook-db.test.ts.
//
// 🔴 MUTANT CONTRACT (each reddens this spec):
//   MR1  route answers 200 before verifying                       → 'unsigned' / 'wrong key' cases fail
//   MR2  route parses the body before verifying                   → 'unsigned invalid JSON' expects 401 not 400
//   MR3  route uses a re-serialised body for the HMAC             → 'whitespace body' case fails
//   MR4  charge.succeeded no longer reaches settleAndProvision    → 'settle' case fails
//   MR5  refund.failed reaches revokeByChargeId                   → 'refund.failed' case fails
//   MR6  the method gate is dropped                               → 'GET' case fails
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'node:stream'
import { signBeamPayload } from '@/lib/payment/beam-webhook-verify'

const h = vi.hoisted(() => ({
  settle: vi.fn(async () => ({ outcome: 'PROVISIONED' as const, provisioned: true })),
  abandon: vi.fn(async () => ({ released: false })),
  revoke: vi.fn(async () => ({ revoked: true, shadowHandled: 'OK' as const, partial: false })),
}))
vi.mock('@/lib/payment/repo', () => ({
  settleAndProvision: h.settle,
  abandonByChargeId: h.abandon,
  revokeByChargeId: h.revoke,
}))

import handler from '@/pages/api/v2/payment/webhook-beam'

const KEY = Buffer.from('a-32-byte-test-hmac-key-for-beam!').toString('base64')
const saved = process.env.BEAM_WEBHOOK_HMAC_KEY
beforeEach(() => {
  process.env.BEAM_WEBHOOK_HMAC_KEY = KEY
  h.settle.mockClear()
  h.abandon.mockClear()
  h.revoke.mockClear()
})
afterEach(() => {
  if (saved === undefined) delete process.env.BEAM_WEBHOOK_HMAC_KEY
  else process.env.BEAM_WEBHOOK_HMAC_KEY = saved
})

function fire(method: string, raw: Buffer, headers: Record<string, string> = {}) {
  const req = Readable.from([raw]) as unknown as { method: string; headers: Record<string, string> }
  req.method = method
  req.headers = headers
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
  return (handler(req as never, res as never) as Promise<void>).then(() => out)
}
const signed = (raw: Buffer, event: string, key = KEY) => ({ 'x-beam-signature': signBeamPayload(raw, key), 'x-beam-event': event })
const CHARGE = { chargeId: 'ch_1', referenceId: '1234567890', status: 'SUCCEEDED', amount: 100, currency: 'THB', failureCode: '' }

describe('POST /api/v2/payment/webhook-beam', () => {
  it('🔴 unsigned delivery → 401, nothing dispatched', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await fire('POST', Buffer.from(JSON.stringify(CHARGE)), { 'x-beam-event': 'charge.succeeded' })
    err.mockRestore()
    expect(out.status).toBe(401)
    expect(h.settle).not.toHaveBeenCalled()
  })

  it('🔴 signed with another environment’s key → 401 (Playground key on Production, or vice versa)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const raw = Buffer.from(JSON.stringify(CHARGE))
    const out = await fire('POST', raw, signed(raw, 'charge.succeeded', Buffer.from('some-other-key-of-32-bytes-long!!').toString('base64')))
    err.mockRestore()
    expect(out.status).toBe(401)
    expect(h.settle).not.toHaveBeenCalled()
  })

  it('🔴 no key configured → 401 fail closed, even for a "valid-looking" signature', async () => {
    delete process.env.BEAM_WEBHOOK_HMAC_KEY
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const raw = Buffer.from(JSON.stringify(CHARGE))
    const out = await fire('POST', raw, signed(raw, 'charge.succeeded'))
    err.mockRestore()
    expect(out.status).toBe(401)
  })

  it('unsigned AND invalid JSON → 401 (signature is checked before the body is parsed)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await fire('POST', Buffer.from('not json'), { 'x-beam-event': 'charge.succeeded' })
    err.mockRestore()
    expect(out.status).toBe(401)
  })

  it('signed but invalid JSON → 400, nothing dispatched', async () => {
    const raw = Buffer.from('not json')
    const out = await fire('POST', raw, signed(raw, 'charge.succeeded'))
    expect(out.status).toBe(400)
    expect(h.settle).not.toHaveBeenCalled()
  })

  it('🔴 a signed charge.succeeded → 200 and settleAndProvision(chargeId, orderId) — the shared dispatcher', async () => {
    const raw = Buffer.from(JSON.stringify(CHARGE))
    const out = await fire('POST', raw, signed(raw, 'charge.succeeded'))
    expect(out.status).toBe(200)
    expect(out.body).toEqual({ received: true })
    expect(h.settle).toHaveBeenCalledWith('ch_1', '1234567890')
    expect(h.revoke).not.toHaveBeenCalled()
  })

  it('🔴 the signature is over the RAW bytes: a body with odd whitespace verifies only when signed as sent', async () => {
    const raw = Buffer.from('{ "chargeId" : "ch_1" ,\n "referenceId":"1234567890", "status":"SUCCEEDED" }')
    const out = await fire('POST', raw, signed(raw, 'charge.succeeded'))
    expect(out.status).toBe(200)
    expect(h.settle).toHaveBeenCalledWith('ch_1', '1234567890')
  })

  it('charge.failed → 200 and the discount hold is released (abandonByChargeId), nothing settled', async () => {
    const raw = Buffer.from(JSON.stringify({ ...CHARGE, status: 'FAILED', failureCode: 'CH_CARD_DECLINED' }))
    const out = await fire('POST', raw, signed(raw, 'charge.failed'))
    expect(out.status).toBe(200)
    expect(h.abandon).toHaveBeenCalledWith('ch_1')
    expect(h.settle).not.toHaveBeenCalled()
  })

  it('refund.succeeded → revokeByChargeId(chargeId, { refundedSatang }) then the hold comes off', async () => {
    const raw = Buffer.from(JSON.stringify({ refundId: 're_1', chargeId: 'ch_1', referenceId: '1234567890', amount: 100, status: 'SUCCEEDED' }))
    const out = await fire('POST', raw, signed(raw, 'refund.succeeded'))
    expect(out.status).toBe(200)
    expect(h.revoke).toHaveBeenCalledWith('ch_1', { refundedSatang: 100 })
    expect(h.abandon).toHaveBeenCalledWith('ch_1')
  })

  it('🔴 refund.failed → 200, NOTHING revoked, nothing abandoned (logged as no-match)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const raw = Buffer.from(JSON.stringify({ refundId: 're_1', chargeId: 'ch_1', referenceId: '1234567890', amount: 100, status: 'FAILED', failureCode: 'RE_PROCESSING_FAILED' }))
    const out = await fire('POST', raw, signed(raw, 'refund.failed'))
    expect(out.status).toBe(200)
    expect(h.revoke).not.toHaveBeenCalled()
    expect(h.abandon).not.toHaveBeenCalled()
    expect(info.mock.calls.flat().join(' ')).toMatch(/no branch matched/)
    info.mockRestore()
  })

  it('transaction.created → 200 and no action (subscribe only to what you need, but tolerate the rest)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const raw = Buffer.from(JSON.stringify({ transactionId: 'ch_1', transactionType: 'PAYMENT', referenceId: '1234567890' }))
    const out = await fire('POST', raw, signed(raw, 'transaction.created'))
    info.mockRestore()
    expect(out.status).toBe(200)
    expect(h.settle).not.toHaveBeenCalled()
  })

  it('GET is 405', async () => {
    expect((await fire('GET', Buffer.from(''))).status).toBe(405)
  })
})
