// scripts/link-providers.test.ts — lib/auth/link-providers.ts (slice 3).
// The two parameters this file exists to guarantee — LINE's disable_ios_auto_login
// and Google's prompt=select_account — each cost this codebase a real incident or
// an unrecoverable user mistake, so each has a test that fails if it is dropped.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ENDPOINTS,
  PROVIDER_SPELLING,
  buildAuthorizeUrl,
  clientIdFor,
  clientSecretFor,
  isLineWebview,
  isLinkableProvider,
  linkRedirectUri,
  refusalReason,
} from '@/lib/auth/link-providers'

const ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'LINE_CLIENT_ID', 'LINE_CLIENT_SECRET', 'NEXTAUTH_URL']
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  process.env.GOOGLE_CLIENT_ID = 'g-client'
  process.env.GOOGLE_CLIENT_SECRET = 'g-secret'
  process.env.LINE_CLIENT_ID = 'l-client'
  process.env.LINE_CLIENT_SECRET = 'l-secret'
  process.env.NEXTAUTH_URL = 'https://app.staging.mumate.co'
})
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function authorize(provider: 'google' | 'line') {
  return new URL(
    buildAuthorizeUrl({
      provider,
      clientId: clientIdFor(provider),
      redirectUri: linkRedirectUri(provider),
      state: 'STATE',
      nonce: 'NONCE',
      codeChallenge: 'CHALLENGE',
    }),
  )
}

describe('which providers may be linked', () => {
  it.each(['google', 'line', 'LINE', ' Google '])('accepts %p', (v) => {
    expect(isLinkableProvider(v)).toBe(true)
  })

  it.each(['facebook', 'twitter', 'apple', 'phone', 'dev', '', null, undefined, 42])(
    'refuses %p — the UI lists Apple and phone but nothing implements them',
    (v) => {
      expect(isLinkableProvider(v)).toBe(false)
    },
  )
})

describe('the authorize URL carries what the provider needs', () => {
  it.each(['google', 'line'] as const)('%s: response_type, client_id, redirect_uri, state, nonce, S256', (p) => {
    const u = authorize(p)
    expect(u.searchParams.get('response_type')).toBe('code')
    expect(u.searchParams.get('client_id')).toBe(p === 'google' ? 'g-client' : 'l-client')
    expect(u.searchParams.get('redirect_uri')).toBe(`https://app.staging.mumate.co/api/auth/link/callback/${p}`)
    expect(u.searchParams.get('state')).toBe('STATE')
    expect(u.searchParams.get('nonce')).toBe('NONCE')
    expect(u.searchParams.get('code_challenge')).toBe('CHALLENGE')
    expect(u.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('points at the provider\'s real authorization host', () => {
    expect(authorize('google').origin).toBe('https://accounts.google.com')
    expect(authorize('line').origin).toBe('https://access.line.me')
  })
})

describe('the two parameters that cost us incidents', () => {
  it('LINE carries disable_ios_auto_login — without it iOS app-switches and destroys the state cookie', () => {
    expect(authorize('line').searchParams.get('disable_ios_auto_login')).toBe('true')
  })

  it('LINE does NOT carry the broader disable_auto_login, which was tried and rejected (#728)', () => {
    expect(authorize('line').searchParams.get('disable_auto_login')).toBeNull()
  })

  it('Google carries prompt=select_account — the member is linking a SECOND account and must choose', () => {
    expect(authorize('google').searchParams.get('prompt')).toBe('select_account')
  })

  it('each flag goes only to the provider it belongs to', () => {
    expect(authorize('google').searchParams.get('disable_ios_auto_login')).toBeNull()
    expect(authorize('line').searchParams.get('prompt')).toBeNull()
  })
})

describe('scopes', () => {
  it('LINE asks for no email — that channel permission is still the team\'s and slice 3 must not need it', () => {
    expect(ENDPOINTS.line.scope).toBe('openid profile')
    expect(authorize('line').searchParams.get('scope')).not.toContain('email')
  })

  it('Google asks for email, which it already grants on sign-in', () => {
    expect(authorize('google').searchParams.get('scope')).toContain('email')
  })
})

describe('provider spelling stays asymmetric', () => {
  it('writes google lower and LINE upper, because four backend queries match a literal LINE', () => {
    expect(PROVIDER_SPELLING.google).toBe('google')
    expect(PROVIDER_SPELLING.line).toBe('LINE')
  })
})

describe('the redirect URI is derived, never guessed from the request', () => {
  it('matches the value registered on the provider console, character for character', () => {
    expect(linkRedirectUri('line')).toBe('https://app.staging.mumate.co/api/auth/link/callback/line')
    expect(linkRedirectUri('google')).toBe('https://app.staging.mumate.co/api/auth/link/callback/google')
  })

  it('tolerates a trailing slash on the configured origin rather than producing a double slash', () => {
    process.env.NEXTAUTH_URL = 'https://app.staging.mumate.co/'
    expect(linkRedirectUri('line')).toBe('https://app.staging.mumate.co/api/auth/link/callback/line')
  })

  it('throws when NEXTAUTH_URL is unset instead of building a relative or localhost URI', () => {
    delete process.env.NEXTAUTH_URL
    expect(() => linkRedirectUri('line')).toThrow(/NEXTAUTH_URL/)
  })
})

describe('client credentials fail closed', () => {
  it.each(['google', 'line'] as const)('%s id throws when unset', (p) => {
    delete process.env[p === 'google' ? 'GOOGLE_CLIENT_ID' : 'LINE_CLIENT_ID']
    expect(() => clientIdFor(p)).toThrow(/CLIENT_ID/)
  })

  it.each(['google', 'line'] as const)('%s secret throws when unset', (p) => {
    delete process.env[p === 'google' ? 'GOOGLE_CLIENT_SECRET' : 'LINE_CLIENT_SECRET']
    expect(() => clientSecretFor(p)).toThrow(/CLIENT_SECRET/)
  })
})

describe('detecting the LINE in-app browser', () => {
  it.each([
    'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Line/13.5.0',
    'Mozilla/5.0 (Linux; Android 13) Line/14.2.1 Mobile',
  ])('recognises %p', (ua) => {
    expect(isLineWebview(ua)).toBe(true)
  })

  it.each([
    'Mozilla/5.0 (iPhone) Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
    // "Linear", "Airline" etc. must not trip the word boundary
    'Mozilla/5.0 Linear/1.0',
    '',
    undefined,
  ])('does not mistake %p for it', (ua) => {
    expect(isLineWebview(ua)).toBe(false)
  })
})

describe('owner decision 7 — refuse to start Google from inside LINE', () => {
  const inLine = 'Mozilla/5.0 (iPhone) Line/13.5.0'
  const normal = 'Mozilla/5.0 (iPhone) Safari/605.1.15'

  it('refuses Google inside the LINE webview, because the external browser loses both cookies', () => {
    expect(refusalReason('google', inLine)).toBe('line-webview-google')
  })

  it('allows LINE inside the LINE webview — that flow never leaves the cookie jar', () => {
    expect(refusalReason('line', inLine)).toBeNull()
  })

  it('allows Google in an ordinary browser', () => {
    expect(refusalReason('google', normal)).toBeNull()
  })

  it('allows Google when the user agent is absent rather than refusing everyone', () => {
    expect(refusalReason('google', undefined)).toBeNull()
  })
})
