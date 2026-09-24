// @vitest-environment node
//
// scripts/link-verify-default.test.ts — the REAL verifier (slice 3).
//
// §WHY node AND NOT jsdom. The suite default is jsdom, for React hooks. jose
// checks `instanceof Uint8Array`, and jsdom's TextEncoder returns one from a
// different realm, so a key built there fails a check that passes in production.
// This module only ever runs in the Node runtime of an API route, so the spec
// runs there too — testing it under jsdom would be testing a realm the code
// never meets.
//
// §WHY THIS FILE EXISTS. scripts/link-verify.test.ts injects `verifyToken` in
// every one of its cases, so it pins the claim-level rules and never executes
// `defaultVerify` — the one function that decides which algorithm and which key
// a provider's id_token is checked against. 2,945 specs were green, tsc and
// eslint were clean, and the first real LINE link still failed with `bad-token`,
// because `defaultVerify` asked a JWKS for a key to check an HMAC signature.
// A mechanism that no test executes is a mechanism nobody has tested. This file
// executes it, with tokens minted here rather than mocked away.
//
// Nothing here reaches a PROVIDER. LINE is symmetric, so no key is ever fetched.
// Google's key set IS fetched for real — from a server this file stands up on
// loopback — because the point of the Google cases is to execute
// `createRemoteJWKSet`, the fetch and the RS256 check rather than to mock them.
// The Google case rejected on its `alg` still fetches nothing: jose checks the
// algorithm allowlist before resolving a key, in both the cjs and esm builds
// (node_modules/jose/dist/node/*/jws/flattened/verify.js — the allowlist throw
// precedes the `await key(...)` call).
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultVerify, exchangeAndVerify } from '@/lib/auth/link-verify'
import { ENDPOINTS, LINKABLE } from '@/lib/auth/link-providers'

// A real LINE channel secret is 32 hex characters; HS256 needs at least 32 bytes,
// so the fixture is the same shape rather than a short placeholder.
const LINE_SECRET = '0123456789abcdef0123456789abcdef'
const ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'LINE_CLIENT_ID', 'LINE_CLIENT_SECRET'] as const
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))
  process.env.GOOGLE_CLIENT_ID = 'g-client'
  process.env.GOOGLE_CLIENT_SECRET = 'g-secret-0123456789abcdef01234567'
  process.env.LINE_CLIENT_ID = 'l-client'
  process.env.LINE_CLIENT_SECRET = LINE_SECRET
})
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

const LINE_ISS = 'https://access.line.me'

// §THE GOOGLE KEY SET, STOOD UP FOR THE WHOLE FILE — and it has to be the whole
// file, not one describe. `defaultVerify` passes `keySetFor(provider, jwksUrl)`
// as an ARGUMENT to jwtVerify, so the RemoteJWKSet is constructed — and cached
// under the provider — before jwtVerify runs, even for a token that is about to
// be rejected on its `alg`. Point the URL at this server only inside the Google
// describe and the cache is already holding one built from the real Google URL,
// which then serves no matching key. Constructing a RemoteJWKSet performs no
// request; the fetch happens on first key resolution, so the rejected-on-alg
// cases still reach no network.
let jwksServer: Server
let googleKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
let jwksServed = 0

// §READ AT IMPORT TIME, BEFORE THE SERVER REPLACES ONE OF THEM. The behaviour
// tests below borrow `ENDPOINTS.google.jwksUrl` to point at loopback, which means
// any test asserting on the LIVE value would be asserting on the borrowed one and
// could never notice the shipped config changing. Caught by mutation: setting
// google's real `jwksUrl` to null left the whole file green until these snapshots
// existed. Configuration is judged from here; behaviour from the live object.
const SHIPPED_JWKS_URL: Record<(typeof LINKABLE)[number], string | null> = {
  google: ENDPOINTS.google.jwksUrl,
  line: ENDPOINTS.line.jwksUrl,
}
const SHIPPED_ALGS: Record<(typeof LINKABLE)[number], readonly string[]> = {
  google: [...ENDPOINTS.google.idTokenAlgs],
  line: [...ENDPOINTS.line.idTokenAlgs],
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  googleKey = pair.privateKey
  const jwk = await exportJWK(pair.publicKey)
  const body = JSON.stringify({ keys: [{ ...jwk, kid: 'test-key-1', alg: 'RS256', use: 'sig' }] })
  jwksServer = createServer((_req, res) => {
    jwksServed += 1
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(body)
  })
  await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve))
  ENDPOINTS.google.jwksUrl = `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}/certs`
})

