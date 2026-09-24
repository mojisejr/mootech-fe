// scripts/link-state.test.ts — lib/auth/link-state.ts (mumate-login-identity-001 slice 3).
//
// Every case here is written to FAIL IF THE MECHANISM WERE ABSENT, which is the
// rule this workstream adopted after five proofs in a row passed for reasons
// unrelated to what they claimed. So: no test asserts only that the happy path
// returns ok. Each one removes or corrupts exactly one thing and demands the
// specific refusal, and the signature tests re-derive the HMAC independently
// rather than round-tripping the module against itself.
import { createHash, createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  LINK_STATE_TTL_MS,
  clearLinkStateCookie,
  issueLinkState,
  linkStateCookie,
  linkStateCookieName,
  normalizeProviderKey,
  safeReturnTo,
  verifyLinkState,
} from '@/lib/auth/link-state'

const SECRET = 'test-secret-do-not-use-in-production'
const USER = '4a2f2a1e-0000-4000-8000-000000000001'
const T0 = 1_700_000_000_000

let saved: string | undefined
beforeEach(() => {
  saved = process.env.LINK_STATE_SECRET
  process.env.LINK_STATE_SECRET = SECRET
})
afterEach(() => {
  if (saved === undefined) delete process.env.LINK_STATE_SECRET
  else process.env.LINK_STATE_SECRET = saved
})

function claims(over: Partial<{ userId: string; provider: string; returnTo: string }> = {}) {
  return { userId: USER, provider: 'google', returnTo: '/v2/settings/connected', ...over }
}

describe('the secret is required, never defaulted', () => {
  it('throws rather than signing with a fallback when LINK_STATE_SECRET is unset', () => {
    delete process.env.LINK_STATE_SECRET
    expect(() => issueLinkState(claims())).toThrow(/LINK_STATE_SECRET/)
  })

  it('a blob signed with a DIFFERENT secret is rejected, not accepted', () => {
    const issued = issueLinkState(claims(), T0)
    process.env.LINK_STATE_SECRET = 'a-different-secret'
    const r = verifyLinkState(issued.cookieValue, { state: issued.state, provider: 'google' }, T0)
    expect(r).toEqual({ ok: false, reason: 'bad-signature' })
  })
})

