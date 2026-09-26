// scripts/identity-yes-seam.test.tsx — the "yes" path across the provider switch, walked the
// way the owner walked it on 2026-09-26 (mumate-login-identity-001 slice 5, decision 23).
//
// What the unit tests could not see: every piece was right, and the member still landed
// on "ไม่พบข้อมูลผู้ใช้" because nothing minted MEMBER_ID between the provider switch and
// the connected screen. So this test keeps the REAL question screen with its REAL default
// deps (hold, attach, mint), the REAL connected screen, a cookie jar the browser would
// keep, and fakes only the network edge — including /api/profile's actual rule: 401
// unless cookie-mumate-id is a UUID.
//
// 🔴 MUTANT CONTRACT: drop the mint (Fix A) AND the belt → "the connected screen shows the
// member, not the not-found card" red. Drop the hold → "Google is asked once" red.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

const { routerState, sessionState, jar, server } = vi.hoisted(() => ({
  routerState: { isReady: true, query: {} as Record<string, string> },
  sessionState: { data: null as any },
  jar: new Map<string, string>(),
  server: {
    // what the server knows: which identities have an owner
    owners: new Map<string, string>(),
    heldCookie: false,
    linked: [] as string[],
    oauthStarts: [] as string[],
  },
}))

vi.mock('next/router', () => ({ useRouter: () => routerState }))
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/head', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: sessionState.data, status: 'authenticated' }) }))
vi.mock('@/features/v2-shell/components/FullBleedScreen', () => ({
  FullBleedScreen: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('react-cookie', async () => {
  const React = await import('react')
  return {
    useCookies: () => {
      const [, force] = React.useState(0)
      const cookies = Object.fromEntries(jar)
      const set = (k: string, v: string) => {
        jar.set(k, String(v))
        force((n) => n + 1)
      }
      return [cookies, set, (k: string) => jar.delete(k)]
    },
  }
})
// The BE register-login: for a KNOWN identity it logs in and returns the member.
vi.mock('@/constants/api/api-user-register-or-login', () => ({
  UserRegisterOrLogin: async (idToken: string, _i: string, _n: string, _r: string, _e: string, provider: string) => {
    const owner = server.owners.get(`${provider.toLowerCase()}:${idToken}`)
    return owner ? { user_id: owner, ref_code: 'R1', name: 'n', picture_url: '' } : { user_id: 'SHOULD-NOT-CREATE' }
  },
}))
vi.mock('@/constants/api/api-user-get', () => ({ UserGetById: async () => ({ refer_code: 'R1' }) }))

import {
  IdentityChoiceScreen,
  defaultIdentityChoiceDeps,
  type IdentityChoiceDeps,
} from '@/features/auth/components/IdentityChoiceScreen'
import { ConnectedScreen } from '@/features/v2-account/components/ConnectedScreen'

const MEMBER_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const GOOGLE = '109876543210987654321'
const LINE = 'U'.padEnd(33, 'a')
const UUID = /^[0-9a-f-]{36}$/i

function sessionKey(): string {
  const s = sessionState.data
  return `${String(s.provider).toLowerCase()}:${s.providerId}`
}

function installServer() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const json = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body })
    if (url === '/api/auth/identity-status') {
      const known = server.owners.has(sessionKey())
      return json({ signedIn: true, known, ask: !known, provider: String(sessionState.data.provider).toLowerCase() })
    }
    if (url === '/api/auth/identity-hold' && method === 'POST') {
      if (server.owners.has(sessionKey())) return json({ ok: false }, 409)
      server.heldCookie = true
      return json({ ok: true })
    }
    if (url === '/api/auth/identity-attach' && method === 'POST') {
      const had = server.heldCookie
      server.heldCookie = false
      if (!had) return json({ ok: false, error: 'no_hold' }, 409)
      const owner = server.owners.get(sessionKey())
      if (!owner) return json({ ok: false, error: 'identity_unresolved' }, 409)
      server.owners.set(`google:${GOOGLE}`, owner)
      server.linked.push('google')
      return json({ ok: true, linked: 'google' })
    }
    // /api/profile's real rule (pages/api/profile.ts): the MEMBER_ID cookie, nothing else
    if (url === '/api/profile') {
      return UUID.test(jar.get('cookie-mumate-id') ?? '')
        ? json({ profile: { displayName: 'สมาชิก A' } })
        : json({ code: 'not_authenticated' }, 401)
    }
    if (url === '/api/auth/link/connections') {
      return json({
        ok: true,
        connections: [
          { provider: 'line', linked: true, current: true, canUnlink: false },
          { provider: 'google', linked: server.linked.includes('google'), current: false, canUnlink: true },
        ],
      })
    }
    if (url === '/api/missions') return json({ missions: [] })
    return json({}, 404)
  }))
}

beforeEach(() => {
  jar.clear()
  server.owners = new Map([[`line:${LINE}`, MEMBER_A]])
  server.heldCookie = false
  server.linked = []
  server.oauthStarts = []
  window.sessionStorage.clear()
  installServer()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the "yes" path, end to end across the provider switch', () => {
  it('Google once, LINE once, and the connected screen shows the member with Google linked', async () => {
    const navigations: string[] = []
    const edge: Partial<IdentityChoiceDeps> = {
      navigate: (url) => void navigations.push(url),
      startOAuth: (provider) => void server.oauthStarts.push(provider),
      inLineApp: () => false,
      openExternal: () => {},
    }

    // 1. Signed in with a Google identity nobody owns: the question.
    sessionState.data = { provider: 'google', providerId: GOOGLE, user: { name: 'n', email: 'a@x' } }
    routerState.query = {}
    render(<IdentityChoiceScreen deps={{ ...defaultsWith(edge) }} />)
    const yes = await screen.findByTestId('identity-choice-yes')
    await act(async () => yes.click())
    await waitFor(() => expect(server.oauthStarts).toEqual(['line']))
    expect(server.heldCookie).toBe(true) // held BEFORE leaving
    cleanup()

    // 2. Back from LINE: the session is now member A's LINE. Mint, attach, go.
    sessionState.data = { provider: 'line', providerId: LINE, lineProfile: { sub: LINE }, user: {} }
    routerState.query = { proof: 'google' }
    render(<IdentityChoiceScreen deps={{ ...defaultsWith(edge) }} />)
    await waitFor(() => expect(navigations.at(-1)).toBe('/v2/settings/connected?linked=google'))
    expect(server.oauthStarts).toEqual(['line']) // Google was NOT asked a second time
    expect(jar.get('cookie-mumate-id')).toBe(MEMBER_A) // Fix A
    cleanup()

    // 3. The connected screen, with the URL the attach produced.
    window.history.replaceState({}, '', navigations.at(-1)!)
    render(<ConnectedScreen navigate={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('connected-notice').textContent ?? '').toContain('เชื่อม Google เรียบร้อยแล้ว'))
    expect(screen.queryByTestId('profile-gate-auth')).toBeNull() // the walk's "ไม่พบข้อมูลผู้ใช้"
    await waitFor(() => expect(screen.getByTestId('connected-state-google').textContent ?? '').toContain('เชื่อมแล้ว'))
  })
})

// The real default deps, with only the browser edges (navigation, OAuth, LINE app) replaced.
function defaultsWith(edge: Partial<IdentityChoiceDeps>): IdentityChoiceDeps {
  return { ...defaultIdentityChoiceDeps, ...edge }
}