afterAll(async () => {
  ENDPOINTS.google.jwksUrl = SHIPPED_JWKS_URL.google
  await new Promise<void>((resolve) => jwksServer.close(() => resolve()))
})

/** A token shaped exactly like the one LINE's web login returns. */
function lineToken(
  over: { iss?: string; aud?: string; exp?: string | number; secret?: string; nonce?: string } = {},
) {
  return new SignJWT({ nonce: over.nonce ?? 'NONCE', name: 'Member', picture: 'https://cdn/p.png' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('U-line-subject')
    .setIssuedAt()
    .setIssuer(over.iss ?? LINE_ISS)
    .setAudience(over.aud ?? 'l-client')
    .setExpirationTime(over.exp ?? '5m')
    .sign(new TextEncoder().encode(over.secret ?? LINE_SECRET))
}

describe('defaultVerify — LINE signs with HS256, not with a key set', () => {
  it('ACCEPTS the HS256 token LINE actually issues for web login', async () => {
    const claims = await defaultVerify('line', await lineToken())
    expect(claims.sub).toBe('U-line-subject')
    expect(claims.nonce).toBe('NONCE')
  })

  it('REFUSES a token signed with a different secret', async () => {
    const forged = await lineToken({ secret: 'ffffffffffffffffffffffffffffffff' })
    await expect(defaultVerify('line', forged)).rejects.toThrow()
  })

  it('REFUSES an asymmetric token for LINE, so a key-set token cannot be substituted', async () => {
    const { privateKey } = await generateKeyPair('RS256')
    const rs = await new SignJWT({ nonce: 'NONCE' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('U-line-subject')
      .setIssuedAt()
      .setIssuer(LINE_ISS)
      .setAudience('l-client')
      .setExpirationTime('5m')
      .sign(privateKey)
    await expect(defaultVerify('line', rs)).rejects.toThrow()
  })

  it('REFUSES a wrong audience — a token minted for another channel', async () => {
    await expect(defaultVerify('line', await lineToken({ aud: 'someone-else' }))).rejects.toThrow()
  })

  it('REFUSES a wrong issuer', async () => {
    await expect(defaultVerify('line', await lineToken({ iss: 'https://evil.example' }))).rejects.toThrow()
  })

  it('REFUSES an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 60
    await expect(defaultVerify('line', await lineToken({ exp: past }))).rejects.toThrow()
  })
})

describe('defaultVerify — Google stays asymmetric', () => {
  it('REFUSES an HS256 token for Google, which is the algorithm-confusion attack', async () => {
    // Signed with Google's client secret: the closest an attacker gets without
    // the private key. It must be refused on the algorithm alone, before any key
    // is fetched — so this case also proves no network call is made.
    const hs = await new SignJWT({ nonce: 'NONCE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('g-subject')
      .setIssuedAt()
      .setIssuer('https://accounts.google.com')
      .setAudience('g-client')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(process.env.GOOGLE_CLIENT_SECRET as string))
    await expect(defaultVerify('google', hs)).rejects.toThrow()
  })
})

describe('the algorithm and the key material can never disagree', () => {
  // The defect was a shared allowlist that outlived the assumption behind it.
  // This pins the pairing itself, so a provider added later cannot repeat it.
  it.each(LINKABLE)('%s pairs a key source with algorithms that can use it', (provider) => {
    const jwksUrl = SHIPPED_JWKS_URL[provider]
    const idTokenAlgs = SHIPPED_ALGS[provider]
    expect(idTokenAlgs.length).toBeGreaterThan(0)
    const symmetric = idTokenAlgs.every((a) => a.startsWith('HS'))
    const asymmetric = idTokenAlgs.every((a) => a.startsWith('RS') || a.startsWith('ES'))
    // No provider may mix the two: one key source cannot serve both.
    expect(symmetric !== asymmetric).toBe(true)
    // A symmetric provider has no key set; an asymmetric one must have one.
    expect(jwksUrl === null).toBe(symmetric)
    // `none` can never appear, under any spelling.
    expect(idTokenAlgs.some((a) => a.toLowerCase() === 'none')).toBe(false)
  })

  it('keeps LINE on HS256 and Google on RS256 — the two this slice proved', () => {
    expect([...SHIPPED_ALGS.line]).toEqual(['HS256'])
    expect([...SHIPPED_ALGS.google]).toEqual(['RS256'])
    // LINE ships with no key set and Google ships with one. Asserted on the
    // shipped values, not the borrowed ones.
    expect(SHIPPED_JWKS_URL.line).toBeNull()
    expect(SHIPPED_JWKS_URL.google).toMatch(/^https:\/\//)
  })
})

describe('exchangeAndVerify end to end, with the real verifier', () => {
  it('links a LINE identity without verifyToken being injected anywhere', async () => {
    const id_token = await lineToken()
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id_token }) })) as unknown as typeof globalThis.fetch
    const r = await exchangeAndVerify(
      'line',
      { code: 'CODE', codeVerifier: 'VERIFIER', redirectUri: 'https://app/cb', nonce: 'NONCE' },
      { fetch: fetchMock },
    )
    expect(r).toEqual({
      ok: true,
      value: { subject: 'U-line-subject', email: '', name: 'Member', pictureUrl: 'https://cdn/p.png' },
    })
  })

  it('reports bad-token — not a crash — when LINE signs with an unexpected key', async () => {
    const id_token = await lineToken({ secret: 'ffffffffffffffffffffffffffffffff' })
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id_token }) })) as unknown as typeof globalThis.fetch
    const r = await exchangeAndVerify(
      'line',
      { code: 'CODE', codeVerifier: 'VERIFIER', redirectUri: 'https://app/cb', nonce: 'NONCE' },
      { fetch: fetchMock },
    )
    expect(r).toEqual({ ok: false, reason: 'bad-token' })
  })

  it('still catches a replayed nonce on the real path', async () => {
    const id_token = await lineToken({ nonce: 'A-DIFFERENT-NONCE' })
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id_token }) })) as unknown as typeof globalThis.fetch
    const r = await exchangeAndVerify(
      'line',
      { code: 'CODE', codeVerifier: 'VERIFIER', redirectUri: 'https://app/cb', nonce: 'NONCE' },
      { fetch: fetchMock },
    )
    expect(r).toEqual({ ok: false, reason: 'nonce-mismatch' })
  })
})

