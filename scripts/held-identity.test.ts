// scripts/held-identity.test.ts — the held identity and the two routes that issue and spend it
// (mumate-login-identity-001 slice 5, owner decision 23).
//
// 🔴 MUTANT CONTRACT:
//   H1 skip the signature check → "a forged value is refused" red
//   H2 skip the expiry → "older than ten minutes is refused" red
//   H3 hold an OWNED identity → "an owned identity is never held" red
//   H4 attach without a signed session → "no signed session → nothing linked" red
//   H5 forget to clear on failure → "spent on every exit" red
//   H6 accept a cross-site POST → "cross-origin refused" red (both routes)
import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getServerSession, resolveSignedSessionUserId, linkProvider } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveSignedSessionUserId: vi.fn(),
  linkProvider: vi.fn(),
}))
vi.mock('next-auth/next', () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }))
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))
vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSignedSessionUserId: (...a: unknown[]) => resolveSignedSessionUserId(...a),
  resolveSessionUserId: vi.fn(),
}))
vi.mock('@/lib/auth/link-account', () => ({ linkProvider: (...a: unknown[]) => linkProvider(...a) }))
vi.mock('@/lib/auth/link-account-store', () => ({ postgresLinkStore: { transaction: vi.fn() } }))

import {
  HELD_IDENTITY_COOKIE,
  HELD_IDENTITY_TTL_MS,
  issueHeldIdentity,
  verifyHeldIdentity,
} from '@/lib/auth/held-identity'
import holdHandler from '@/pages/api/auth/identity-hold'
import attachHandler from '@/pages/api/auth/identity-attach'

const GOOGLE_SUB = '109876543210987654321'
const USER_A = 'aaaaaaaa-0000-4000-8000-000000000001'

beforeEach(() => {
  process.env.LINK_STATE_SECRET = 'test-secret-that-is-long-enough-000000000000'
  getServerSession.mockReset()
  resolveSignedSessionUserId.mockReset()
  linkProvider.mockReset()
})
afterEach(() => {
  delete process.env.LINK_STATE_SECRET
})

describe('the held identity value', () => {
  const claims = { provider: 'google', subject: GOOGLE_SUB, name: 'n', email: 'e@x', pictureUrl: 'p' }

  it('round-trips what the server issued', () => {
    const r = verifyHeldIdentity(issueHeldIdentity(claims, 1000), 1000 + 60_000)
    expect(r).toEqual({ ok: true, value: claims })
  })
  it('a forged value is refused', () => {
    const v = issueHeldIdentity(claims, 1000)
    const [enc] = v.split('.')
    const tampered = Buffer.from(JSON.stringify({ p: 'google', s: 'someone-else', n: '', e: '', i: '', t: 1000 })).toString('base64url')
    expect(verifyHeldIdentity(`${tampered}.${v.split('.')[1]}`, 1000).ok).toBe(false)
    expect(verifyHeldIdentity(`${enc}.AAAA`, 1000)).toEqual({ ok: false, reason: 'bad-signature' })
  })
  it('older than ten minutes is refused', () => {
    const v = issueHeldIdentity(claims, 1000)
    expect(verifyHeldIdentity(v, 1000 + HELD_IDENTITY_TTL_MS + 1)).toEqual({ ok: false, reason: 'expired' })
  })
  it('missing and malformed', () => {
    expect(verifyHeldIdentity(undefined)).toEqual({ ok: false, reason: 'missing' })
    expect(verifyHeldIdentity('nodot')).toEqual({ ok: false, reason: 'malformed' })
  })
  it('a LINE identity never carries an email', () => {
    const r = verifyHeldIdentity(issueHeldIdentity({ ...claims, provider: 'line', email: 'x@y' }, 1), 2)
    expect(r.ok && r.value.email).toBe('')
  })
  it('throws without the secret rather than signing with nothing', () => {
    delete process.env.LINK_STATE_SECRET
    expect(() => issueHeldIdentity(claims)).toThrow(/LINK_STATE_SECRET/)
  })
})

interface Out { status: number | null; json: any; headers: Record<string, string | string[]> }
async function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  opts: { origin?: string | null; cookies?: Record<string, string>; method?: string } = {},
): Promise<Out> {
  const out: Out = { status: null, json: null, headers: {} }
  const headers: Record<string, string> = { host: 'mumate.test' }
  if (opts.origin !== null) headers.origin = opts.origin ?? 'https://mumate.test'
  const req = { method: opts.method ?? 'POST', headers, cookies: opts.cookies ?? {}, query: {} } as unknown as NextApiRequest
  const res = {
    setHeader: (k: string, v: string | string[]) => void (out.headers[k.toLowerCase()] = v),
    status: (c: number) => ((out.status = c), res),
    json: (b: unknown) => ((out.json = b), res),
  } as unknown as NextApiResponse
  await handler(req, res)
  return out
}

