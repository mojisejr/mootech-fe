// Companion to mootech-be#16. The BE POST /consent is now fail-closed on a BFF↔BE shared secret
// (x-consent-secret). This BFF (pages/api/v2/onboarding.ts) is the only authorized caller, so it MUST
// attach that header — otherwise the whole onboarding flow gets a silent 401 and consent never records.
//
// ANCHOR: scripts/consent-header.test.tsx#bff-sends-consent-secret
// Bug-class this owns: the BFF calling BE /consent WITHOUT the shared secret. "FE sends the header" is
// only true if a test fails when the header is removed — so the teeth are a call-site mutant: delete the
// `x-consent-secret` line in onboarding.ts → the first test goes RED.
//
// .tsx on purpose: ci.yml's legacy tsx lane globs `scripts/*.test.ts` and never sees `.tsx`, so this runs
// under vitest only (registered in vitest.config.mts include) — no #212 skip-list sync needed.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// #252 — the route now derives the caller's user_id from the signed session before it does anything else,
// so this spec has to say who is calling. It is mocked (not exercised) ON PURPOSE: what this file owns is
// the BFF↔BE shared secret, and the identity half has its own teeth in scripts/onboarding-identity.test.tsx.
// Without this mock every case here dies inside getServerSession on a stub res — a failure about the
// harness, not about the header, which is exactly the kind of noise that teaches people to ignore a spec.
vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSessionUserId: vi.fn(async () => ({ ok: true, userId: 'u1' })),
}))

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

describe('BFF /api/v2/onboarding → BE /consent carries x-consent-secret (#16 companion)', () => {
  const PREV = process.env.CONSENT_SECRET
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.CONSENT_SECRET = 'fe-test-secret'
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        onboarded_at: '2026-08-10 10:00:00',
        onboarding_goal: 'finance',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (PREV === undefined) delete process.env.CONSENT_SECRET
    else process.env.CONSENT_SECRET = PREV
  })

  it('sends x-consent-secret equal to CONSENT_SECRET on the BE /consent call', async () => {
    const res = makeRes()
    await handler(makeReq({ goal: 'finance' }), res as never) // #252: no user_id — the session decides

    expect(res.status).toHaveBeenCalledWith(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/consent$/)
    const headers = opts.headers as Record<string, string>
    // MUTANT: delete the x-consent-secret line in onboarding.ts → this assertion fails.
    expect(headers['x-consent-secret']).toBe('fe-test-secret')
  })

  it('never omits the header key even when CONSENT_SECRET is unset (fail-closed at BE, not silently dropped here)', async () => {
    delete process.env.CONSENT_SECRET
    const res = makeRes()
    await handler(makeReq({ goal: 'finance' }), res as never) // #252: no user_id — the session decides

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(headers).toHaveProperty('x-consent-secret')
  })

  it('does not call BE at all when goal is invalid (validation still runs before the secret call)', async () => {
    const res = makeRes()
    await handler(makeReq({ user_id: 'u1', goal: 'not-a-goal' }), res as never)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
