// #246 — identity-limbo escape hatch in useV2AuthGate.
//
// ANCHOR: scripts/v2-auth-gate-escape.test.tsx#v2-authgate-identity-stuck
// Bug-class this owns: an authed session with no MEMBER_ID resolves to 'loading' FOREVER (resolveAuth,
// login-loop invariant) and every /v2 page that gates on showLoading spins with NO exit. The gate must
// surface `identityStuck` after a timeout so the page can offer re-login. Teeth = a timer mutant: if the
// identityStuck wiring is removed (returns false always) or the timeout never fires, case ① goes RED.
//
// .tsx so ci.yml's `scripts/*.test.ts` tsx lane never sees it — vitest-only (registered in vitest.config.mts).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AuthStatus } from '@/lib/auth/resolve-auth'

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: vi.fn() }))
vi.mock('@/lib/hooks/use-has-mounted', () => ({ useHasMounted: vi.fn() }))

import { useV2AuthGate } from '@/features/auth/hooks/useV2AuthGate'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { useRouter } from 'next/router'
import { useHasMounted } from '@/lib/hooks/use-has-mounted'

function setup({ status, mounted }: { status: AuthStatus; mounted: boolean }) {
  vi.mocked(useCurrentUser).mockReturnValue({
    userId: status === 'authed' ? 'u1' : '',
    status,
  } as ReturnType<typeof useCurrentUser>)
  vi.mocked(useRouter).mockReturnValue({ replace: vi.fn() } as unknown as ReturnType<typeof useRouter>)
  vi.mocked(useHasMounted).mockReturnValue(mounted)
}

describe('useV2AuthGate — #246 identity-limbo escape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ① the teeth: post-mount limbo → after the timeout, identityStuck flips true (the ONLY exit).
  it('flips identityStuck true after escapeAfterMs of post-mount limbo (loading)', () => {
    setup({ status: 'loading', mounted: true })
    const { result } = renderHook(() => useV2AuthGate({ escapeAfterMs: 8000 }))
    expect(result.current.identityStuck).toBe(false) // not yet — still within the window
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(result.current.identityStuck).toBe(true)
  })

  it('never stuck when identity is resolved (authed) — no false escape', () => {
    setup({ status: 'authed', mounted: true })
    const { result } = renderHook(() => useV2AuthGate())
    act(() => {
      vi.advanceTimersByTime(20000)
    })
    expect(result.current.identityStuck).toBe(false)
  })

  it('never stuck before mount — the pre-hydration splash is not limbo', () => {
    setup({ status: 'loading', mounted: false })
    const { result } = renderHook(() => useV2AuthGate({ escapeAfterMs: 8000 }))
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(result.current.identityStuck).toBe(false)
  })

  it('resets if limbo clears before the timeout (identity settled in time)', () => {
    setup({ status: 'loading', mounted: true })
    const { result, rerender } = renderHook(() => useV2AuthGate({ escapeAfterMs: 8000 }))
    act(() => {
      vi.advanceTimersByTime(4000) // half-way, still loading
    })
    expect(result.current.identityStuck).toBe(false)
    setup({ status: 'authed', mounted: true }) // identity landed
    rerender()
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(result.current.identityStuck).toBe(false)
  })
})
