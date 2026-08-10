import { useEffect, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { UserGetById } from '@/constants/api/api-user-get'
import { ChineseHoroscopeGet } from '@/constants/api/api-chinese-horoscope-get'
import { resolveReturningResult } from '@/lib/auth/returning-result'
import { toComputeSource } from '@/lib/personalization/compute-source'
import { resolveMascotFromCompute, type MascotResult } from '@/lib/personalization/mascot'
import type {
  ElementResultSource,
  ElementCycleRow,
  AsyncState,
  ElementSummary,
} from '@/features/v2-first-run/components/ElementResultScreen'
import { cycleFromChart, toBaziGender } from './first-run-source-map'
import { getSummary } from './summary-cache'

// The first-run element screen needs three things (#233). Two are FREE and immediate — they ride the
// chart the user already computed at register (ChineseHoroscopeGet):
//   • mascot  — card art + element, resolved from the same compute home uses (split-brain safe).
//   • cycle   — chart.elementCycle IS the DB element_cycle row, joined server-side by (element, power,
//               gender). No second query. `null` (e.g. gender missing ⇒ no join) → `unavailable`.
// One is SLOW (~10s): the per-person reading from POST /api/bazi/element-summary, fetched here (C3 will
// prefetch it at register so it is usually ready by the time the user finishes intent + pdpa).
// The pure mappers live in first-run-source-map.ts; the summary fetch + prefetch cache in summary-cache.ts.

// Assembles ElementResultSource. `source` is null until the mascot resolves (the route holds a frame);
// cycle is ready with the chart; summary streams in and starts `loading`.
// `status` is the OUTER discipline (μุน, #240): `source | null` alone conflated "still asking" with
// "asked, nothing" — a null source froze the route on the loading frame forever. status splits them:
//   loading      — the fetch is in flight
//   ready        — mascot resolved (source is non-null); cycle/summary stream via their own AsyncState
//   unavailable  — finished with nothing (no user row / no chart / no mascot / fetch failed) → the route
//                  shows a way OUT (home button), never a permanent spinner.
export function useFirstRunSource(): {
  source: ElementResultSource | null
  status: 'loading' | 'ready' | 'unavailable'
} {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [mascot, setMascot] = useState<MascotResult | null>(null)
  const [cycle, setCycle] = useState<AsyncState<ElementCycleRow>>({ status: 'loading' })
  const [summary, setSummary] = useState<AsyncState<ElementSummary>>({ status: 'loading' })
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    if (!userId) {
      setStatus('unavailable') // no identity → cannot compute; give the route a terminal state, not a spinner
      return
    }
    let alive = true
    ;(async () => {
      try {
        const u = await UserGetById(userId)
        if (!alive) return
        if (!u || u.error || !u.user_id) return setStatus('unavailable') // no user row
        const { resultCode, isRefreshResult } = resolveReturningResult(u)
        if (!resultCode || isRefreshResult) return setStatus('unavailable') // no computed chart yet
        const chart = await ChineseHoroscopeGet(userId, resultCode)
        if (!alive) return
        const data = ((chart as { data?: unknown })?.data ?? chart) as Record<string, unknown>
        const m = resolveMascotFromCompute(toComputeSource(chart))
        setMascot(m)
        setCycle(cycleFromChart(data?.elementCycle))
        setStatus(m ? 'ready' : 'unavailable') // no mascot resolved → nothing to draw → terminal
        const person = {
          birthDate: String(data?.dob ?? ''),
          birthTime: data?.time ? String(data.time) : undefined,
          gender: toBaziGender(data?.gender),
        }
        const s = await getSummary(userId, person) // reuses the register-time prefetch (C3) if present
        if (alive) setSummary(s)
      } catch {
        if (alive) setStatus('unavailable') // network/parse failure → terminal, never a permanent spinner
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  return { source: mascot ? { mascot, cycle, summary } : null, status }
}
