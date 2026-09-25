// scripts/link-callback-route.test.ts — pages/api/auth/link/callback/[provider].ts (slice 3).
//
// The callback is where a mistake costs an account, so the tests here are mostly
// about what must NOT happen: no exchange without a valid state, no write on a
// collision, no surviving state cookie on any exit, and no identity read from the
// returning request.
import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const exchangeAndVerify = vi.fn()
const linkProvider = vi.fn()
const planIdentityMerge = vi.fn()

vi.mock('@/lib/auth/link-verify', () => ({
  exchangeAndVerify: (...a: unknown[]) => exchangeAndVerify(...a),
}))
vi.mock('@/lib/auth/link-account', () => ({
  linkProvider: (...a: unknown[]) => linkProvider(...a),
  planIdentityMerge: (...a: unknown[]) => planIdentityMerge(...a),
}))
// Imported by the collision branch since slice 4. Mocked so these specs never reach a
// database; the paid rule itself is proven in scripts/merge-survivor.test.ts.
vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: async () => ({ isPaid: false, tier: null, source: 'none', expireAt: null }),
}))
vi.mock('@/lib/auth/link-account-store', () => ({ postgresLinkStore: { transaction: vi.fn() } }))

import handler from '@/pages/api/auth/link/callback/[provider]'
import { issueLinkState, linkStateCookieName } from '@/lib/auth/link-state'

const USER = 'aaaaaaaa-0000-4000-8000-000000000001'

interface Captured {
  status: number | null
  redirect: string | null
  headers: Record<string, string[]>
  json: unknown
}

function call(
  query: Record<string, string>,
  cookies: Record<string, string> = {},
  method = 'GET',
): Promise<Captured> {
  const out: Captured = { status: null, redirect: null, headers: {}, json: null }
  const req = { method, query, cookies, headers: {} } as unknown as NextApiRequest
  const res = {
    setHeader: (k: string, v: string | string[]) => {
      // Node keeps Set-Cookie as a LIST. A fake that flattened it into one string
      // would hide the difference between one cookie and several, which is exactly
      // what slice 4's offer path turns on: it must set the ticket AND clear the
      // state cookie in the same response.
      out.headers[k.toLowerCase()] = Array.isArray(v) ? v.map(String) : [String(v)]
    },
    status: (c: number) => {
      out.status = c
      return res
    },
    json: (b: unknown) => {
      out.json = b
      return res
    },
    redirect: (c: number, url: string) => {
      out.status = c
      out.redirect = url
      return res
    },
  } as unknown as NextApiResponse
  return handler(req, res).then(() => out)
}

function goodState(provider: 'google' | 'line' = 'line', returnTo = '/v2/settings/connected') {
  const issued = issueLinkState({ userId: USER, provider, returnTo })
  return { issued, cookies: { [linkStateCookieName(provider)]: issued.cookieValue } }
}

