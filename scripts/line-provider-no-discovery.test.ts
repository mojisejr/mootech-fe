// @vitest-environment node
// scripts/line-provider-no-discovery.test.ts — the LINE provider in pages/api/auth/[...nextauth].ts.
// 2026-10-09: from DigitalOcean Singapore about half of all TCP connects to access.line.me drop, and next-auth
// discovered LINE's metadata from there on every sign-in and callback ("outgoing request timed out after 3500ms",
// about one LINE login in four failed). The provider now carries its endpoints itself. These tests fail if the
// discovery comes back, if the hand-built issuer drifts from what discovery produced, or if it stops checking `iss`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import path from 'node:path'
import { SignJWT } from 'jose'

// next-auth's provider parsing and client factory are not in its exports map; load them by path, and take
// openid-client through the same require so the Issuer.discover spy sits on the instance next-auth calls.
const requireCjs = createRequire(path.join(process.cwd(), 'package.json'))
const parseProviders = requireCjs('./node_modules/next-auth/core/lib/providers.js').default
const { openidClient } = requireCjs('./node_modules/next-auth/core/lib/oauth/client.js')
const { Issuer, TokenSet } = requireCjs('openid-client')

import { authOptions } from '@/pages/api/auth/[...nextauth]'

// LINE's own https://access.line.me/.well-known/openid-configuration, fetched 2026-10-09 — what next-auth used to download.
const LINE_DISCOVERY = {
  issuer: 'https://access.line.me',
  authorization_endpoint: 'https://access.line.me/oauth2/v2.1/authorize',
  token_endpoint: 'https://api.line.me/oauth2/v2.1/token',
  revocation_endpoint: 'https://api.line.me/oauth2/v2.1/revoke',
  userinfo_endpoint: 'https://api.line.me/oauth2/v2.1/userinfo',
  scopes_supported: ['openid', 'profile', 'email'],
  jwks_uri: 'https://api.line.me/oauth2/v2.1/certs',
  response_types_supported: ['code'],
  subject_types_supported: ['pairwise'],
  id_token_signing_alg_values_supported: ['ES256'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
  revocation_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
}

const CLIENT_ID = 'l-client'
const CLIENT_SECRET = 'l-secret-of-at-least-thirty-two-bytes!'

function lineProvider() {
  const { provider } = parseProviders({
    providers: authOptions.providers,
    url: 'https://app.staging.mumate.co/api/auth',
    providerId: 'line',
  } as any)
  return { ...provider, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET } as any
}

async function idToken(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: 'https://access.line.me', aud: CLIENT_ID, sub: 'U-test', iat: now, exp: now + 600, ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(CLIENT_SECRET))
}

let discover: ReturnType<typeof vi.spyOn<any, any>>
beforeEach(() => {
  discover = vi.spyOn(Issuer, 'discover').mockRejectedValue(new Error('discovery must not run'))
})
afterEach(() => {
  discover.mockRestore()
})

describe('LINE provider without discovery', () => {
  it('has no wellKnown, so next-auth never fetches access.line.me from the server', async () => {
    const provider = lineProvider()
    expect(provider.wellKnown).toBeUndefined()
    await openidClient({ provider } as any)
    expect(discover).not.toHaveBeenCalled()
  })

  it('builds the same client that discovery built: endpoints, issuer, token auth method, id_token alg', async () => {
    const ours = await openidClient({ provider: lineProvider() } as any)
    const theirs = new new Issuer(LINE_DISCOVERY).Client({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uris: ['https://app.staging.mumate.co/api/auth/callback/line'],
      id_token_signed_response_alg: 'HS256',
    })
    for (const key of ['issuer', 'authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'jwks_uri'] as const) {
      expect(ours.issuer.metadata[key]).toBe(theirs.issuer.metadata[key])
    }
    expect(ours.metadata.token_endpoint_auth_method).toBe(theirs.metadata.token_endpoint_auth_method)
    expect(ours.metadata.id_token_signed_response_alg).toBe('HS256')
  })

  it('keeps the user-facing authorize URL on access.line.me with disable_ios_auto_login', async () => {
    const provider = lineProvider()
    const client = await openidClient({ provider } as any)
    const url = new URL(client.authorizationUrl({ ...provider.authorization.params, state: 's' }))
    expect(`${url.origin}${url.pathname}`).toBe('https://access.line.me/oauth2/v2.1/authorize')
    expect(url.searchParams.get('disable_ios_auto_login')).toBe('true')
    expect(url.searchParams.get('scope')).toBe('openid profile')
  })

  it('accepts a LINE web-login id_token (HS256, iss access.line.me) at the callback', async () => {
    const provider = lineProvider()
    const client = await openidClient({ provider } as any)
    const token = await idToken({})
    client.grant = vi.fn().mockResolvedValue(new TokenSet({ access_token: 'a', token_type: 'Bearer', id_token: token }))
    const tokens = await client.callback(provider.callbackUrl, { code: 'c', state: 's' }, { state: 's' })
    expect(tokens.claims().sub).toBe('U-test')
  })

  it('still rejects an id_token from another issuer', async () => {
    const provider = lineProvider()
    const client = await openidClient({ provider } as any)
    const token = await idToken({ iss: 'https://evil.example' })
    client.grant = vi.fn().mockResolvedValue(new TokenSet({ access_token: 'a', token_type: 'Bearer', id_token: token }))
    await expect(client.callback(provider.callbackUrl, { code: 'c', state: 's' }, { state: 's' })).rejects.toThrow(/iss/)
  })
})
