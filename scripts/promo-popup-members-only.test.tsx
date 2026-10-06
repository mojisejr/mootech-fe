// mumate-promo-popup-auth-001 slice 1 — the check-in popup is for a signed-in member who has not checked in
// today. Before this it read no sign-in state at all: an anonymous visitor on /v2 got it over the onboarding
// carousel, and its tap led to a screen that needs a login.
//
// Rules asserted here:
//   • opens only on a settled 'authed' — 'anon' never, 'loading' waits (a member back from LINE can sit in
//     'loading' ~17 s while identity is minted; useV2AuthGate slice 7b).
//   • reacts to status AND path — /v2/login sends a member on to /v2 with router.replace (no remount), so a
//     mount-only check would never see them.
//   • one GET /api/qi-wallet; checked in today (checkedInToday, the check-in screen's rule) → stays closed.
//     A failed wallet read opens it: the worst case is the behaviour that shipped before.
//   • unchanged: excluded paths, once per session, "ไม่แสดงอีกใน 7 วัน".
//
// The clock is fixed after the maintenance notice ends (mumate-maintenance-notice-001): before then the same
// component shows the notice instead, which scripts/maintenance-notice.test.tsx covers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const auth = vi.hoisted(() => ({ status: 'anon' as 'anon' | 'loading' | 'authed' }))
const nav = vi.hoisted(() => ({ pathname: '/v2', push: vi.fn() }))

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: nav.pathname, push: nav.push }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/lib/auth/use-current-user', () => ({
  useCurrentUser: () => ({ userId: auth.status === 'authed' ? 'u-1' : '', status: auth.status }),
}))

import { PromoPopup } from '@/features/v2-home/components/PromoPopup'

const fetchMock = vi.fn()
const walletWith = (history: unknown[]) => ({ ok: true, json: async () => ({ qi: 10, history }) })
const AFTER_NOTICE = new Date('2026-10-12T12:00:00+07:00')
// built per test, after the clock is set, so "today" is the fixed clock's day
const checkedInToday = () => [{ id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: new Date().toISOString() }]
const checkedInYesterday = () => [
  { id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: new Date(Date.now() - 26 * 3600_000).toISOString() },
]

const popup = () => screen.queryByTestId('promo-popup-scrim')
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(1500) })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AFTER_NOTICE)
  auth.status = 'anon'
  nav.pathname = '/v2'
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

describe('PromoPopup — members only', () => {
  it('an anonymous visitor never sees it and no wallet is read', async () => {
    render(<PromoPopup />)
    await settle()
    expect(popup()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('opens for a signed-in member who has not checked in today', async () => {
    auth.status = 'authed'
    fetchMock.mockResolvedValue(walletWith(checkedInYesterday()))
    render(<PromoPopup />)
    await settle()
    expect(popup()).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/qi-wallet')
  })

  it('stays closed for a member who checked in today, and does not re-read on navigation', async () => {
    auth.status = 'authed'
    fetchMock.mockResolvedValue(walletWith(checkedInToday()))
    const { rerender } = render(<PromoPopup />)
    await settle()
    expect(popup()).toBeNull()
    nav.pathname = '/v2/qi'
    rerender(<PromoPopup />)
    await settle()
    expect(popup()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a failed wallet read opens it (worst case = the behaviour before this change)', async () => {
    auth.status = 'authed'
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: 'x' }) })
    render(<PromoPopup />)
    await settle()
    expect(popup()).not.toBeNull()
  })

  it('a wallet request that throws opens it too', async () => {
    auth.status = 'authed'
    fetchMock.mockRejectedValue(new Error('offline'))
    render(<PromoPopup />)
    await settle()
    expect(popup()).not.toBeNull()
  })

  it("waits through 'loading' and opens once identity settles to 'authed'", async () => {
    auth.status = 'loading'
    fetchMock.mockResolvedValue(walletWith([]))
    const { rerender } = render(<PromoPopup />)
    await settle()
    expect(popup()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    auth.status = 'authed'
    rerender(<PromoPopup />)
    await settle()
    expect(popup()).not.toBeNull()
  })

  it('a member signed in on /v2/login sees it after the client-side move to /v2', async () => {
    auth.status = 'authed'
    nav.pathname = '/v2/login'
    fetchMock.mockResolvedValue(walletWith([]))
    const { rerender } = render(<PromoPopup />)
    await settle()
    expect(popup()).toBeNull()
    nav.pathname = '/v2'
    rerender(<PromoPopup />)
    await settle()
    expect(popup()).not.toBeNull()
  })
})

describe('PromoPopup — unchanged rules', () => {
  it('"ไม่แสดงอีกใน 7 วัน" keeps it closed without reading the wallet', async () => {
    auth.status = 'authed'
    window.localStorage.setItem('mumate:promo-hidden-until', String(Date.now() + 86400_000))
    render(<PromoPopup />)
    await settle()
    expect(popup()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('opens once per session: closing it and navigating does not bring it back', async () => {
    auth.status = 'authed'
    fetchMock.mockResolvedValue(walletWith([]))
    const { rerender } = render(<PromoPopup />)
    await settle()
    act(() => { screen.getByTestId('promo-popup-close').click() })
    expect(popup()).toBeNull()
    nav.pathname = '/v2/qi'
    rerender(<PromoPopup />)
    await settle()
    expect(popup()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('an excluded path never opens it, even for a member', async () => {
    auth.status = 'authed'
    nav.pathname = '/v2/element-finder'
    render(<PromoPopup />)
    await settle()
    expect(popup()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
