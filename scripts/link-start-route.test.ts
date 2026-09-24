// scripts/link-start-route.test.ts — pages/api/auth/link/start/[provider].ts (slice 3).
//
// The route is thin, but three of its behaviours are load-bearing and none of them
// is visible from the pure modules: it must use the STRICT resolver so a forged
// member cookie cannot start a link, it must set the state cookie in the SAME
// response as the redirect, and it must refuse rather than escort when Google is
// asked for from inside the LINE webview.
import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolveSignedSessionUserId = vi.fn()
const resolveSessionUserId = vi.fn()

vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSignedSessionUserId: (...a: unknown[]) => resolveSignedSessionUserId(...a),
  resolveSessionUserId: (...a: unknown[]) => resolveSessionUserId(...a),
}))

import handler from '@/pages/api/auth/link/start/[provider]'

const USER = '4a2f2a1e-0000-4000-8000-000000000001'

interface Captured {
  status: number | null
  json: unknown
  redirect: string | null
  headers: Record<string, string>
}

function call(
  query: Record<string, string>,
  opts: { method?: string; userAgent?: string } = {},
): Promise<Captured> {
  const out: Captured = { status: null, json: null, redirect: null, headers: {} }
  const req = {
    method: opts.method ?? 'GET',
    query,
    headers: { 'user-agent': opts.userAgent ?? 'Mozilla/5.0 Safari/605.1.15' },
    cookies: {},
  } as unknown as NextApiRequest
  const res = {
    setHeader: (k: string, v: string) => {
      out.headers[k.toLowerCase()] = String(v)
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

const ENV = ['LINK_STATE_SECRET', 'GOOGLE_CLIENT_ID', 'LINE_CLIENT_ID', 'NEXTAUTH_URL'] as const
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))
  process.env.LINK_STATE_SECRET = 'test-secret'
  process.env.GOOGLE_CLIENT_ID = 'g-client'
  process.env.LINE_CLIENT_ID = 'l-client'
  process.env.NEXTAUTH_URL = 'https://app.staging.mumate.co'
  resolveSignedSessionUserId.mockReset()
  resolveSessionUserId.mockReset()
  resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: USER })
})
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('identity', () => {
  it('uses the STRICT resolver, never the one with the forgeable cookie fallback', async () => {
    await call({ provider: 'line' })
    expect(resolveSignedSessionUserId).toHaveBeenCalledTimes(1)
    expect(resolveSessionUserId).not.toHaveBeenCalled()
  })

  it('sends an unauthenticated caller back with not_signed_in and mints NO state', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 401, error: 'not signed in' })
    const r = await call({ provider: 'line' })
    expect(r.status).toBe(302)
    expect(r.redirect).toContain('link_error=not_signed_in')
    expect(r.headers['set-cookie']).toBeUndefined()
  })

  it('refuses an ambiguous identity rather than guessing which member to link to', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 409, error: 'identity is ambiguous' })
    const r = await call({ provider: 'line' })
    expect(r.redirect).toContain('link_error=identity_unresolved')
    expect(r.headers['set-cookie']).toBeUndefined()
  })
})

describe('owner decision 7 — Google from inside the LINE webview', () => {
  it('refuses to start, and mints no state, so nothing is half-begun', async () => {
    const r = await call({ provider: 'google' }, { userAgent: 'Mozilla/5.0 (iPhone) Line/13.5.0' })
    expect(r.status).toBe(302)
    expect(r.redirect).toContain('link_error=line-webview-google')
    expect(r.redirect).not.toContain('accounts.google.com')
    expect(r.headers['set-cookie']).toBeUndefined()
  })

  it('still allows LINE from inside the LINE webview', async () => {
    const r = await call({ provider: 'line' }, { userAgent: 'Mozilla/5.0 (iPhone) Line/13.5.0' })
    expect(r.redirect).toContain('access.line.me')
  })
})

describe('the happy path', () => {
  it('redirects to the provider and sets the state cookie in the SAME response', async () => {
    const r = await call({ provider: 'line' })
    expect(r.status).toBe(302)
    expect(r.redirect).toContain('https://access.line.me/oauth2/v2.1/authorize')
    const cookie = r.headers['set-cookie']
    expect(cookie).toBeDefined()
    expect(cookie).toContain('mumate_link_line=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('SameSite=None')
  })

  it('the state in the URL is the state in the cookie, not a second unrelated value', async () => {
    const r = await call({ provider: 'line' })
    const urlState = new URL(r.redirect as string).searchParams.get('state') as string
    const cookieValue = (r.headers['set-cookie'] as string).split(';')[0].split('=')[1]
    const payload = JSON.parse(
      Buffer.from(cookieValue.split('.')[0], 'base64url').toString('utf8'),
    ) as { s: string; u: string }
    expect(payload.s).toBe(urlState)
    expect(payload.u).toBe(USER)
  })

  it('never caches — a cached redirect would reuse a spent state', async () => {
    const r = await call({ provider: 'line' })
    expect(r.headers['cache-control']).toContain('no-store')
  })

  it('carries a same-site return_to through, and drops a hostile one', async () => {
    const ok = await call({ provider: 'line', return_to: '/v2/account' })
    const okState = (ok.headers['set-cookie'] as string).split(';')[0].split('=')[1]
    expect(JSON.parse(Buffer.from(okState.split('.')[0], 'base64url').toString('utf8')).r).toBe('/v2/account')

    const bad = await call({ provider: 'line', return_to: 'https://evil.example' })
    const badState = (bad.headers['set-cookie'] as string).split(';')[0].split('=')[1]
    expect(JSON.parse(Buffer.from(badState.split('.')[0], 'base64url').toString('utf8')).r).toBe(
      '/v2/settings/connected',
    )
  })
})

describe('refusals that are not about identity', () => {
  it.each(['facebook', 'apple', 'phone', 'dev', 'nonsense'])('404s unknown provider %p', async (p) => {
    const r = await call({ provider: p })
    expect(r.status).toBe(404)
    expect(r.headers['set-cookie']).toBeUndefined()
  })

  it.each(['POST', 'DELETE', 'PUT'])('405s %s and advertises GET', async (method) => {
    const r = await call({ provider: 'line' }, { method })
    expect(r.status).toBe(405)
    expect(r.headers['allow']).toBe('GET')
  })

  it('fails closed when LINK_STATE_SECRET is missing, rather than starting an unsigned flow', async () => {
    delete process.env.LINK_STATE_SECRET
    const r = await call({ provider: 'line' })
    expect(r.redirect).toContain('link_error=link_unavailable')
    expect(r.redirect).not.toContain('access.line.me')
    expect(r.headers['set-cookie']).toBeUndefined()
  })

  it('fails closed when NEXTAUTH_URL is missing, rather than sending a wrong redirect_uri', async () => {
    delete process.env.NEXTAUTH_URL
    const r = await call({ provider: 'line' })
    expect(r.redirect).toContain('link_error=link_unavailable')
    expect(r.headers['set-cookie']).toBeUndefined()
  })
})
