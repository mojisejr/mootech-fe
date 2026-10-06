// mumate-maintenance-notice-001 slice 1 — before the server move (2026-10-09 04:00 +07:00) the home popup is the
// maintenance notice instead of the Qi check-in promo; from that moment on it is the promo again, by itself.
//
// Rules asserted here:
//   • before the end: every visitor of an eligible /v2 path sees it — signed in or not — and no wallet is read.
//   • tapping the image only closes it (no navigation); X closes it for this session; "รับทราบ" keeps it closed
//     until the end; it opens once per session; excluded paths never open it.
//   • at the end and after: the notice never opens and the check-in promo's own rules apply again
//     (scripts/promo-popup-members-only.test.tsx runs every one of them with the clock after the end).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const auth = vi.hoisted(() => ({ status: 'anon' as 'anon' | 'loading' | 'authed' }))
const nav = vi.hoisted(() => ({ pathname: '/v2', push: vi.fn() }))

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: nav.pathname, push: nav.push }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/lib/auth/use-current-user', () => ({
  useCurrentUser: () => ({ userId: auth.status === 'authed' ? 'u-1' : '', status: auth.status }),
}))

import { NOTICE, PromoPopup, noticeActive } from '@/features/v2-home/components/PromoPopup'

const BEFORE = new Date('2026-10-06T20:00:00+07:00')
const LAST_SECOND = new Date('2026-10-09T03:59:59+07:00')
const AT_END = new Date('2026-10-09T04:00:00+07:00')

const fetchMock = vi.fn()
const walletWith = (history: unknown[]) => ({ ok: true, json: async () => ({ qi: 10, history }) })
const checkedInToday = () => [{ id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: new Date().toISOString() }]

const notice = () => screen.queryByTestId('maintenance-notice-scrim')
const promo = () => screen.queryByTestId('promo-popup-scrim')
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(1500) })
const newSession = () => { cleanup(); window.sessionStorage.clear() }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(BEFORE)
  auth.status = 'anon'
  nav.pathname = '/v2'
  nav.push.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  window.localStorage.clear()
  window.sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('maintenance notice — the end time', () => {
  it('ends at the window start, 2026-10-09 04:00 Bangkok', () => {
    expect(NOTICE.until).toBe(Date.parse('2026-10-08T21:00:00Z'))
    expect(noticeActive(LAST_SECOND.getTime())).toBe(true)
    expect(noticeActive(AT_END.getTime())).toBe(false)
  })

  it('names the announced day and hours for screen readers', () => {
    expect(NOTICE.alt).toContain('วันศุกร์ที่ 9 ตุลาคม 2569')
    expect(NOTICE.alt).toContain('04.00-10.00 น.')
  })
})

describe('maintenance notice — before the end', () => {
  it('a visitor who is not signed in sees it, and no wallet is read', async () => {
    render(<PromoPopup />)
    await settle()
    expect(notice()).not.toBeNull()
    expect(promo()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a member who already checked in today sees it too, still without a wallet read', async () => {
    auth.status = 'authed'
    fetchMock.mockResolvedValue(walletWith(checkedInToday()))
    render(<PromoPopup />)
    await settle()
    expect(notice()).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a visitor still loading their sign-in sees it without waiting', async () => {
    auth.status = 'loading'
    render(<PromoPopup />)
    await settle()
    expect(notice()).not.toBeNull()
  })

  it('tapping the image closes it and goes nowhere', async () => {
    render(<PromoPopup />)
    await settle()
    act(() => { screen.getByTestId('maintenance-notice-image').click() })
    expect(notice()).toBeNull()
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('X closes it for this session only; a new session shows it again', async () => {
    const { rerender } = render(<PromoPopup />)
    await settle()
    act(() => { screen.getByTestId('maintenance-notice-close').click() })
    expect(notice()).toBeNull()
    nav.pathname = '/v2/qi'
    rerender(<PromoPopup />)
    await settle()
    expect(notice()).toBeNull()
    newSession()
    render(<PromoPopup />)
    await settle()
    expect(notice()).not.toBeNull()
  })

  it('a reload before the visitor touches it (new service worker) shows it again', async () => {
    render(<PromoPopup />)
    await settle()
    expect(notice()).not.toBeNull()
    cleanup() // pages/_app.tsx reloads once on controllerchange; sessionStorage survives a reload
    render(<PromoPopup />)
    await settle()
    expect(notice()).not.toBeNull()
  })

  it('closing it by tapping the image also counts for the session, across a reload', async () => {
    render(<PromoPopup />)
    await settle()
    act(() => { screen.getByTestId('maintenance-notice-image').click() })
    cleanup()
    render(<PromoPopup />)
    await settle()
    expect(notice()).toBeNull()
  })

  it('"รับทราบ" keeps it closed in later sessions', async () => {
    render(<PromoPopup />)
    await settle()
    expect(screen.getByTestId('maintenance-notice-ack').textContent).toBe('รับทราบ')
    act(() => { screen.getByTestId('maintenance-notice-ack').click() })
    expect(notice()).toBeNull()
    newSession()
    render(<PromoPopup />)
    await settle()
    expect(notice()).toBeNull()
  })

  it('an excluded path never opens it', async () => {
    nav.pathname = '/v2/login'
    render(<PromoPopup />)
    await settle()
    expect(notice()).toBeNull()
  })

  it('the check-in promo stays away while the notice runs, even after "รับทราบ"', async () => {
    auth.status = 'authed'
    window.localStorage.setItem('mumate:notice-20261009-hidden', '1')
    fetchMock.mockResolvedValue(walletWith([]))
    render(<PromoPopup />)
    await settle()
    expect(notice()).toBeNull()
    expect(promo()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('maintenance notice — from the end on', () => {
  it('a visitor who is not signed in sees nothing at all', async () => {
    vi.setSystemTime(AT_END)
    render(<PromoPopup />)
    await settle()
    expect(notice()).toBeNull()
    expect(promo()).toBeNull()
  })

  it('a member who has not checked in gets the check-in promo back', async () => {
    vi.setSystemTime(AT_END)
    auth.status = 'authed'
    fetchMock.mockResolvedValue(walletWith([]))
    render(<PromoPopup />)
    await settle()
    expect(notice()).toBeNull()
    expect(promo()).not.toBeNull()
  })
})
