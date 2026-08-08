// ANCHOR: logout-clears-all-caches — pins the SIDE-EFFECT of useV2Logout at its CALL SITE, not the cache
// implementations (issue #210). Today the 4 clear-cache calls in useV2Logout.ts:36-39 have no test covering
// that line — any of them could be deleted and every existing suite (which tests each cache module in
// isolation) would stay green. This is the missing gate.
//
// MUTANT CONTRACT (ตู๋ review focus #1): delete ONE clearX() call from the hook → EXACTLY ONE test below
// goes RED, and only that one. That is why each call site gets its own `it` with its own single assertion —
// a single combined test would still bite, but wouldn't localize which call site regressed.
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
