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
    preview: { ok: true, provider: 'google', survivor: 'this-account', loserKeepsNothing: true, movingProvider: 'LINE', reason: 'only-one-may-lose' },
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
  it('states the cost as the DATA left behind, not as a login method lost', async () => {
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    const cost = screen.getByTestId('merge-offer-cost').textContent ?? ''
    // 🔴 THIS ASSERTION IS INVERTED FROM WHAT IT USED TO BE, AND THE REASON IS EVIDENCE.
    // The old copy said the losing account "จะไม่มีวิธีเข้าสู่ระบบเหลืออยู่". True of the
    // rows; false of the member's experience, because the surviving account ends up
    // holding BOTH credentials — measured on the rehearsal database 2026-09-26, where the
    // survivor finished with google and LINE together. Saying it frightened the member
    // about the one thing that does not happen and buried the thing that does.
    expect(cost).not.toContain('ไม่มีวิธีเข้าสู่ระบบเหลืออยู่')
    expect(cost).toContain('ไม่ย้าย')
    expect(cost).toContain('เข้าถึงข้อมูลชุดนั้นไม่ได้อีก')
    // Slice 4 moves a credential and nothing else. A member expecting a full merge would
    // be misled by silence about the rest.
    expect(cost).toContain('QI')
    expect(cost).toContain('ติดต่อทีมงาน')
  })

  it('NAMES THE CREDENTIAL THAT MOVES, which is not always the one just verified', async () => {
    // 🔴 THE DEFECT THIS OWNS, FOUND BY THE OWNER ON 2026-09-26. He walked the collision
    // on the rehearsal database, read the panel, pressed through both gates deliberately —
    // and afterwards could not say that the LINE credential he was signed in with was the
    // one about to move. He had guessed the direction right from knowing which account
    // holds his purchases, not from the screen. The cause was that the ONLY provider named
    // was the one he had just verified, which is the side that STAYS.
    world.preview = {
      ok: true,
      provider: 'google',
      survivor: 'other-account',
      loserKeepsNothing: true,
      movingProvider: 'LINE',
      reason: 'only-one-may-lose',
    }
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    const which = screen.getByTestId('merge-offer-which').textContent ?? ''
    expect(which).toContain('LINE')    // the credential that moves
    expect(which).toContain('Google')  // the side that is kept
    expect(which).toContain('อันที่คุณกำลังใช้อยู่ตอนนี้')
  })

  it('says WHY this side is kept rather than leaving it to look arbitrary', async () => {
    // Owner decision 2026-09-26: tell the member. He reasoned the paying account should
    // survive before the screen said so, and wanted the screen to say it.
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    expect(screen.getByTestId('merge-offer-which').textContent ?? '').toContain('ประวัติการสั่งซื้อ')
  })

  it('a tiebreak reason reads honestly: nobody paid, so the older account is kept', async () => {
    world.preview = {
      ok: true,
      provider: 'google',
      survivor: 'other-account',
      loserKeepsNothing: true,
      movingProvider: 'LINE',
      reason: 'older-account-survives',
    }
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    const which = screen.getByTestId('merge-offer-which').textContent ?? ''
    expect(which).toContain('ไม่มีประวัติการสั่งซื้อ')
    expect(which).toContain('สร้างไว้ก่อน')
  })

  it('says the member stays signed in AND can still use both providers afterwards', async () => {
    // Identity resolves from the provider row, so once the row moves this same session
    // resolves to the surviving account on its next request — and the NEXT sign-in with
    // either provider lands on that same account, which is why both are named.
    world.preview = {
      ok: true,
      provider: 'google',
      survivor: 'other-account',
      loserKeepsNothing: true,
      movingProvider: 'LINE',
      reason: 'only-one-may-lose',
    }
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    const after = screen.getByTestId('merge-offer-after').textContent ?? ''
    expect(after).toContain('ไม่ต้องเข้าสู่ระบบใหม่')
    expect(after).toContain('LINE')
    expect(after).toContain('Google')
    expect(after).toContain('บัญชีเดียวกัน')
  })

  it('an older server that sends neither field still renders without inventing one', async () => {
    // The panel must degrade rather than guess: a missing movingProvider means the sentence
    // drops the name, never substitutes the verified provider as if it were the mover.
    world.preview = { ok: true, provider: 'google', survivor: 'other-account', loserKeepsNothing: true }
    arriveWithOffer()
    await mount()
    await screen.findByTestId('merge-offer')

    const which = screen.getByTestId('merge-offer-which').textContent ?? ''
    expect(which).toContain('ช่องทางที่คุณใช้อยู่')
    expect(which).not.toContain('ประวัติการสั่งซื้อ')
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
