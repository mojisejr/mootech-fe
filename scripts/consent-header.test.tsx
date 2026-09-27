// /api/v2/onboarding writes consent ITSELF, in every environment — and never calls mootech-be.
// (CIEL mumate-be-retirement-001 slice 1d.)
//
// ANCHOR: scripts/consent-header.test.tsx#onboarding-writes-locally-in-production
// This file used to own "the BFF sends x-consent-secret to BE /consent" (mootech-be#16 companion). That hop
// is gone: the route writes the consent row + onboarded_at through lib/v2/consent-store.ts, so there is no
// secret left to send. The filename is kept so the vitest include list and its drift guard do not churn;
// what it owns now is the replacement contract.
//
// Bug-class this owns: the first-run write depending on a backend — directly (a fetch to the BE), or
// indirectly (a branch that only writes locally outside production, which is what the old dev fallback was:
// on production it fell through to the BE call and 502'd without CONSENT_SECRET, looping every member
// through first-run the day the BE goes).
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MC1  gate the local write on NODE_ENV !== 'production' again     → ① reddens (production gets no write)
//   MC2  re-add any fetch to the BE on the path                       → ① and ② redden (fetch was called)
//   MC3  read policy_version from the body                            → ③ reddens
//   MC4  relay the driver's error message on a failed write            → ⑤ reddens
// The real-database half (both rows land, or neither) is scripts/consent-store-db.test.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { PDPA_POLICY_VERSION } from '@/constants/pdpa'

// Identity is mocked (not exercised) ON PURPOSE — it has its own teeth in scripts/onboarding-identity.test.tsx.
vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSessionUserId: vi.fn(async () => ({ ok: true, userId: 'u1' })),
}))

const store = vi.hoisted(() => ({
  recordOnboardingConsent: vi.fn(),
}))
vi.mock('@/lib/v2/consent-store', () => store)

import handler from '../pages/api/v2/onboarding'

function makeRes() {
  const res: {
    statusCode: number
    body: unknown
    status: ReturnType<typeof vi.fn>
    json: ReturnType<typeof vi.fn>
  } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => {
      res.statusCode = c
      return res
    }),
    json: vi.fn((b: unknown) => {
      res.body = b
      return res
    }),
  }
  return res
}

const makeReq = (body: unknown) =>
  ({ method: 'POST', body }) as unknown as Parameters<typeof handler>[0]

describe('/api/v2/onboarding writes consent locally, in production too, and never reaches the BE', () => {
  const PREV_NODE_ENV = process.env.NODE_ENV
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store.recordOnboardingConsent.mockReset()
    store.recordOnboardingConsent.mockResolvedValue({
      ok: true,
      onboarded_at: '2026-09-27 10:00:00',
      onboarding_goal: 'finance',
    })
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (PREV_NODE_ENV === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV
    else (process.env as Record<string, string | undefined>).NODE_ENV = PREV_NODE_ENV
  })

  // ① 🔴 THE CASE THE OLD CODE FAILED: production, no CONSENT_SECRET anywhere. It used to call the BE.
  it('🔴 ① NODE_ENV=production → the local write runs, 200 with the stamp, and no network call is made', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'
    const res = makeRes()
    await handler(makeReq({ goal: 'finance' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, onboarded_at: '2026-09-27 10:00:00', onboarding_goal: 'finance' })
    expect(store.recordOnboardingConsent).toHaveBeenCalledTimes(1)
    expect(store.recordOnboardingConsent).toHaveBeenCalledWith({
      userId: 'u1',
      goal: 'finance',
      policyVersion: PDPA_POLICY_VERSION,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ② The same path outside production — there is ONE path now, not a dev branch and a prod branch.
  it('② NODE_ENV=development → the SAME local write, the same arguments, no network call', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'
    const res = makeRes()
    await handler(makeReq({ goal: 'love' }), res as never)

    expect(res.statusCode).toBe(200)
    expect(store.recordOnboardingConsent).toHaveBeenCalledWith({
      userId: 'u1',
      goal: 'love',
      policyVersion: PDPA_POLICY_VERSION,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ③ policy_version is server-owned — proven by trying to move it from the body.
  it('③ policy_version in the body is ignored; the server constant is written', async () => {
    const res = makeRes()
    await handler(makeReq({ goal: 'finance', policy_version: 'ATTACKER-1' }), res as never)
    expect(store.recordOnboardingConsent.mock.calls[0][0].policyVersion).toBe(PDPA_POLICY_VERSION)
  })

  it('④ an invalid goal is refused (400) before the write side is reached', async () => {
    const res = makeRes()
    await handler(makeReq({ goal: 'not-a-goal' }), res as never)
    expect(res.statusCode).toBe(400)
    expect(store.recordOnboardingConsent).not.toHaveBeenCalled()
  })

  // ⑤ A failed write is a 500 that does not relay the driver's text (it can name tables and values).
  it('⑤ the write throws → 500 with a fixed message; the driver error is not relayed', async () => {
    store.recordOnboardingConsent.mockRejectedValueOnce(new Error('relation "consent" does not exist SECRET-DETAIL'))
    const res = makeRes()
    await handler(makeReq({ goal: 'finance' }), res as never)
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ ok: false, error: 'consent save failed' })
    expect(JSON.stringify(res.body)).not.toContain('SECRET-DETAIL')
  })

  it('⑥ the session names a user_id with no "user" row → 404, nothing claimed as stamped', async () => {
    store.recordOnboardingConsent.mockResolvedValueOnce({ ok: false, reason: 'user-not-found' })
    const res = makeRes()
    await handler(makeReq({ goal: 'finance' }), res as never)
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ ok: false, error: 'user not found' })
  })

  // ⑦ A source pin, because ① can only see a fetch on the paths it drives. The route must not NAME the
  // backend at all: no backend URL, no consent secret, no fetch.
  it('⑦ the route source names no backend URL, no consent secret, and makes no fetch', () => {
    const src = readFileSync('pages/api/v2/onboarding.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(src).not.toMatch(/NEXT_PUBLIC_BACKEND_URL/)
    expect(src).not.toMatch(/CONSENT_SECRET/)
    expect(src).not.toMatch(/x-consent-secret/)
    expect(src).not.toMatch(/\bfetch\s*\(/)
  })
})