// §THE GOOGLE BRANCH, ACTUALLY EXECUTED (added 0.4 after the DoD audit).
//
// Everything above proves LINE, whose key is symmetric and needs no network. The
// audit found that Google's half — `createRemoteJWKSet`, the fetch, the RS256
// verification — was executed by NO test at all: its only case was an HS256
// token, which jose rejects on the `alg` header before it resolves a key. So the
// branch that runs in production for every Google link had never run once.
//
// Rather than mock jose (which would test the mock), this stands up a real HTTP
// server serving a real JWKS and points the provider's `jwksUrl` at it. The code
// under test is untouched: the same `createRemoteJWKSet`, the same fetch, the
// same signature check. Only the address changes.
describe('defaultVerify — Google fetches a key set and verifies RS256 with it', () => {
  const googleToken = (over: { iss?: string; aud?: string; exp?: string | number } = {}) =>
    new SignJWT({ nonce: 'NONCE', email: 'member@example.invalid', name: 'Member' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject('g-subject-1')
      .setIssuedAt()
      .setIssuer(over.iss ?? 'https://accounts.google.com')
      .setAudience(over.aud ?? 'g-client')
      .setExpirationTime(over.exp ?? '5m')
      .sign(googleKey)

  it('ACCEPTS an RS256 token whose key it had to go and fetch', async () => {
    const claims = await defaultVerify('google', await googleToken())
    expect(claims.sub).toBe('g-subject-1')
    // The key set was really retrieved over the wire, not read from a fixture.
    expect(jwksServed).toBeGreaterThan(0)
  })

  it('REFUSES a token signed by a key the published set does not contain', async () => {
    const stranger = await generateKeyPair('RS256')
    const forged = await new SignJWT({ nonce: 'NONCE' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject('g-subject-1')
      .setIssuedAt()
      .setIssuer('https://accounts.google.com')
      .setAudience('g-client')
      .setExpirationTime('5m')
      .sign(stranger.privateKey)
    await expect(defaultVerify('google', forged)).rejects.toThrow()
  })

  it('REFUSES a wrong audience — a token minted for a different client', async () => {
    await expect(defaultVerify('google', await googleToken({ aud: 'someone-else' }))).rejects.toThrow()
  })

  it('REFUSES a wrong issuer', async () => {
    await expect(defaultVerify('google', await googleToken({ iss: 'https://evil.example' }))).rejects.toThrow()
  })

  it('REFUSES an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 60
    await expect(defaultVerify('google', await googleToken({ exp: past }))).rejects.toThrow()
  })

  it('accepts the OTHER issuer spelling Google also mints under', async () => {
    const claims = await defaultVerify('google', await googleToken({ iss: 'accounts.google.com' }))
    expect(claims.sub).toBe('g-subject-1')
  })
})
