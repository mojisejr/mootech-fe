// scripts/merge-offer-screen.test.tsx — the merge confirmation on screen
// (mumate-login-identity-001 slice 4).
//
// .tsx so the pre-push tsx lane (which globs *.test.ts) never runs it under plain tsx —
// and therefore it MUST be registered in vitest.config.mts or NOTHING runs it. That is
// assertion ① of #441's guard.
//
// MUTANT CONTRACT — each flips real behaviour and each goes RED here:
//   M1  merge on the first press instead of two              → "nothing is written on the first press" RED
//   M2  render the panel before the preview answers          → "no panel until the server agrees" RED
//   M3  render the panel when the preview REFUSES            → "a refusal shows a message, not a panel" RED
//   M4  drop the sentence about data not coming across       → "the cost is stated" RED
//   M5  claim a re-login is needed when the other side wins  → "the surviving-side copy" RED
//   M6  POST on cancel                                       → "declining writes nothing" RED
//
// M1 is the one DoD 4 actually names: "refuses to proceed without an explicit
// confirmation that is separate from pressing link".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const useSession = vi.fn()
vi.mock('next-auth/react', () => ({ useSession: () => useSession() }))

import { ConnectedScreen } from '@/features/v2-account/components/ConnectedScreen'

type Conn = { provider: string; linked: boolean; current: boolean; canUnlink: boolean }

interface World {
  connections: Conn[]
  preview: unknown
  previewStatus: number
  confirmBody: unknown
  confirmStatus: number
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
    if (url === '/api/missions' && (init?.method ?? 'GET') === 'GET') return json({ missions: [] })
    if (url.startsWith('/api/auth/link/merge/preview')) return json(world.preview, world.previewStatus)
    if (url === '/api/auth/link/merge/confirm') return json(world.confirmBody, world.confirmStatus)
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

/** The callback redirects back here with the offer in the query string. */
function arriveWithOffer(search = '?merge_offer=google') {
  window.history.replaceState({}, '', `/v2/settings/connected${search}`)
}

beforeEach(() => {
  world = {
    connections: [conn({ provider: 'line', linked: true, current: true }), conn({ provider: 'google' })],
    preview: { ok: true, provider: 'google', survivor: 'this-account', loserKeepsNothing: true },
    previewStatus: 200,
    confirmBody: { ok: true, merged: 'google', survivor: 'this-account' },
    confirmStatus: 200,
    calls: [],
  }
  useSession.mockReturnValue({ data: { provider: 'line' }, status: 'authenticated' })
  installFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/v2/settings/connected')
})

async function mount() {
  render(<ConnectedScreen navigate={vi.fn()} />)
  await screen.findByTestId('connected-backup')
  await waitFor(() => expect(world.calls).toContain('GET /api/auth/link/connections'))
}

const posts = () => world.calls.filter((c) => c.startsWith('POST /api/auth/link/merge/confirm'))

describe('the offer only appears when the server says a merge is possible', () => {
  it('shows nothing about merging on an ordinary visit', async () => {
    await mount()

    expect(screen.queryByTestId('merge-offer')).toBeNull()
    expect(world.calls.some((c) => c.includes('merge/preview'))).toBe(false)
  })

  it('asks the server what the merge would do, then shows the panel', async () => {
    arriveWithOffer()
    await mount()

    await screen.findByTestId('merge-offer')
    expect(world.calls).toContain('GET /api/auth/link/merge/preview?provider=google')
  })

  it('a refusal shows a message, not a panel — and names nobody', async () => {
    world.preview = { ok: false, error: 'merge_refused' }
    world.previewStatus = 409
    arriveWithOffer()
    await mount()

    await waitFor(() => expect(screen.queryByTestId('connected-notice')?.textContent ?? document.body.textContent ?? '').toContain('ติดต่อทีมงาน'))
    expect(screen.queryByTestId('merge-offer')).toBeNull()
  })

  it('an expired offer says so rather than failing silently', async () => {
    world.preview = { ok: false, error: 'no_offer' }
    world.previewStatus = 409
    arriveWithOffer()
    await mount()

    await waitFor(() => expect(document.body.textContent ?? '').toContain('หมดอายุ'))
    expect(screen.queryByTestId('merge-offer')).toBeNull()
  })
})

describe('what the member is told before anything is written', () => {
  it('states the cost: the other account loses its way in, and its data does not come across', async () => {
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    const cost = screen.getByTestId('merge-offer-cost').textContent ?? ''
    expect(cost).toContain('ไม่มีวิธีเข้าสู่ระบบเหลืออยู่')
    // Slice 4 moves a credential and nothing else. A member expecting a full merge
    // would be misled by silence here.
    expect(cost).toContain('จะไม่ถูกย้าย')
  })

  it('when the OTHER account survives, it says the member stays signed in', async () => {
    // Identity resolves from the provider row, so once the row moves this same session
    // resolves to the surviving account on its next request. Saying so stops a member
    // abandoning the flow because they think they have been logged out.
    world.preview = { ok: true, provider: 'google', survivor: 'other-account', loserKeepsNothing: true }
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    expect(screen.getByTestId('merge-offer-which').textContent ?? '').toContain('ไม่ต้องเข้าสู่ระบบใหม่')
  })
})

describe('nothing is written without an explicit confirmation', () => {
  it('the first press explains and does not merge', async () => {
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    fireEvent.click(screen.getByTestId('merge-offer-continue'))

    await screen.findByTestId('merge-offer-final')
    expect(posts()).toHaveLength(0)
  })

  it('only the second, separate press merges', async () => {
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    fireEvent.click(screen.getByTestId('merge-offer-continue'))
    fireEvent.click(await screen.findByTestId('merge-offer-confirm'))

    await waitFor(() => expect(posts()).toHaveLength(1))
  })

  it('declining writes nothing and leaves the member where they were', async () => {
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    fireEvent.click(screen.getByTestId('merge-offer-cancel'))

    await waitFor(() => expect(screen.queryByTestId('merge-offer')).toBeNull())
    expect(posts()).toHaveLength(0)
    expect(document.body.textContent ?? '').toContain('ไม่มีอะไรเปลี่ยนแปลง')
  })
})

describe('after the merge', () => {
  it('re-reads the connection list rather than trusting what the screen had', async () => {
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')
    const before = world.calls.filter((c) => c === 'GET /api/auth/link/connections').length

    fireEvent.click(screen.getByTestId('merge-offer-continue'))
    fireEvent.click(await screen.findByTestId('merge-offer-confirm'))

    await waitFor(() =>
      expect(world.calls.filter((c) => c === 'GET /api/auth/link/connections').length).toBeGreaterThan(before),
    )
    expect(screen.queryByTestId('merge-offer')).toBeNull()
  })

  it('a refusal at confirm time reaches the member in their own language', async () => {
    world.confirmBody = { ok: false, error: 'merge_refused' }
    world.confirmStatus = 409
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    fireEvent.click(screen.getByTestId('merge-offer-continue'))
    fireEvent.click(await screen.findByTestId('merge-offer-confirm'))

    await waitFor(() => expect(document.body.textContent ?? '').toContain('ติดต่อทีมงาน'))
  })
})
