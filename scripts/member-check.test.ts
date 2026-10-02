// mumate-member-identity-hardening-001 slice 1 — members whose browser holds cookie-mumate-id but no
// NextAuth session must reach sign-in once, not sit on "ยืนยันตัวตนไม่ได้".
//
// The client calls a member "authed" whenever cookie-mumate-id is a UUID (lib/auth/resolve-auth.ts),
// with or without a session. Since the #391 fallback now needs the member seal, a session-less browser
// without one would look signed in to the app and be refused by every route. The check asks the server
// once; only a definite 401 clears the MEMBER_* cookies, which makes the member "anon" and lets the
// normal gates send them to sign in.
//
// 🔴 MUTANT CONTRACT:
//   C1  the endpoint answers ok without resolving identity            → the 401 endpoint test reddens
//   C2  the endpoint returns the user_id                              → the no-disclosure test reddens
//   C3  the hook clears cookies on a non-401 (404/409/500/network)    → the keep test reddens
//   C4  the hook runs while a session exists                          → the authenticated test reddens
//   C5  the hook never clears on 401                                  → the clear test reddens
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const h = vi.hoisted(() => ({
  resolved: { ok: true, userId: '11111111-2222-4333-8444-555555555555' } as
    | { ok: true; userId: string }
    | { ok: false; status: 401 | 404 | 409; error: string },
  session: { status: 'unauthenticated' as string },
  cookies: { 'cookie-mumate-id': '11111111-2222-4333-8444-555555555555' } as Record<string, string>,
  removeCookie: vi.fn(),
}))

vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.resolved) }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: h.session.status }) }))
vi.mock('react-cookie', () => ({ useCookies: () => [h.cookies, vi.fn(), h.removeCookie] }))

import memberCheckHandler from '@/pages/api/auth/member-check'
import { useUnsealedMemberCheck } from '@/lib/auth/use-unsealed-member-check'

function invoke(method = 'GET') {
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, unknown> }
  const res = {
    setHeader: (n: string, v: unknown) => {
      out.headers[n.toLowerCase()] = v
      return res
    },
    getHeader: (n: string) => out.headers[n.toLowerCase()],
    status(c: number) {
      out.status = c
      return res
    },
    json(b: unknown) {
      out.body = b
      return res
    },
    end() {
      return res
    },
  }
  return { p: memberCheckHandler({ method, cookies: {} } as never, res as never), out }
}

describe('GET /api/auth/member-check', () => {
  beforeEach(() => {
    h.resolved = { ok: true, userId: '11111111-2222-4333-8444-555555555555' }
  })

  it('a resolved member ⇒ 204, no-store, and C2 — no user_id in the answer', async () => {
    const { p, out } = invoke()
    await p
    expect(out.status).toBe(204)
    expect(out.headers['cache-control']).toBe('no-store')
    expect(JSON.stringify(out.body ?? '')).not.toContain('11111111')
  })

  it('C1 — the resolver refuses ⇒ the same status, never 204', async () => {
    for (const status of [401, 404, 409] as const) {
      h.resolved = { ok: false, status, error: 'x' }
      const { p, out } = invoke()
      await p
      expect(out.status).toBe(status)
    }
  })

  it('non-GET ⇒ 405', async () => {
    const { p, out } = invoke('POST')
    await p
    expect(out.status).toBe(405)
  })
})

describe('useUnsealedMemberCheck', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))

  beforeEach(() => {
    h.session.status = 'unauthenticated'
    h.cookies = { 'cookie-mumate-id': '11111111-2222-4333-8444-555555555555' }
    h.removeCookie.mockClear()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('C5 — no session + cookie + server says 401 ⇒ MEMBER_* cookies are cleared', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 401 }))
    renderHook(() => useUnsealedMemberCheck())
    await vi.waitFor(() => expect(h.removeCookie).toHaveBeenCalledWith('cookie-mumate-id', { path: '/' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/member-check', { credentials: 'same-origin' })
    expect(h.removeCookie).toHaveBeenCalledWith('cookie-mumate-name', { path: '/' })
  })

  it('C3 — 204, 404, 409, 500 or a network failure keep the cookies', async () => {
    for (const make of [204, 404, 409, 500].map((s) => async () => new Response(null, { status: s })).concat(
      async () => {
        throw new Error('offline')
      },
    )) {
      fetchMock.mockImplementation(make)
      renderHook(() => useUnsealedMemberCheck())
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
      await new Promise((r) => setTimeout(r, 10))
      fetchMock.mockClear()
    }
    expect(h.removeCookie).not.toHaveBeenCalled()
  })

  it('C4 — with a session (or while it loads) nothing is asked', async () => {
    for (const status of ['authenticated', 'loading']) {
      h.session.status = status
      renderHook(() => useUnsealedMemberCheck())
    }
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no member cookie (or not a UUID) ⇒ nothing is asked', async () => {
    for (const cookies of [{}, { 'cookie-mumate-id': 'ya29.token' }]) {
      h.cookies = cookies
      renderHook(() => useUnsealedMemberCheck())
    }
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
