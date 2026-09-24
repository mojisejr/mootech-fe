// scripts/link-connections-route.test.ts — the read and unlink endpoints, plus the
// summary the screen renders from (mumate-login-identity-001 slice 3).
import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { summariseConnections } from '@/lib/auth/link-account'

const resolveSessionUserId = vi.fn()
const resolveSignedSessionUserId = vi.fn()
const readMemberProviders = vi.fn()
const unlinkProvider = vi.fn()
const getServerSession = vi.fn()

vi.mock('@/lib/v2/resolve-user', () => ({
  resolveSessionUserId: (...a: unknown[]) => resolveSessionUserId(...a),
  resolveSignedSessionUserId: (...a: unknown[]) => resolveSignedSessionUserId(...a),
}))
vi.mock('@/lib/auth/link-account-store', () => ({
  readMemberProviders: (...a: unknown[]) => readMemberProviders(...a),
  postgresLinkStore: { transaction: vi.fn() },
}))
vi.mock('next-auth/next', () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }))
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))

import connections from '@/pages/api/auth/link/connections'
import unlinkRoute from '@/pages/api/auth/link/unlink/[provider]'

vi.mock('@/lib/auth/link-account', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, unlinkProvider: (...a: unknown[]) => unlinkProvider(...a) }
})

const USER = 'aaaaaaaa-0000-4000-8000-000000000001'

interface Out {
  status: number | null
  json: Record<string, unknown> | null
  headers: Record<string, string>
}

function invoke(
  fn: (q: NextApiRequest, s: NextApiResponse) => Promise<unknown>,
  req: Partial<NextApiRequest>,
): Promise<Out> {
  const out: Out = { status: null, json: null, headers: {} }
  const res = {
    setHeader: (k: string, v: string) => {
      out.headers[k.toLowerCase()] = String(v)
    },
    status: (c: number) => {
      out.status = c
      return res
    },
    json: (b: unknown) => {
      out.json = b as Record<string, unknown>
      return res
    },
  } as unknown as NextApiResponse
  return fn({ query: {}, cookies: {}, headers: {}, ...req } as NextApiRequest, res).then(() => out)
}

beforeEach(() => {
  resolveSessionUserId.mockReset()
  resolveSignedSessionUserId.mockReset()
  readMemberProviders.mockReset()
  unlinkProvider.mockReset()
  getServerSession.mockReset()
  resolveSessionUserId.mockResolvedValue({ ok: true, userId: USER })
  resolveSignedSessionUserId.mockResolvedValue({ ok: true, userId: USER })
  getServerSession.mockResolvedValue({ provider: 'line' })
  readMemberProviders.mockResolvedValue([{ id: '1', userId: USER, provider: 'LINE' }])
})

describe('summariseConnections — what the screen renders from', () => {
  it('reports a second linked provider as linked, which the screen cannot do today', () => {
    const s = summariseConnections(
      [
        { provider: 'LINE' },
        { provider: 'google' },
      ],
      'line',
    )
    expect(s.find((x) => x.provider === 'google')?.linked).toBe(true)
    expect(s.find((x) => x.provider === 'google')?.current).toBe(false)
    expect(s.find((x) => x.provider === 'line')?.current).toBe(true)
  })

  it('matches lower-case session provider against upper-case stored LINE', () => {
    const s = summariseConnections([{ provider: 'LINE' }], 'line')
    expect(s.find((x) => x.provider === 'line')?.linked).toBe(true)
  })

  it('forbids unlinking the only method, and allows it once there are two', () => {
    const one = summariseConnections([{ provider: 'LINE' }], 'line')
    expect(one.find((x) => x.provider === 'line')?.canUnlink).toBe(false)

    const two = summariseConnections([{ provider: 'LINE' }, { provider: 'google' }], 'line')
    expect(two.every((x) => x.canUnlink)).toBe(true)
  })

  it('several rows of ONE provider are still one method — the shape 1,443 members are in', () => {
    const s = summariseConnections([{ provider: 'google' }, { provider: 'google' }], 'google')
    expect(s.find((x) => x.provider === 'google')?.canUnlink).toBe(false)
  })

  it('offers exactly the two providers the contract covers — no Apple, no phone', () => {
    // The server decides this list, not the screen: ConnectedScreen renders whatever
    // comes back, so adding a provider here is what would put it on the page.
    const s = summariseConnections([{ provider: 'LINE' }], 'line')
    expect(s.map((x) => x.provider).sort()).toEqual(['google', 'line'])
  })

  it('never invents a provider that is not linked', () => {
    const s = summariseConnections([{ provider: 'LINE' }], 'line')
    expect(s.find((x) => x.provider === 'google')).toMatchObject({ linked: false, canUnlink: false })
  })

  it('ignores blank provider rows rather than counting them as a method', () => {
    const s = summariseConnections([{ provider: 'LINE' }, { provider: '  ' }], 'line')
    expect(s.find((x) => x.provider === 'line')?.canUnlink).toBe(false)
  })
})

