// ANCHOR: logout-clears-all-caches — pins the SIDE-EFFECT of useV2Logout at its CALL SITE, not the cache
// implementations (issue #210). Today the 4 clear-cache calls in useV2Logout.ts:36-39 have no test covering
// that line — any of them could be deleted and every existing suite (which tests each cache module in
// isolation) would stay green. This is the missing gate.
//
// MUTANT CONTRACT (ตู๋ review focus #1): delete ONE clearX() call from the hook → TWO tests go RED — that
// call site's own `it` AND the all-four guard (the last `it`) — and no others. The per-`it` split is what
// LOCALIZES which call site regressed; the guard alone would bite but not say which.
//
// A SECOND mutant class is covered: moving a clearX() out of logout() into a mount-time
// `useEffect(() => clearX(), [])` keeps a naive "was it ever called?" count green even though logout no
// longer clears anything. So runLogout() first asserts NOTHING is cleared BEFORE logout() runs — renderHook
// flushes effects inside act(), so a mount-time clear fires there and trips the guard. That is what makes
// the assertions below mean "logout is the caller", not merely "called at some point during the test".
//
// We mock the 4 cache modules (spies), plus react-cookie + next-auth/react (so logout() runs to completion
// without a real cookie jar or a real signOut redirect). The hook itself is the real code under test.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/lib/v2/user-cache', () => ({ clearUserCache: vi.fn() }))
vi.mock('@/features/v2-calendar/hooks/day-detail-cache', () => ({ clearDayDetailCache: vi.fn() }))
vi.mock('@/features/v2-calendar/hooks/month-cache', () => ({ clearMonthCache: vi.fn() }))
vi.mock('@/features/auth/hooks/chart-cache', () => ({ clearChartCache: vi.fn() }))

// react-cookie: useCookies returns [cookies, setCookie, removeCookie]. The hook only uses removeCookie.
// Factories are hoisted above the imports, so they must NOT close over top-level vars — inline the stubs.
vi.mock('react-cookie', () => ({ useCookies: () => [{}, vi.fn(), vi.fn()] }))

// next-auth: swallow signOut so no navigation/redirect is attempted in jsdom.
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))

// Imports resolve to the mocked modules above (vi.mock is hoisted).
import { useV2Logout } from '@/features/auth/hooks/useV2Logout'
import { clearUserCache } from '@/lib/v2/user-cache'
import { clearDayDetailCache } from '@/features/v2-calendar/hooks/day-detail-cache'
import { clearMonthCache } from '@/features/v2-calendar/hooks/month-cache'
import { clearChartCache } from '@/features/auth/hooks/chart-cache'

function runLogout() {
  const { result } = renderHook(() => useV2Logout())
  // Caches must be dropped BY logout(), not just at some point in the component's life. renderHook flushes
  // effects inside act(), so if a clearX() were moved into a mount-time useEffect it would already have run
  // here — these four assertions catch that and keep the post-logout counts meaningful ("logout is caller").
  expect(clearUserCache).not.toHaveBeenCalled()
  expect(clearDayDetailCache).not.toHaveBeenCalled()
  expect(clearMonthCache).not.toHaveBeenCalled()
  expect(clearChartCache).not.toHaveBeenCalled()
  act(() => {
    result.current.logout()
  })
}

describe('useV2Logout clears every per-identity cache at the call site', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls clearUserCache (drop in-flight /api/user for the old identity)', () => {
    runLogout()
    expect(clearUserCache).toHaveBeenCalledTimes(1)
  })

  it('calls clearDayDetailCache (drop the previous identity cached days)', () => {
    runLogout()
    expect(clearDayDetailCache).toHaveBeenCalledTimes(1)
  })

  it('calls clearMonthCache (drop the persisted localStorage month cache)', () => {
    runLogout()
    expect(clearMonthCache).toHaveBeenCalledTimes(1)
  })

  it('calls clearChartCache (drop the in-memory home chart/mascot cache)', () => {
    runLogout()
    expect(clearChartCache).toHaveBeenCalledTimes(1)
  })

  // Guard the whole set in one place too: if a future edit drops any call, this fails alongside the
  // specific one above — belt-and-suspenders for the "all 4" DoD line.
  it('calls all four clear-cache functions exactly once per logout', () => {
    runLogout()
    expect(clearUserCache).toHaveBeenCalledTimes(1)
    expect(clearDayDetailCache).toHaveBeenCalledTimes(1)
    expect(clearMonthCache).toHaveBeenCalledTimes(1)
    expect(clearChartCache).toHaveBeenCalledTimes(1)
  })
})