describe('POST /api/auth/identity-hold', () => {
  it('holds the signed, UNOWNED identity in an HttpOnly cookie', async () => {
    getServerSession.mockResolvedValue({ provider: 'google', providerId: GOOGLE_SUB, user: { name: 'n', email: 'e@x', image: 'p' } })
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 404, error: 'none' })
    const r = await call(holdHandler)
    expect(r.status).toBe(200)
    const cookie = String(r.headers['set-cookie'])
    expect(cookie).toContain(`${HELD_IDENTITY_COOKIE}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    const value = cookie.split(';')[0].split('=').slice(1).join('=')
    expect(verifyHeldIdentity(value)).toMatchObject({ ok: true, value: { provider: 'google', subject: GOOGLE_SUB } })
    expect(JSON.stringify(r.json)).not.toContain(GOOGLE_SUB)
  })
  it('an owned identity is never held', async () => {
    getServerSession.mockResolvedValue({ provider: 'google', providerId: GOOGLE_SUB, user: {} })
    resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: USER_A })
    const r = await call(holdHandler)
    expect(r.status).toBe(409)
    expect(r.headers['set-cookie']).toBeUndefined()
  })
  it('a LINE session whose providerId disagrees with its id_token is refused', async () => {
    getServerSession.mockResolvedValue({ provider: 'line', providerId: 'U1', lineProfile: { sub: 'U2' }, user: {} })
    const r = await call(holdHandler)
    expect(r.status).toBe(401)
    expect(resolveSignedSessionUserId).not.toHaveBeenCalled()
  })
  it('no session → 401, nothing held', async () => {
    getServerSession.mockResolvedValue(null)
    const r = await call(holdHandler)
    expect(r.status).toBe(401)
    expect(r.headers['set-cookie']).toBeUndefined()
  })
  it('cross-origin refused, and a missing Origin too', async () => {
    expect((await call(holdHandler, { origin: 'https://evil.test' })).status).toBe(403)
    expect((await call(holdHandler, { origin: null })).status).toBe(403)
    expect(getServerSession).not.toHaveBeenCalled()
  })
  it('POST only', async () => {
    expect((await call(holdHandler, { method: 'GET' })).status).toBe(405)
  })
})

describe('POST /api/auth/identity-attach', () => {
  const held = () => ({ [HELD_IDENTITY_COOKIE]: issueHeldIdentity({ provider: 'google', subject: GOOGLE_SUB, name: 'n', email: 'e@x', pictureUrl: 'p' }) })

  it('attaches the HELD identity to the STRICTLY resolved account, through linkProvider', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: USER_A })
    linkProvider.mockResolvedValue({ status: 'linked', rowId: 'r1' })
    const r = await call(attachHandler, { cookies: held() })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true, linked: 'google' })
    expect((linkProvider.mock.calls[0] as unknown[])[1]).toMatchObject({ userId: USER_A, provider: 'google', subject: GOOGLE_SUB })
  })
  it('spent on every exit — success clears the cookie', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: USER_A })
    linkProvider.mockResolvedValue({ status: 'linked', rowId: 'r1' })
    const r = await call(attachHandler, { cookies: held() })
    expect(String(r.headers['set-cookie'])).toContain('Max-Age=0')
  })
  it('spent on every exit — failure clears it too', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: USER_A })
    linkProvider.mockRejectedValue(new Error('db'))
    const r = await call(attachHandler, { cookies: held() })
    expect(r.status).toBe(500)
    expect(String(r.headers['set-cookie'])).toContain('Max-Age=0')
  })
  it('no signed session → nothing linked', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 401, error: 'x' })
    const r = await call(attachHandler, { cookies: held() })
    expect(r.status).toBe(401)
    expect(linkProvider).not.toHaveBeenCalled()
  })
  it('an unowned session (the proof also failed) → nothing linked', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 404, error: 'x' })
    const r = await call(attachHandler, { cookies: held() })
    expect(r.json.error).toBe('identity_unresolved')
    expect(linkProvider).not.toHaveBeenCalled()
  })
  it('no hold → no_hold, so the page falls back to the link flow', async () => {
    const r = await call(attachHandler)
    expect(r.json).toEqual({ ok: false, error: 'no_hold' })
    expect(resolveSignedSessionUserId).not.toHaveBeenCalled()
  })
  it.each([
    ['owned-by-another', 'owned_by_another'],
    ['provider-already-held', 'provider_already_held'],
    ['member-missing', 'member_missing'],
  ])('%s → %s, and no merge is offered from a hold', async (status, code) => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: USER_A })
    linkProvider.mockResolvedValue({ status })
    const r = await call(attachHandler, { cookies: held() })
    expect(r.json).toEqual({ ok: false, error: code })
    expect(String(r.headers['set-cookie'])).not.toContain('mumate_merge_')
  })
  it('already linked is reported as such', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: USER_A })
    linkProvider.mockResolvedValue({ status: 'already-linked' })
    expect((await call(attachHandler, { cookies: held() })).json).toEqual({ ok: true, linked: 'google', already: true })
  })
  it('cross-origin refused before anything is read', async () => {
    const r = await call(attachHandler, { origin: 'https://evil.test', cookies: held() })
    expect(r.status).toBe(403)
    expect(resolveSignedSessionUserId).not.toHaveBeenCalled()
  })
})