let saved: Record<string, string | undefined> = {}
const ENV = ['LINK_STATE_SECRET', 'NEXTAUTH_URL', 'GOOGLE_CLIENT_ID', 'LINE_CLIENT_ID'] as const

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))
  process.env.LINK_STATE_SECRET = 'test-secret'
  process.env.NEXTAUTH_URL = 'https://app.staging.mumate.co'
  process.env.GOOGLE_CLIENT_ID = 'g'
  process.env.LINE_CLIENT_ID = 'l'
  exchangeAndVerify.mockReset()
  linkProvider.mockReset()
  planIdentityMerge.mockReset()
  exchangeAndVerify.mockResolvedValue({
    ok: true,
    value: { subject: 'U-1', email: '', name: '', pictureUrl: '' },
  })
  linkProvider.mockResolvedValue({ status: 'linked', rowId: 'row-1' })
  // Slice 4's default: a collision the survivor rule CAN decide. Specs that want the
  // refusal path override it.
  planIdentityMerge.mockResolvedValue({
    status: 'planned',
    survivorUserId: USER,
    loserUserId: 'bbbbbbbb-0000-4000-8000-000000000002',
    rowId: 'row-1',
    provider: 'LINE',
    reason: 'only-one-may-lose',
    loserLiveIdentities: 1,
  })
})
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('nothing happens without a valid state', () => {
  it('no cookie at all — the shape a callback arriving in a different browser takes', async () => {
    const r = await call({ provider: 'line', code: 'C', state: 'S' })
    expect(r.redirect).toContain('link_error=state_missing')
    expect(exchangeAndVerify).not.toHaveBeenCalled()
    expect(linkProvider).not.toHaveBeenCalled()
  })

  it('a state parameter that does not match the cookie', async () => {
    const { cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: 'not-the-state' }, cookies)
    expect(r.redirect).toContain('link_error=state_state-mismatch')
    expect(exchangeAndVerify).not.toHaveBeenCalled()
  })

  it('a google state presented at the line callback', async () => {
    const { issued, cookies } = goodState('google')
    const r = await call(
      { provider: 'line', code: 'C', state: issued.state },
      { [linkStateCookieName('line')]: cookies[linkStateCookieName('google')] },
    )
    expect(r.redirect).toContain('link_error=state_provider-mismatch')
    expect(exchangeAndVerify).not.toHaveBeenCalled()
  })

  it('a tampered cookie', async () => {
    const { issued, cookies } = goodState('line')
    const bad = cookies[linkStateCookieName('line')].replace(/.$/, 'X')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, { [linkStateCookieName('line')]: bad })
    expect(r.redirect).toContain('link_error=state_bad-signature')
    expect(exchangeAndVerify).not.toHaveBeenCalled()
  })

  it('the state is checked BEFORE the provider error, so this is not an oracle', async () => {
    const r = await call({ provider: 'line', error: 'access_denied', state: 'S' })
    expect(r.redirect).toContain('link_error=state_missing')
    expect(r.redirect).not.toContain('cancelled')
  })
})

describe('the state cookie is expired on EVERY exit', () => {
  const cleared = (h: Record<string, string[]>) =>
    (h['set-cookie'] ?? []).join(' || ').includes('Max-Age=0')

  it('on success', async () => {
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect(cleared(r.headers)).toBe(true)
  })

  it('on a state refusal', async () => {
    const r = await call({ provider: 'line', code: 'C', state: 'S' })
    expect(cleared(r.headers)).toBe(true)
  })

  it('on a collision', async () => {
    linkProvider.mockResolvedValue({ status: 'owned-by-another' })
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect(cleared(r.headers)).toBe(true)
  })

  it('on an unexpected throw', async () => {
    linkProvider.mockRejectedValue(new Error('database on fire'))
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect(cleared(r.headers)).toBe(true)
    expect(r.redirect).toContain('link_error=link_failed')
  })
})

describe('identity comes from the signed state, never from the returning request', () => {
  it('links the member captured at start, ignoring any cookie the browser now carries', async () => {
    const { issued, cookies } = goodState('line')
    await call(
      { provider: 'line', code: 'C', state: issued.state },
      { ...cookies, 'cookie-mumate-id': 'bbbbbbbb-0000-4000-8000-000000000002' },
    )
    expect(linkProvider).toHaveBeenCalledTimes(1)
    expect((linkProvider.mock.calls[0] as unknown[])[1]).toMatchObject({ userId: USER })
  })

  it('passes the verifier and nonce from the state into the exchange', async () => {
    const { issued, cookies } = goodState('line')
    await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    const args = (exchangeAndVerify.mock.calls[0] as unknown[])[1] as Record<string, unknown>
    expect(args.nonce).toBe(issued.nonce)
    expect(args.code).toBe('C')
    expect(args.redirectUri).toBe('https://app.staging.mumate.co/api/auth/link/callback/line')
  })
})

