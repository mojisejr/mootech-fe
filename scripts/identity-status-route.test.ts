// scripts/identity-status-route.test.ts — GET /api/auth/identity-status
// (mumate-login-identity-001 slice 5). Strict resolution, the switch, and nothing
// disclosed beyond the caller's own yes/no.
import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getServerSession, resolveSignedSessionUserId, resolveSessionUserId } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveSignedSessionUserId: vi.fn(),
  resolveSessionUserId: vi.fn(),
}))

vi.mock('next-auth/next', () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }))
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))
vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSignedSessionUserId: (...a: unknown[]) => resolveSignedSessionUserId(...a),
  resolveSessionUserId: (...a: unknown[]) => resolveSessionUserId(...a),
}))

import handler from '@/pages/api/auth/identity-status'

async function call(method = 'GET') {
  const out: { status: number | null; json: any; headers: Record<string, string> } = { status: null, json: null, headers: {} }
  const req = { method, query: {}, headers: {}, cookies: {} } as unknown as NextApiRequest
  const res = {
    setHeader: (k: string, v: string) => void (out.headers[k.toLowerCase()] = String(v)),
    status: (c: number) => ((out.status = c), res),
    json: (b: unknown) => ((out.json = b), res),
  } as unknown as NextApiResponse
  await handler(req, res)
  return out
}

beforeEach(() => {
  getServerSession.mockReset()
  resolveSignedSessionUserId.mockReset()
  resolveSessionUserId.mockReset()
  process.env.LOGIN_ASK_BEFORE_CREATE = 'on'
})
afterEach(() => {
  delete process.env.LOGIN_ASK_BEFORE_CREATE
})

describe('GET /api/auth/identity-status', () => {
  it('an unowned identity with the switch on → ask, and no user_id in the body', async () => {
    getServerSession.mockResolvedValue({ provider: 'google', providerId: '1' })
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 404, error: 'no account' })
    const r = await call()
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ signedIn: true, known: false, ask: true, provider: 'google' })
    expect(r.headers['cache-control']).toBe('no-store')
  })

  it('a known identity → known, never ask, and the user_id is NOT returned', async () => {
    getServerSession.mockResolvedValue({ provider: 'line', providerId: 'U1' })
    resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: 'secret-user-id' })
    const r = await call()
    expect(r.json).toEqual({ signedIn: true, known: true, ask: false, provider: 'line' })
    expect(JSON.stringify(r.json)).not.toContain('secret-user-id')
  })

  it('switch off → never ask (D7)', async () => {
    delete process.env.LOGIN_ASK_BEFORE_CREATE
    getServerSession.mockResolvedValue({ provider: 'google', providerId: '1' })
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 404 })
    expect((await call()).json.ask).toBe(false)
  })

  it('uses STRICT resolution only — the forgeable MEMBER_ID fallback is never consulted', async () => {
    getServerSession.mockResolvedValue({ provider: 'google', providerId: '1' })
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 404 })
    await call()
    expect(resolveSignedSessionUserId).toHaveBeenCalledTimes(1)
    expect(resolveSessionUserId).not.toHaveBeenCalled()
  })

  it('no session → signed out, nothing resolved', async () => {
    getServerSession.mockResolvedValue(null)
    const r = await call()
    expect(r.json).toMatchObject({ signedIn: false, ask: false })
    expect(resolveSignedSessionUserId).not.toHaveBeenCalled()
  })

  it('a failure answers 500 with ask:false, so the client falls back to today', async () => {
    getServerSession.mockRejectedValue(new Error('boom'))
    const r = await call()
    expect(r.status).toBe(500)
    expect(r.json.ask).toBe(false)
  })

  it('GET only', async () => {
    expect((await call('POST')).status).toBe(405)
  })
})
