// MuMate v2 — logged-in home routing + data (logic seam). Fixes parity gap C: a RETURNING user (has a
// computed chart) must land on HOME, not be bounced back through register. Loop-safe: the register
// redirect fires ONLY on a settled 'authed' (useV2AuthGate guarantees it), from the surviving effect run,
// never during loading/self-heal. Lamun's <V2HomeScreen/> consumes { showLoading, greeting, computeSource,
// profile }.
//
// SINGLE UserGetById (#165): this hook is the ONE owner of the /api/user fetch on home. It exposes the
// fetched `user` so useHomeFortune consumes it instead of firing a SECOND UserGetById, and derives the
// header `profile` (avatar + upgrade badge) from the same row — one request feeds routing + fortune + header.
//
// Idempotent effect (#176 — same class as the fortune-card hang): NO doneRef latch. React StrictMode (dev)
// double-invokes; each run owns its `alive`, and the surviving run resolves. A persistent doneRef let run A
// win the latch, then its own cleanup stranded it (the /v2 hang). Prod mounts once. `router` is read via a
// ref so it is NOT an effect dependency (no refetch churn if router identity changes between renders).
//
// Compute-availability (goo trace): the chart is created AT profile-save — ChineseHoroscopeCalculate
// returns the compute synchronously, so profile-complete == compute-complete. Home re-reads it via
// ChineseHoroscopeGet(userId, result_code). While that fetch is in flight computeSource is null → Lamun
// shows the static hero 01.png fallback (safety).
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import type { AuthStatus } from '@/lib/auth/resolve-auth'
import { UserGetById } from '@/constants/api/api-user-get'
import { ChineseHoroscopeGet } from '@/constants/api/api-chinese-horoscope-get'
import { resolveReturningResult } from '@/lib/auth/returning-result'
import type { UserBirthRow } from '@/lib/bazi-bridge/input'
import type { ComputeMascotSource } from '@/lib/personalization/mascot'
import { toComputeSource } from '@/lib/personalization/compute-source'
import { deriveHomeProfile, type HomeProfile } from '@/lib/home/profile'
import { deriveHomeLoading, type HomeLoading } from '@/lib/home/loading'
import { peekChart, isChartFresh, setChart } from './chart-cache'
import { needsFirstRun } from '@/lib/home/first-run-gate'

export type { HomeProfile, HomeLoading }

// The home user row from UserGetById (/api/user): birth profile (for the fortune) + routing + header fields.
export type HomeUser = UserBirthRow & {
  error?: unknown
  user_id?: string
  result_code?: string
  picture_url?: string | null
  payment?: { is_not_expired?: boolean | null } | null
  // v2 first-run gate (#233): null on the settled row = user has never finished onboarding.
  onboarded_at?: string | null
}

// Header profile (goo → μุน seam, กติกา ค) lives in a pure module (lib/home/profile) so the rule is
// unit-testable; deriveHomeProfile matches v1 header-v2.tsx exactly.

export type V2Home = {
  /** Hold the frame (render <AuthLoadingGate/>) ONLY while identity is unsettled or we are actively
   *  redirecting a no-chart user to /v2/register — so home never FLASHES before that route change. The old
   *  data-loading wait is GONE: home is a terminal render the moment identity settles, and each zone fills
   *  in via `loading` below (no more full-screen white gate while the two home requests resolve). */
  redirecting: boolean
  greeting: { name: string }
  /** Per-zone data-loading flags for Lamun's screen (grey block until each zone's own data lands). */
  loading: HomeLoading
  /** For Lamun's `useMascotFromCompute(computeSource)?.character ?? '/images/v2/mascot/01.webp'`. */
  computeSource: ComputeMascotSource | null
  /** Avatar + upgrade-badge inputs for the header (derived from the single user fetch). */
  profile: HomeProfile
  /** The single fetched user row — pass to useHomeFortune so it does NOT re-fetch (#165). null until resolved. */
  user: HomeUser | null
}

