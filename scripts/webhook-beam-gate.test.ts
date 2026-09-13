// Beam Checkout lane slice 1 — the Beam webhook path must pass BOTH middleware gates, exactly like the
// Omise one, or Beam's machine is answered with a 200 gate page, reads it as "delivered" and never
// retries: money moved, nobody provisioned. Two gates, because they fire in different phases of the
// launch — guardV2 while the preview key exists, the maintenance allow-list once #606 deletes guardV2.
//
// 🔴 MUTANT CONTRACT (each reddens this spec):
//   MR1  remove the webhook-beam line inside guardV2 (middleware.ts)        → 'guardV2' cases fail (401)
//   MR2  remove the webhook-beam line in the maintenance allow-list         → 'maintenance' cases fail
//   MR3  turn either exact match into startsWith                            → the look-alike cases fail
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

const mkReq = (path: string) => new NextRequest(new URL('http://localhost' + path))
const rewriteTarget = (res: Response) => res.headers.get('x-middleware-rewrite')
const isPassThrough = (res: Response) => rewriteTarget(res) == null && res.headers.get('location') == null
const isMaintenance = (res: Response) => (rewriteTarget(res) || '').includes('/maintenance')

const saved: Record<string, string | undefined> = {}
const ENV = ['MAINTENANCE_MODE', 'MAINTENANCE_BYPASS_KEY', 'V2_PREVIEW_KEY'] as const
beforeEach(() => {
  for (const k of ENV) saved[k] = process.env[k]
})
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('guardV2 — preview key set, no cookie (the pre-launch phase)', () => {
  beforeEach(() => {
    delete process.env.MAINTENANCE_MODE
    process.env.V2_PREVIEW_KEY = 'preview-key'
  })

  it('/api/v2/payment/webhook-beam passes (its gate is the HMAC in the route, not the cookie)', () => {
    expect(isPassThrough(middleware(mkReq('/api/v2/payment/webhook-beam')))).toBe(true)
  })

  it('control: the Omise webhook still passes', () => {
    expect(isPassThrough(middleware(mkReq('/api/v2/payment/webhook')))).toBe(true)
  })

  it('a look-alike /api/v2/payment/webhook-beam/extra is still 401 (exact match, not prefix)', () => {
    expect(middleware(mkReq('/api/v2/payment/webhook-beam/extra')).status).toBe(401)
  })

  it('control: an ordinary /api/v2 route without the cookie is still 401', () => {
    expect(middleware(mkReq('/api/v2/payment/status')).status).toBe(401)
  })
})

describe('maintenance allow-list — MAINTENANCE_MODE=on, no bypass cookie (the launch-day phase)', () => {
  beforeEach(() => {
    process.env.MAINTENANCE_MODE = 'on'
    process.env.MAINTENANCE_BYPASS_KEY = 'bypass'
    delete process.env.V2_PREVIEW_KEY
  })

  it('/api/v2/payment/webhook-beam passes (else Beam is served the maintenance page with a 200)', () => {
    expect(isPassThrough(middleware(mkReq('/api/v2/payment/webhook-beam')))).toBe(true)
  })

  it('control: the Omise webhook still passes', () => {
    expect(isPassThrough(middleware(mkReq('/api/v2/payment/webhook')))).toBe(true)
  })

  it('a look-alike /api/v2/payment/webhook-beam/extra is still rewritten to maintenance', () => {
    expect(isMaintenance(middleware(mkReq('/api/v2/payment/webhook-beam/extra')))).toBe(true)
  })

  it('control: a page is still rewritten to maintenance', () => {
    expect(isMaintenance(middleware(mkReq('/v2/shop')))).toBe(true)
  })
})
