// scripts/connected-screen.test.tsx — features/v2-account/components/ConnectedScreen.tsx
// (mumate-login-identity-001 slice 3).
//
// .tsx so the pre-push tsx lane (which globs *.test.ts) never tries to run it under
// plain tsx — and therefore it MUST be registered in vitest.config.mts, or nothing
// at all runs it. That is assertion ① of #441's guard and it is why this comment
// exists rather than being assumed.
//
// MUTANT CONTRACT — each flips real behaviour and each goes RED here:
//   M1  render from `session.provider` again instead of /api/auth/link/connections
//         → "a second linked provider reads as linked" RED
//   M2  hardcode the badge back to +10 QI          → "the badge is the engine's number" RED
//   M3  show the badge with no mission for it      → "no mission, no badge" RED
//   M4  drop canUnlink and always offer unlink     → "the last method offers no unlink" RED
//   M5  put Apple / phone back in the list         → guarded SERVER-SIDE, not here.
//         Verified by attempting it: adding "apple" to this file's LINKABLE leaves all
//         20 green, because the list is driven by /api/auth/link/connections and
//         LINKABLE is only the fallback shape used before it answers. The real guard is
//         lib/auth/link-providers.ts LINKABLE, covered in link-connections-route.test.ts
//         ("offers exactly the two providers the contract covers"), which DOES go red.
//         Left written down rather than quietly dropped: a mutant contract that lists a
//         mutation nobody checked is the same shape of false comfort the whole practice
//         exists to remove.
//   M6  skip the confirm before unlinking          → "unlink asks first" RED
//   M7  name the other account in the collision text → "names nobody" RED
//
// M1 is the one that matters: it is the bug this slice exists to remove, and it
// looks completely fine on screen until a member actually links a second provider.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const useSession = vi.fn()
vi.mock('next-auth/react', () => ({ useSession: () => useSession() }))

import { ConnectedScreen, defaultNavigate } from '@/features/v2-account/components/ConnectedScreen'

type Conn = { provider: string; linked: boolean; current: boolean; canUnlink: boolean }

interface World {
  connections: Conn[]
  missions: Array<{ id: string; rewardCoins: number; completed?: boolean }>
  unlinkStatus: number
  unlinkBody: unknown
  calls: string[]
}

let world: World

function installFetch() {
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    world.calls.push(`${init?.method ?? 'GET'} ${url}`)
    const json = (body: unknown, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
    if (url === '/api/profile') return json({ profile: { displayName: 'นนทศักดิ์' } })
    if (url === '/api/auth/link/connections') return json({ ok: true, connections: world.connections })
    if (url === '/api/missions' && (init?.method ?? 'GET') === 'GET') return json({ missions: world.missions })
    if (url === '/api/missions') return json({ ok: true })
    if (url.startsWith('/api/auth/link/unlink/')) return json(world.unlinkBody, world.unlinkStatus)
    return json({}, 404)
  })
  vi.stubGlobal('fetch', impl)
  return impl
}

const conn = (o: Partial<Conn> & { provider: string }): Conn => ({
  linked: false,
  current: false,
  canUnlink: false,
  ...o,
})

