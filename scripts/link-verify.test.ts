// scripts/link-verify.test.ts — lib/auth/link-verify.ts (slice 3).
// The token exchange and the id_token checks. Verification is injected so the
// claim-level rules can be pinned without reaching a provider; the real verifier
// is jose, which is exercised by its own test suite and by the live round trip.
import type { JWTPayload } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exchangeAndVerify, LINK_TOKEN_EXCHANGE_TIMEOUT_MS } from '@/lib/auth/link-verify'

const ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'LINE_CLIENT_ID', 'LINE_CLIENT_SECRET'] as const
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))
  process.env.GOOGLE_CLIENT_ID = 'g-client'
  process.env.GOOGLE_CLIENT_SECRET = 'g-secret'
  process.env.LINE_CLIENT_ID = 'l-client'
  process.env.LINE_CLIENT_SECRET = 'l-secret'
})
afterEach(() => {
  vi.useRealTimers()
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

const ARGS = { code: 'CODE', codeVerifier: 'VERIFIER', redirectUri: 'https://app/cb', nonce: 'NONCE' }

function tokenResponse(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => body })) as unknown as typeof globalThis.fetch
}

function claims(over: Partial<JWTPayload> = {}): JWTPayload {
  return { sub: 'subject-1', nonce: 'NONCE', ...over }
}

describe('the code exchange', () => {
  it('sends PKCE, the client secret and the exact redirect_uri', async () => {
    const fetchMock = tokenResponse({ id_token: 't' })
    await exchangeAndVerify('google', ARGS, {
      fetch: fetchMock,
      verifyToken: async () => claims(),
    })
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const sent = new URLSearchParams((init as { body: string }).body)
    expect(sent.get('grant_type')).toBe('authorization_code')
    expect(sent.get('code')).toBe('CODE')
    expect(sent.get('code_verifier')).toBe('VERIFIER')
    expect(sent.get('client_secret')).toBe('g-secret')
    expect(sent.get('redirect_uri')).toBe('https://app/cb')
  })

  it('reports a failed exchange rather than continuing with nothing', async () => {
    const r = await exchangeAndVerify('google', ARGS, {
      fetch: tokenResponse({}, false),
      verifyToken: async () => claims(),
    })
    expect(r).toEqual({ ok: false, reason: 'token-exchange-failed' })
  })

  it('survives a network throw as a refusal, not an unhandled rejection', async () => {
    const boom = vi.fn(async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof globalThis.fetch
    const r = await exchangeAndVerify('google', ARGS, { fetch: boom, verifyToken: async () => claims() })
    expect(r).toEqual({ ok: false, reason: 'token-exchange-failed' })
  })

  it('aborts a hung LINE exchange before the proxy deadline', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
    ) as unknown as typeof globalThis.fetch

    const pending = exchangeAndVerify('line', ARGS, { fetch: fetchMock, verifyToken: async () => claims() })
    await vi.advanceTimersByTimeAsync(LINK_TOKEN_EXCHANGE_TIMEOUT_MS)

    await expect(pending).resolves.toEqual({ ok: false, reason: 'token-exchange-failed' })
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect((init as RequestInit).signal?.aborted).toBe(true)
  })

  it.each([{}, { id_token: '' }, { id_token: 42 }])('refuses a response without a usable id_token: %p', async (body) => {
    const r = await exchangeAndVerify('google', ARGS, {
      fetch: tokenResponse(body),
      verifyToken: async () => claims(),
    })
    expect(r).toEqual({ ok: false, reason: 'no-id-token' })
  })

  it('never calls the verifier when the exchange failed', async () => {
    const verifyToken = vi.fn(async () => claims())
    await exchangeAndVerify('google', ARGS, { fetch: tokenResponse({}, false), verifyToken })
    expect(verifyToken).not.toHaveBeenCalled()
  })
})

describe('a token that does not verify is refused', () => {
  it('a bad signature, issuer, audience, expiry or algorithm all come back as bad-token', async () => {
    const r = await exchangeAndVerify('google', ARGS, {
      fetch: tokenResponse({ id_token: 't' }),
      verifyToken: async () => {
        throw new Error('signature verification failed')
      },
    })
    expect(r).toEqual({ ok: false, reason: 'bad-token' })
  })

  it('does not leak which check failed — that helps an attacker and not a member', async () => {
    const r = await exchangeAndVerify('google', ARGS, {
      fetch: tokenResponse({ id_token: 't' }),
      verifyToken: async () => {
        throw new Error('unexpected "aud" claim value: attacker-client-id')
      },
    })
    expect(JSON.stringify(r)).not.toContain('attacker-client-id')
    expect(JSON.stringify(r)).not.toContain('aud')
  })
})

describe('the nonce is checked here, because jose does not check it', () => {
  it('refuses a token whose nonce belongs to a different request', async () => {
    const r = await exchangeAndVerify('google', ARGS, {
      fetch: tokenResponse({ id_token: 't' }),
      verifyToken: async () => claims({ nonce: 'SOMEONE-ELSES-NONCE' }),
    })
    expect(r).toEqual({ ok: false, reason: 'nonce-mismatch' })
  })

  it('refuses a token with NO nonce, rather than treating absent as matching', async () => {
    const r = await exchangeAndVerify('google', ARGS, {
      fetch: tokenResponse({ id_token: 't' }),
      verifyToken: async () => {
        const c = claims()
        delete c.nonce
        return c
      },
    })
    expect(r).toEqual({ ok: false, reason: 'nonce-mismatch' })
  })
})

describe('the subject', () => {
  it('is required — a token without one cannot identify anybody', async () => {
    const r = await exchangeAndVerify('google', ARGS, {
      fetch: tokenResponse({ id_token: 't' }),
      verifyToken: async () => claims({ sub: '' }),
    })
    expect(r).toEqual({ ok: false, reason: 'no-subject' })
  })

  it('is returned with the profile fields, all normalised to strings', async () => {
    const r = await exchangeAndVerify('google', ARGS, {
      fetch: tokenResponse({ id_token: 't' }),
      verifyToken: async () =>
        claims({ sub: ' 1234567890 ', email: ' a@b.c ', name: ' Nonthasak ', picture: ' https://cdn/x ' }),
    })
    expect(r).toEqual({
      ok: true,
      value: { subject: '1234567890', email: 'a@b.c', name: 'Nonthasak', pictureUrl: 'https://cdn/x' },
    })
  })

  it('missing profile fields become empty strings, never undefined or null', async () => {
    const r = await exchangeAndVerify('line', ARGS, {
      fetch: tokenResponse({ id_token: 't' }),
      verifyToken: async () => claims({ sub: 'U-1' }),
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.email).toBe('')
    expect(r.value.name).toBe('')
    expect(r.value.pictureUrl).toBe('')
  })
})

describe('the provider decides the token endpoint', () => {
  it('LINE exchanges at LINE, not at Google', async () => {
    const fetchMock = tokenResponse({ id_token: 't' })
    await exchangeAndVerify('line', ARGS, { fetch: fetchMock, verifyToken: async () => claims({ sub: 'U' }) })
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://api.line.me/oauth2/v2.1/token')
  })
})