describe('GET /api/auth/link/connections', () => {
  it('returns the summary and nothing that could identify a credential', async () => {
    readMemberProviders.mockResolvedValue([
      { id: 'row-1', userId: USER, provider: 'LINE' },
      { id: 'row-2', userId: USER, provider: 'google' },
    ])
    const r = await invoke(connections, { method: 'GET' })
    expect(r.status).toBe(200)
    const body = JSON.stringify(r.json)
    expect(r.json?.ok).toBe(true)
    expect(body).not.toContain('row-1')
    expect(body).not.toContain(USER)
  })

  it('never caches — a stale answer would show a link that was just removed', async () => {
    const r = await invoke(connections, { method: 'GET' })
    expect(r.headers['cache-control']).toContain('no-store')
  })

  it('passes the caller\'s 401 straight through', async () => {
    resolveSessionUserId.mockResolvedValue({ ok: false, status: 401, error: 'not signed in' })
    const r = await invoke(connections, { method: 'GET' })
    expect(r.status).toBe(401)
  })

  it.each(['POST', 'DELETE'])('405s %s', async (method) => {
    const r = await invoke(connections, { method })
    expect(r.status).toBe(405)
    expect(r.headers['allow']).toBe('GET')
  })

  it('answers 500 rather than leaking a driver message when the read fails', async () => {
    readMemberProviders.mockRejectedValue(new Error('relation "user_provider" does not exist'))
    const r = await invoke(connections, { method: 'GET' })
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.json)).not.toContain('relation')
  })
})

describe('DELETE /api/auth/link/unlink/<provider>', () => {
  it('uses the STRICT resolver — unlink removes a credential', async () => {
    unlinkProvider.mockResolvedValue({ status: 'unlinked', removed: 1 })
    await invoke(unlinkRoute, { method: 'DELETE', query: { provider: 'google' } })
    expect(resolveSignedSessionUserId).toHaveBeenCalledTimes(1)
    expect(resolveSessionUserId).not.toHaveBeenCalled()
  })

  it('removes the provider and reports how many rows went', async () => {
    unlinkProvider.mockResolvedValue({ status: 'unlinked', removed: 2 })
    const r = await invoke(unlinkRoute, { method: 'DELETE', query: { provider: 'google' } })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ ok: true, unlinked: 'google', removed: 2 })
  })

  it('409s the last method — the request is fine, the account state forbids it', async () => {
    unlinkProvider.mockResolvedValue({ status: 'last-method' })
    const r = await invoke(unlinkRoute, { method: 'DELETE', query: { provider: 'line' } })
    expect(r.status).toBe(409)
    expect(r.json).toMatchObject({ error: 'last_method' })
  })

  it('404s a provider that was never linked', async () => {
    unlinkProvider.mockResolvedValue({ status: 'not-linked' })
    const r = await invoke(unlinkRoute, { method: 'DELETE', query: { provider: 'google' } })
    expect(r.status).toBe(404)
  })

  it('refuses an unauthenticated caller before touching the store', async () => {
    resolveSignedSessionUserId.mockResolvedValue({ ok: false, status: 401, error: 'not signed in' })
    const r = await invoke(unlinkRoute, { method: 'DELETE', query: { provider: 'google' } })
    expect(r.status).toBe(401)
    expect(unlinkProvider).not.toHaveBeenCalled()
  })

  it.each(['GET', 'POST'])('405s %s, so a link cannot be removed by navigation', async (method) => {
    const r = await invoke(unlinkRoute, { method, query: { provider: 'google' } })
    expect(r.status).toBe(405)
    expect(unlinkProvider).not.toHaveBeenCalled()
  })

  it.each(['apple', 'phone', 'facebook'])('404s unlinkable provider %p', async (p) => {
    const r = await invoke(unlinkRoute, { method: 'DELETE', query: { provider: p } })
    expect(r.status).toBe(404)
    expect(unlinkProvider).not.toHaveBeenCalled()
  })
})