// Takes the resolved auth `status` (NOT useV2AuthGate) — useV2AuthGate must be imported directly inside
// pages/v2 (complete-by-construction ban that keeps gated-page discovery complete); the caller passes status.
export function useV2Home(status: AuthStatus): V2Home {
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router
  const [cookies] = useCookies([CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const greeting = { name: (cookies[CookieKey.MEMBER_NAME] as string) || '' }
  const [phase, setPhase] = useState<'resolving' | 'home' | 'redirecting'>('resolving')
  const [computeSource, setComputeSource] = useState<ComputeMascotSource | null>(null)
  const [user, setUser] = useState<HomeUser | null>(null)
  // P3 (DoD#1): a cached chart lets the MASCOT un-grey INSTANTLY on remount (tab-switch back to home),
  // before UserGetById returns — while `profile` (avatar + upgrade badge) still waits for the LIVE row
  // (money-bug boundary, DoD#3, enforced in deriveHomeLoading — mascotReady never touches `profile`).
  const [mascotReady, setMascotReady] = useState(false)

  useEffect(() => {
    if (status !== 'authed' || !userId) return
    let alive = true
    // Instant mascot from the in-memory chart cache (DoD#1): show the cached chart the moment we remount,
    // before the UserGetById round-trip. Freshness is validated below once the live row's resultCode is
    // known — a match keeps it (no refetch), a mismatch (dob edited → new result_code) refetches + overwrites.
    const cached = peekChart(userId)
    if (cached) {
      setComputeSource(cached.chart)
      setMascotReady(true)
    }
    ;(async () => {
      // State-table (too's adversary — every outcome must resolve, NEVER infinite-load):
      //   UserGetById {chart} → home · {no-chart} → register · {error/throw} → home+fallback (NOT register:
      //     a transient error must not force a returning user to re-setup; NOT stuck-loading)
      //   ChineseHoroscopeGet {ok} → home+char · {error/null/throw} → home+01.png fallback
      try {
        const u = (await UserGetById(userId)) as HomeUser | null
        if (!alive) return // surviving-run guard: a stale StrictMode/unmounted run does nothing below (incl. redirect)
        // A valid get-user response ALWAYS carries user_id; an error (thrown → {error}, or a non-JSON 5xx
        // body) has none — checking only result_code would treat an error as no-chart and mis-route a
        // RETURNING user to register (too's HOLE 1).
        if (!u || u.error || !u.user_id) {
          setUser(null)
          setComputeSource(null)
          setMascotReady(false) // API error → drop any instant-cached mascot, fall back to 01.png (safe)
          setPhase('home') // can't determine chart (API error) → land HOME on fallback, don't strand, don't register
          return
        }
        setUser(u)
        const { resultCode, isRefreshResult } = resolveReturningResult(u)
        if (!resultCode || isRefreshResult) {
          setPhase('redirecting')
          routerRef.current.replace('/v2/register')
          return
        }
        // Onboarding gate (#233): a user WITH a chart who has never finished v2 first-run
        // (onboarded_at null on the SETTLED row) is routed to /v2/first-run. Read from the same
        // UserGetById row (no extra request, #165), and ONLY here — after the error guard
        // (u.user_id present) and the no-chart guard — so a null/loading row is NEVER misread as
        // "not onboarded" (the #215/gap-C loop class: a transient null must not force a redirect).
        // Loop-safe: first-run's save sets onboarded_at → next home run passes this and lands home.
        if (needsFirstRun(u)) {
          setPhase('redirecting')
          routerRef.current.replace('/v2/first-run')
          return
        }
        // Self-heal (DoD#2): the cached chart is correct ONLY if its resultCode matches the LIVE row's. A
        // match → the instant mascot IS fresh → skip ChineseHoroscopeGet entirely (revisit costs 0 fetch —
        // the P3 wiring invariant, proven live in harness/archive/run-home-chart-cache.ts — 🗄️ archived by #321, nothing runs it automatically). A mismatch (dob edited →
        // BE minted a new result_code, verified live testenv jvfQl2haFj2F→KBhQL58FQw8S) → refetch + overwrite.
        if (isChartFresh(userId, resultCode)) {
          setPhase('home')
          return
        }
        let chart: unknown = null
        try {
          chart = await ChineseHoroscopeGet(userId, resultCode)
        } catch {
          chart = null // chart fetch failed → home on 01.png fallback (has-chart is already confirmed)
        }
        if (!alive) return
        const compute = chart && !(chart as { error?: unknown }).error ? toComputeSource(chart) : null
        setComputeSource(compute)
        if (compute) {
          setChart(userId, resultCode, compute) // cache for the next remount's instant mascot (memory-only)
          setMascotReady(true)
        } else {
          setMascotReady(false) // chart null → 01.png fallback, and no stale cache to show next time
        }
        setPhase('home')
      } catch {
        if (alive) {
          // Any unexpected throw → land HOME with the fallback; never leave the gate spinning forever.
          setUser(null)
          setComputeSource(null)
          setMascotReady(false)
          setPhase('home')
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [status, userId])

  return {
    // Gate ONLY when identity is unsettled or we are routing a no-chart user to register — NOT while the
    // home data resolves ('resolving' now renders the screen with grey zones, so there is no white gate).
    redirecting: status !== 'authed' || phase === 'redirecting',
    greeting,
    // Progressive reveal: profile un-greys when the user row lands; mascot un-greys the moment a cached
    // chart is available (mascotReady) OR the fetch lands. On an API error we settle to 'home' with no
    // user/compute → both false → safe fallbacks show, never stuck grey.
    loading: deriveHomeLoading(phase, user !== null, mascotReady),
    computeSource,
    profile: deriveHomeProfile(user),
    user,
  }
}