describe('outcomes reach the screen', () => {
  it.each([
    ['linked', 'linked=line'],
    ['already-linked', 'already=1'],
    // Slice 4 changed this branch: a collision is now an OFFER when the survivor
    // rule can decide it. The refusal path is asserted separately below.
    ['owned-by-another', 'merge_offer=line'],
    ['member-missing', 'link_error=member_missing'],
  ])('%s → %s', async (status, expected) => {
    linkProvider.mockResolvedValue({ status, rowId: 'r' })
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect(r.redirect).toContain(expected)
  })

  it('a collision message names nobody — it must not leak that an identity is in use here', async () => {
    linkProvider.mockResolvedValue({ status: 'owned-by-another' })
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect(r.redirect).not.toContain('bbbbbbbb')
    expect(r.redirect).not.toContain('@')
  })

  it('offers a merge with nothing identifying in the URL, and carries the proof in an HttpOnly cookie', async () => {
    // Slice 4. The other account's id and the proven subject must not reach the query
    // string: it lands in browser history, in any access log in front of this app, and
    // in a Referer header.
    linkProvider.mockResolvedValue({ status: 'owned-by-another' })
    planIdentityMerge.mockResolvedValue({
      status: 'planned',
      survivorUserId: USER,
      loserUserId: 'bbbbbbbb-0000-4000-8000-000000000002',
      rowId: 'row-1',
      provider: 'LINE',
      reason: 'only-one-may-lose',
      loserLiveIdentities: 1,
    })
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)

    expect(r.redirect).toContain('merge_offer=line')
    expect(r.redirect).not.toContain('bbbbbbbb')
    expect(r.redirect).not.toContain('subject')

    const setCookie = r.headers['set-cookie'] ?? []
    expect(Array.isArray(setCookie)).toBe(true)
    const ticket = setCookie.find((c) => c.startsWith('mumate_merge_line='))
    expect(ticket).toBeTruthy()
    expect(ticket).toContain('HttpOnly')
    expect(ticket).toContain('SameSite=Lax')
    // And the state cookie is STILL cleared in the same response — one setHeader call
    // with an array, not two calls where the second replaces the first.
    expect(setCookie.some((c) => c.startsWith(`${linkStateCookieName('line')}=`) && c.includes('Max-Age=0'))).toBe(true)
  })

  it('sends a refused merge to a code of its own, so the screen can point at support', async () => {
    linkProvider.mockResolvedValue({ status: 'owned-by-another' })
    planIdentityMerge.mockResolvedValue({ status: 'refused', reason: 'no-side-may-lose' })
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)

    expect(r.redirect).toContain('link_error=merge_refused')
    // No ticket is minted for an offer that was never made.
    const setCookie = r.headers['set-cookie'] ?? []
    expect(setCookie.some((c) => c.startsWith('mumate_merge_line='))).toBe(false)
  })

  it('a member who cancelled at the consent screen is sent back quietly', async () => {
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', error: 'access_denied', state: issued.state }, cookies)
    expect(r.redirect).toContain('link_error=cancelled')
    expect(exchangeAndVerify).not.toHaveBeenCalled()
  })

  it('a verification failure never reaches the database', async () => {
    exchangeAndVerify.mockResolvedValue({ ok: false, reason: 'nonce-mismatch' })
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect(r.redirect).toContain('link_error=nonce-mismatch')
    expect(linkProvider).not.toHaveBeenCalled()
  })

  it('a missing code is refused before the exchange', async () => {
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', state: issued.state }, cookies)
    expect(r.redirect).toContain('link_error=no_code')
    expect(exchangeAndVerify).not.toHaveBeenCalled()
  })
})

describe('where the member lands', () => {
  it('returns to the page the flow started from', async () => {
    const { issued, cookies } = goodState('line', '/v2/account')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect(r.redirect?.startsWith('/v2/account?')).toBe(true)
  })

  it('never off-site, even if the state somehow carried one', async () => {
    const { issued, cookies } = goodState('line', 'https://evil.example')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect(r.redirect?.startsWith('/v2/settings/connected')).toBe(true)
  })

  it('is never cached — a cached callback would replay a spent state', async () => {
    const { issued, cookies } = goodState('line')
    const r = await call({ provider: 'line', code: 'C', state: issued.state }, cookies)
    expect((r.headers['cache-control'] ?? []).join('')).toContain('no-store')
  })
})

describe('method and provider guards', () => {
  it.each(['POST', 'DELETE'])('405s %s', async (m) => {
    const r = await call({ provider: 'line' }, {}, m)
    expect(r.status).toBe(405)
  })

  it.each(['apple', 'facebook', 'phone'])('404s %p', async (p) => {
    const r = await call({ provider: p })
    expect(r.status).toBe(404)
  })
})