describe('round trip', () => {
  it('returns the bound member, provider, verifier, nonce and return path', () => {
    const issued = issueLinkState(claims({ returnTo: '/v2/account' }), T0)
    const r = verifyLinkState(issued.cookieValue, { state: issued.state, provider: 'google' }, T0 + 1000)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.userId).toBe(USER)
    expect(r.value.provider).toBe('google')
    expect(r.value.returnTo).toBe('/v2/account')
    expect(r.value.nonce).toBe(issued.nonce)
    expect(r.value.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('the PKCE challenge really is S256 of the verifier, derived independently', () => {
    const issued = issueLinkState(claims(), T0)
    const r = verifyLinkState(issued.cookieValue, { state: issued.state, provider: 'google' }, T0)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const expected = createHash('sha256').update(r.value.codeVerifier).digest('base64url')
    expect(issued.codeChallenge).toBe(expected)
    // and it is NOT the plain verifier — a "plain" challenge would also round trip
    expect(issued.codeChallenge).not.toBe(r.value.codeVerifier)
  })

  it('the verifier never appears in what is sent to the provider', () => {
    const issued = issueLinkState(claims(), T0)
    const r = verifyLinkState(issued.cookieValue, { state: issued.state, provider: 'google' }, T0)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(issued.state).not.toContain(r.value.codeVerifier)
    expect(issued.codeChallenge).not.toContain(r.value.codeVerifier)
    expect(issued.nonce).not.toContain(r.value.codeVerifier)
  })

  it('state, nonce and verifier are three different high-entropy values, fresh every call', () => {
    const a = issueLinkState(claims(), T0)
    const b = issueLinkState(claims(), T0)
    expect(a.state).not.toBe(b.state)
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.cookieValue).not.toBe(b.cookieValue)
    expect(a.state).not.toBe(a.nonce)
    expect(a.state.length).toBeGreaterThanOrEqual(43)
  })
})

describe('forgery is refused', () => {
  it('a payload edited by one character fails the signature', () => {
    const issued = issueLinkState(claims(), T0)
    const [encoded, mac] = issued.cookieValue.split('.')
    const flipped = (encoded[0] === 'A' ? 'B' : 'A') + encoded.slice(1)
    const r = verifyLinkState(`${flipped}.${mac}`, { state: issued.state, provider: 'google' }, T0)
    expect(r).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('a mac edited by one character fails the signature', () => {
    const issued = issueLinkState(claims(), T0)
    const [encoded, mac] = issued.cookieValue.split('.')
    const flipped = mac.slice(0, -1) + (mac.endsWith('A') ? 'B' : 'A')
    const r = verifyLinkState(`${encoded}.${flipped}`, { state: issued.state, provider: 'google' }, T0)
    expect(r).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('swapping in ANOTHER member id without the secret cannot produce a valid blob', () => {
    // The whole point of signing: an attacker who can read their own cookie still
    // cannot mint one that names someone else.
    const issued = issueLinkState(claims(), T0)
    const [, mac] = issued.cookieValue.split('.')
    const forged = Buffer.from(
      JSON.stringify({ s: issued.state, u: 'victim-user-id', p: 'google', v: 'x', n: 'y', r: '/v2', t: T0 }),
    ).toString('base64url')
    const r = verifyLinkState(`${forged}.${mac}`, { state: issued.state, provider: 'google' }, T0)
    expect(r).toEqual({ ok: false, reason: 'bad-signature' })
  })

  it('a correctly signed but structurally wrong payload is malformed, not accepted', () => {
    const encoded = Buffer.from(JSON.stringify({ s: 'a', u: 'b' })).toString('base64url')
    const mac = createHmac('sha256', SECRET).update(encoded).digest('base64url')
    const r = verifyLinkState(`${encoded}.${mac}`, { state: 'a', provider: 'google' }, T0)
    expect(r).toEqual({ ok: false, reason: 'malformed' })
  })

  it('non-JSON that is correctly signed is malformed, not a crash', () => {
    const encoded = Buffer.from('not json at all').toString('base64url')
    const mac = createHmac('sha256', SECRET).update(encoded).digest('base64url')
    const r = verifyLinkState(`${encoded}.${mac}`, { state: 'a', provider: 'google' }, T0)
    expect(r).toEqual({ ok: false, reason: 'malformed' })
  })

  it.each([undefined, null, '', 'nodot', '.leading', 'trailing.'])('rejects shapeless cookie %p', (v) => {
    const r = verifyLinkState(v as string | undefined, { state: 'a', provider: 'google' }, T0)
    expect(r.ok).toBe(false)
  })
})

describe('the state parameter must match the cookie', () => {
  it('refuses a different state of the same length', () => {
    const issued = issueLinkState(claims(), T0)
    const other = issueLinkState(claims(), T0).state
    const r = verifyLinkState(issued.cookieValue, { state: other, provider: 'google' }, T0)
    expect(r).toEqual({ ok: false, reason: 'state-mismatch' })
  })

  it.each([undefined, null, ''])('refuses a missing state %p rather than skipping the check', (s) => {
    const issued = issueLinkState(claims(), T0)
    const r = verifyLinkState(issued.cookieValue, { state: s as string | undefined, provider: 'google' }, T0)
    expect(r).toEqual({ ok: false, reason: 'state-mismatch' })
  })
})

describe('a state minted for one provider cannot be spent at another', () => {
  it('refuses a google blob presented at the line callback', () => {
    const issued = issueLinkState(claims({ provider: 'google' }), T0)
    const r = verifyLinkState(issued.cookieValue, { state: issued.state, provider: 'line' }, T0)
    expect(r).toEqual({ ok: false, reason: 'provider-mismatch' })
  })

  it('matches case-insensitively, because LINE is stored upper-case and the session says lower', () => {
    const issued = issueLinkState(claims({ provider: 'LINE' }), T0)
    const r = verifyLinkState(issued.cookieValue, { state: issued.state, provider: 'line' }, T0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.provider).toBe('line')
  })
})

describe('expiry', () => {
  it('accepts at the last millisecond of the window and refuses one past it', () => {
    const issued = issueLinkState(claims(), T0)
    const args = { state: issued.state, provider: 'google' }
    expect(verifyLinkState(issued.cookieValue, args, T0 + LINK_STATE_TTL_MS).ok).toBe(true)
    expect(verifyLinkState(issued.cookieValue, args, T0 + LINK_STATE_TTL_MS + 1)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('refuses a blob issued in the future, so a skewed clock cannot widen the window', () => {
    const issued = issueLinkState(claims(), T0)
    const r = verifyLinkState(issued.cookieValue, { state: issued.state, provider: 'google' }, T0 - 1)
    expect(r).toEqual({ ok: false, reason: 'expired' })
  })
})

describe('safeReturnTo keeps the flow from becoming an open redirect', () => {
  it.each([
    'https://evil.example/steal',
    '//evil.example/steal',
    'http://evil.example',
    '/\\evil.example',
    '/v2\\evil',
    'javascript:alert(1)',
    'v2/settings',
    '',
  ])('refuses %p and falls back', (candidate) => {
    expect(safeReturnTo(candidate)).toBe('/v2/settings/connected')
  })

  it('refuses a path carrying a control character', () => {
    expect(safeReturnTo('/v2\r\nLocation: https://evil.example')).toBe('/v2/settings/connected')
  })

  it.each(['/v2', '/v2/settings/connected', '/v2/account?tab=links'])('allows same-site path %p', (p) => {
    expect(safeReturnTo(p)).toBe(p)
  })

  it('a hostile returnTo does not survive a round trip through the signed blob', () => {
    const issued = issueLinkState(claims({ returnTo: 'https://evil.example' }), T0)
    const r = verifyLinkState(issued.cookieValue, { state: issued.state, provider: 'google' }, T0)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.returnTo).toBe('/v2/settings/connected')
  })
})

describe('the cookie itself', () => {
  it('is HttpOnly and SameSite=Lax — never None, which the LINE webview drops', () => {
    const c = linkStateCookie('google', 'v', { secure: true })
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Lax')
    expect(c).not.toContain('SameSite=None')
  })

  it('carries Secure in production and omits it in development', () => {
    expect(linkStateCookie('google', 'v', { secure: true })).toContain('; Secure')
    expect(linkStateCookie('google', 'v', { secure: false })).not.toContain('; Secure')
  })

  it('is scoped per provider so two tabs cannot clobber each other', () => {
    expect(linkStateCookieName('google')).not.toBe(linkStateCookieName('line'))
    expect(linkStateCookieName('LINE')).toBe(linkStateCookieName('line'))
  })

  it('the clearing cookie expires immediately and keeps the same attributes', () => {
    const c = clearLinkStateCookie('google', { secure: true })
    expect(c).toContain('Max-Age=0')
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Lax')
  })
})

describe('normalizeProviderKey', () => {
  it.each([
    ['LINE', 'line'],
    ['  Google ', 'google'],
    ['google', 'google'],
  ])('%p becomes %p', (input, want) => {
    expect(normalizeProviderKey(input)).toBe(want)
  })
})
