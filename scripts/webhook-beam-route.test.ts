// Beam Checkout lane slice 1 — the Beam webhook ROUTE SHELL (pages/api/v2/payment/webhook-beam.ts) before
// the adapter exists. The one behaviour that matters now: a delivery must NEVER be answered 2xx by a build
// that cannot verify or act on it, or Beam marks it delivered and stops retrying. No DB, no network: the
// repo module is mocked so nothing below the route can run by accident.
//
// 🔴 MUTANT CONTRACT (each reddens this spec):
//   MR1  the not-installed catch answers 200                       → 'not installed' case fails
//   MR2  the method gate is dropped                                → 'GET' case fails
// Slice 2 extends this file with the real codec: signature vector, 401, 400, and dispatch.
import { describe, it, expect, vi } from 'vitest'
import { Readable } from 'node:stream'

vi.mock('@/lib/payment/repo', () => ({
  settleAndProvision: vi.fn(async () => {
    throw new Error('must not be reached in slice 1')
  }),
  abandonByChargeId: vi.fn(),
  revokeByChargeId: vi.fn(),
}))

import handler from '@/pages/api/v2/payment/webhook-beam'

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

describe('POST /api/v2/payment/webhook-beam — slice 1 shell', () => {
  it('🔴 a delivery to a build without the Beam adapter is answered 503, never 200 (Beam keeps retrying)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const out = await fire('POST', Buffer.from('{"chargeId":"ch_x","status":"SUCCEEDED"}'), {
        'x-beam-signature': 'AAAA',
        'x-beam-event': 'charge.succeeded',
      })
      expect(out.status).toBe(503)
      expect(out.body).toEqual({ error: 'beam gateway not installed' })
      expect(err.mock.calls.flat().join(' ')).toMatch(/without the Beam adapter/)
    } finally {
      err.mockRestore()
    }
  })

  it('GET is 405', async () => {
    const out = await fire('GET', Buffer.from(''))
    expect(out.status).toBe(405)
  })
})
