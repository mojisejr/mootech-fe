// MuMate v2 — logged-in home routing + data (logic seam). Fixes parity gap C: a RETURNING user (has a
// computed chart) must land on HOME, not be bounced back through register. Loop-safe: the register
// redirect fires ONLY on a settled 'authed' (useV2AuthGate guarantees it), exactly once, never during
// loading/self-heal. Lamun's <V2HomeScreen/> consumes { showLoading, greeting, computeSource }.
//
// Compute-availability (goo trace, task 4): the chart is created AT profile-save —
// ChineseHoroscopeCalculate returns the compute synchronously, so profile-complete == compute-complete.
// Home re-reads it via ChineseHoroscopeGet(userId, result_code). While that fetch is in flight
// computeSource is null → Lamun shows the static hero 01.png fallback (safety).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import type { AuthStatus } from '@/lib/auth/resolve-auth'
import { UserGetById } from '@/constants/api/api-user-get'
import { ChineseHoroscopeGet } from '@/constants/api/api-chinese-horoscope-get'
import { resolveReturningResult } from '@/lib/auth/returning-result'
import type { ComputeMascotSource } from '@/lib/personalization/mascot'

export type V2Home = {
  /** Render <AuthLoadingGate/> while true (resolving identity, resolving chart, or redirecting). */
  showLoading: boolean
  greeting: { name: string }
  /** For Lamun's `useMascotFromCompute(computeSource)?.character ?? '/images/v2/mascot/01.png'`. */
  computeSource: ComputeMascotSource | null
}

// Map the raw ChineseHoroscopeGet response into the shape resolveMascotFromCompute reads. The raw
// response has NO `enrichment`; the day-MASTER element is the day heavenly stem (detail.dayAbove =
// 日干). Passing the response raw would leave the element null → always-fallback, so we lift it here.
function toComputeSource(chart: unknown): ComputeMascotSource | null {
  const c = chart as { detail?: { yearBelow?: { constellation?: string; id?: number }; dayAbove?: { element?: string } } }
  const yb = c?.detail?.yearBelow
  const dayStemElement = c?.detail?.dayAbove?.element ?? null
  if (!yb) return null
  return {
    detail: { yearBelow: { constellation: yb.constellation ?? null, id: yb.id ?? null } },
    enrichment: { pillars: { day: { stemElement: dayStemElement } } },
  }
}

// Takes the resolved auth `status` as input (NOT useV2AuthGate) — useV2AuthGate must be imported
// directly inside pages/v2 (complete-by-construction ban that keeps gated-page discovery complete);
// wrapping it in a features/ hook is exactly the transitive pattern that ban forbids. The caller
// (pages/v2/index) imports useV2AuthGate directly and passes status here.
export function useV2Home(status: AuthStatus): V2Home {
  const router = useRouter()
  const [cookies] = useCookies([CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const greeting = { name: (cookies[CookieKey.MEMBER_NAME] as string) || '' }
  const [phase, setPhase] = useState<'resolving' | 'home' | 'redirecting'>('resolving')
  const [computeSource, setComputeSource] = useState<ComputeMascotSource | null>(null)
  const doneRef = useRef(false)

  const resolveHome = useCallback(async () => {
    const user = await UserGetById(userId)
    const { resultCode, isRefreshResult } = resolveReturningResult(user)
    // No usable chart (never computed, or stale/refresh — refresh-recompute is deferred to a later
    // slice) → the register/compute path. Settled-authed only, so this is not a login-loop bounce.
    if (!resultCode || isRefreshResult) {
      setPhase('redirecting')
      router.replace('/v2/register')
      return
    }
    // Has a chart → HOME. Fetch it for the per-user mascot; null (fetch fail) still lands home on 01.png.
    const chart = await ChineseHoroscopeGet(userId, resultCode)
    setComputeSource(toComputeSource(chart))
    setPhase('home')
  }, [userId, router])

  useEffect(() => {
    if (status !== 'authed' || !userId || doneRef.current) return
    doneRef.current = true
    resolveHome().catch(() => {
      doneRef.current = false // transient failure → let a later render retry
    })
  }, [status, userId, resolveHome])

  return {
    // Hold the loading gate until settled to 'home' (resolving chart or redirecting both wait).
    showLoading: status !== 'authed' || phase !== 'home',
    greeting,
    computeSource,
  }
}