beforeEach(() => {
  world = {
    connections: [conn({ provider: 'line', linked: true, current: true }), conn({ provider: 'google' })],
    missions: [{ id: 'connect_line', rewardCoins: 20 }],
    unlinkStatus: 200,
    unlinkBody: { ok: true },
    calls: [],
  }
  useSession.mockReturnValue({ data: { provider: 'line' }, status: 'authenticated' })
  installFetch()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function mount(navigate = vi.fn()) {
  render(<ConnectedScreen navigate={navigate} />)
  await screen.findByTestId('connected-backup')
  await waitFor(() => expect(world.calls).toContain('GET /api/auth/link/connections'))
  return navigate
}

describe('the list shows what the database holds, not what the session says', () => {
  it('a second linked provider reads as linked — the bug this slice exists to remove', async () => {
    world.connections = [
      conn({ provider: 'line', linked: true, current: true, canUnlink: true }),
      conn({ provider: 'google', linked: true, canUnlink: true }),
    ]
    await mount()
    await waitFor(() => expect(screen.getByTestId('connected-state-google').textContent ?? '').toContain('เชื่อมแล้ว'))
    expect(screen.getByTestId('connected-state-line').textContent ?? '').toContain('ใช้อยู่')
  })

  it('an unlinked provider offers a link button and no unlink button', async () => {
    await mount()
    await waitFor(() => expect(screen.getByTestId('connected-link-google')).toBeTruthy())
    expect(screen.queryByTestId('connected-unlink-google')).toBeNull()
  })

  it('shows only the two real providers — Apple and phone are gone', async () => {
    await mount()
    expect(screen.queryByText('Apple')).toBeNull()
    expect(screen.queryByText('เบอร์โทรศัพท์')).toBeNull()
    expect(screen.getByTestId('connected-row-line')).toBeTruthy()
    expect(screen.getByTestId('connected-row-google')).toBeTruthy()
  })

  it('no longer pretends a button is coming soon', async () => {
    await mount()
    expect(screen.queryByText('เร็ว ๆ นี้')).toBeNull()
  })
})

describe('the QI badge tells the truth or says nothing', () => {
  it('is the engine\'s number, not a number typed into the page', async () => {
    world.connections = [conn({ provider: 'line', linked: true, current: true }), conn({ provider: 'google' })]
    world.missions = [{ id: 'connect_google', rewardCoins: 35 }]
    await mount()
    await waitFor(() => expect(screen.getByTestId('connected-reward-google').textContent ?? '').toContain('+35 QI'))
    expect(screen.queryByText('+10 QI')).toBeNull()
  })

  it('no mission for that provider, no badge — connect_google does not exist today', async () => {
    world.missions = [{ id: 'connect_line', rewardCoins: 20 }]
    await mount()
    await waitFor(() => expect(screen.getByTestId('connected-link-google')).toBeTruthy())
    expect(screen.queryByTestId('connected-reward-google')).toBeNull()
  })

  it('an already-completed mission shows no badge', async () => {
    world.missions = [{ id: 'connect_google', rewardCoins: 35, completed: true }]
    await mount()
    await waitFor(() => expect(screen.getByTestId('connected-link-google')).toBeTruthy())
    expect(screen.queryByTestId('connected-reward-google')).toBeNull()
  })

  it('never shows a badge on a provider that is already linked', async () => {
    world.connections = [conn({ provider: 'line', linked: true, current: true }), conn({ provider: 'google' })]
    world.missions = [{ id: 'connect_line', rewardCoins: 20 }]
    await mount()
    await waitFor(() => expect(screen.getByTestId('connected-row-line')).toBeTruthy())
    expect(screen.queryByTestId('connected-reward-line')).toBeNull()
  })
})

describe('starting a link', () => {
  it('navigates to the start route with a same-site return, not a fetch', async () => {
    const navigate = await mount()
    fireEvent.click(screen.getByTestId('connected-link-google'))
    expect(navigate).toHaveBeenCalledWith(
      '/api/auth/link/start/google?return_to=%2Fv2%2Fsettings%2Fconnected',
    )
    expect(world.calls.some((c) => c.includes('/api/auth/link/start'))).toBe(false)
  })

  it('the shipped default really does navigate', () => {
    expect(defaultNavigate.toString()).toContain('location')
  })
})

describe('unlinking', () => {
  it('the last remaining method offers no unlink at all', async () => {
    world.connections = [conn({ provider: 'line', linked: true, current: true, canUnlink: false })]
    await mount()
    await waitFor(() => expect(screen.getByTestId('connected-only-line')).toBeTruthy())
    expect(screen.queryByTestId('connected-unlink-line')).toBeNull()
  })

  it('asks first, and does nothing when the member says no', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    world.connections = [
      conn({ provider: 'line', linked: true, current: true, canUnlink: true }),
      conn({ provider: 'google', linked: true, canUnlink: true }),
    ]
    await mount()
    fireEvent.click(await screen.findByTestId('connected-unlink-google'))
    await waitFor(() => expect(window.confirm).toHaveBeenCalled())
    expect(world.calls.some((c) => c.startsWith('DELETE'))).toBe(false)
  })

  it('sends DELETE and re-reads the list afterwards rather than guessing the new state', async () => {
    world.connections = [
      conn({ provider: 'line', linked: true, current: true, canUnlink: true }),
      conn({ provider: 'google', linked: true, canUnlink: true }),
    ]
    await mount()
    const before = world.calls.filter((c) => c === 'GET /api/auth/link/connections').length
    fireEvent.click(await screen.findByTestId('connected-unlink-google'))
    await waitFor(() =>
      expect(world.calls).toContain('DELETE /api/auth/link/unlink/google'),
    )
    await waitFor(() =>
      expect(world.calls.filter((c) => c === 'GET /api/auth/link/connections').length).toBeGreaterThan(before),
    )
  })

  it('surfaces the server\'s last-method refusal in the member\'s language', async () => {
    world.connections = [
      conn({ provider: 'line', linked: true, current: true, canUnlink: true }),
      conn({ provider: 'google', linked: true, canUnlink: true }),
    ]
    world.unlinkStatus = 409
    world.unlinkBody = { ok: false, error: 'last_method' }
    await mount()
    fireEvent.click(await screen.findByTestId('connected-unlink-google'))
    await waitFor(() =>
      expect(screen.getByTestId('connected-notice').textContent ?? '').toContain('วิธีเข้าสู่ระบบวิธีเดียวที่เหลืออยู่'),
    )
  })
})

describe('what the callback reports', () => {
  const withQuery = async (q: string) => {
    window.history.replaceState({}, '', `/v2/settings/connected${q}`)
    return mount()
  }

  it('confirms a successful link', async () => {
    await withQuery('?linked=google')
    await waitFor(() => expect(screen.getByTestId('connected-notice').textContent ?? '').toContain('เชื่อม Google เรียบร้อยแล้ว'))
  })

  it('explains the LINE-webview refusal as an instruction, not an error code', async () => {
    await withQuery('?link_error=line-webview-google')
    await waitFor(() =>
      expect(screen.getByTestId('connected-notice').textContent ?? '').toContain('เปิดหน้านี้ในเบราว์เซอร์'),
    )
  })

  it('names nobody when the identity belongs to another member', async () => {
    await withQuery('?link_error=owned_by_another')
    const notice = await screen.findByTestId('connected-notice')
    expect(notice.textContent ?? '').toContain('อีกบัญชีหนึ่ง')
    expect(notice.textContent ?? '').not.toMatch(/@|[0-9a-f]{8}-/)
  })

  it('falls back to a plain message for a reason it does not recognise', async () => {
    await withQuery('?link_error=something_new')
    await waitFor(() => expect(screen.getByTestId('connected-notice').textContent ?? '').toContain('ลองใหม่อีกครั้ง'))
  })

  it('strips the result from the URL so a refresh does not replay it', async () => {
    await withQuery('?linked=google')
    await waitFor(() => expect(screen.getByTestId('connected-notice')).toBeTruthy())
    expect(window.location.search).toBe('')
  })
})

describe('when the connections read fails', () => {
  it('does not claim providers are unlinked — it leaves the default and shows no false state', async () => {
    const impl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/profile') return { ok: true, status: 200, json: async () => ({ profile: {} }) }
      if (url === '/api/auth/link/connections') throw new Error('offline')
      return { ok: true, status: 200, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', impl)
    render(<ConnectedScreen navigate={vi.fn()} />)
    await screen.findByTestId('connected-backup')
    // The rows still render, and nothing is presented as linked on bad information.
    expect(screen.queryByTestId('connected-unlink-google')).toBeNull()
    expect(screen.queryByTestId('connected-unlink-line')).toBeNull()
  })
})
