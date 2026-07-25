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
import { toComputeSource } from '@/lib/personalization/compute-source'

export type V2Home = {
  /** Render <AuthLoadingGate/> while true (resolving identity, resolving chart, or redirecting). */
  showLoading: boolean
  greeting: { name: string }
  /** For Lamun's `useMascotFromCompute(computeSource)?.character ?? '/images/v2/mascot/01.png'`. */
  computeSource: ComputeMascotSource | null
}

// toComputeSource lives in a pure module (React-free) so the { data } envelope unwrap can be anchored
// without a DOM — see lib/personalization/compute-source.ts + scripts/compute-source.test.ts.

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
    // State-table (too's adversary — every outcome must resolve, NEVER infinite-load):
    //   UserGetById  {chart} → home · {no-chart} → register · {error/throw} → home+fallback (NOT
    //     register — a transient error must not force a returning user to re-setup; NOT stuck-loading)
    //   ChineseHoroscopeGet {ok} → home+char · {error/null/throw} → home+01.png fallback
    try {
      const user = (await UserGetById(userId)) as { error?: unknown; user_id?: string; result_code?: string }
      // Distinguish API-ERROR from genuine NO-CHART: a valid get-user response ALWAYS carries user_id.
      // An error (thrown → {error}, or a non-JSON 5xx body) has none — checking only `result_code` here
      // would treat an error as no-chart and mis-route a RETURNING user to register (too's HOLE 1).
      if (!user || user.error || !user.user_id) {
        // Can't determine the chart (API error) → land HOME on the fallback, don't strand, don't register.
        setComputeSource(null)
        setPhase('home')
        return
      }
      const { resultCode, isRefreshResult } = resolveReturningResult(user)
      if (!resultCode || isRefreshResult) {
        setPhase('redirecting')
        router.replace('/v2/register')
        return
      }
      let chart: unknown = null
      try {
        chart = await ChineseHoroscopeGet(userId, resultCode)
      } catch {
        chart = null // chart fetch failed → home on 01.png fallback (has-chart is already confirmed)
      }
      setComputeSource(chart && !(chart as { error?: unknown }).error ? toComputeSource(chart) : null)
      setPhase('home')
    } catch {
      // Any unexpected throw → land HOME with the fallback; never leave the gate spinning forever.
      setComputeSource(null)
      setPhase('home')
    }
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
