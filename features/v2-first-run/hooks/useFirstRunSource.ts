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
import { cycleFromChart, summaryStateFromResponse, toBaziGender } from './first-run-source-map'

// The first-run element screen needs three things (#233). Two are FREE and immediate — they ride the
// chart the user already computed at register (ChineseHoroscopeGet):
//   • mascot  — card art + element, resolved from the same compute home uses (split-brain safe).
//   • cycle   — chart.elementCycle IS the DB element_cycle row, joined server-side by (element, power,
//               gender). No second query. `null` (e.g. gender missing ⇒ no join) → `unavailable`.
// One is SLOW (~10s): the per-person reading from POST /api/bazi/element-summary, fetched here (C3 will
// prefetch it at register so it is usually ready by the time the user finishes intent + pdpa).
// The pure mappers live in first-run-source-map.ts so they are unit-testable without React.

async function fetchSummary(person: {
  birthDate: string
  birthTime?: string
  gender: 'male' | 'female' | 'unspecified'
}): Promise<AsyncState<ElementSummary>> {
  try {
    const r = await fetch('/api/bazi/element-summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ person }),
    })
    const body = await r.json().catch(() => null)
    return summaryStateFromResponse(r.ok, body)
  } catch {
    return { status: 'error' } // timeout / network / abort → error, never a silent "nothing here"
  }
}

// Assembles ElementResultSource. `source` is null until the mascot resolves (the route holds a frame);
// cycle is ready with the chart; summary streams in and starts `loading`.
export function useFirstRunSource(): { source: ElementResultSource | null } {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [mascot, setMascot] = useState<MascotResult | null>(null)
  const [cycle, setCycle] = useState<AsyncState<ElementCycleRow>>({ status: 'loading' })
  const [summary, setSummary] = useState<AsyncState<ElementSummary>>({ status: 'loading' })

  useEffect(() => {
    if (!userId) return
    let alive = true
    ;(async () => {
      try {
        const u = await UserGetById(userId)
        if (!alive) return
        if (!u || u.error || !u.user_id) return // no user row → leave source null (route shows fallback)
        const { resultCode, isRefreshResult } = resolveReturningResult(u)
        if (!resultCode || isRefreshResult) return // no computed chart yet → nothing to show
        const chart = await ChineseHoroscopeGet(userId, resultCode)
        if (!alive) return
        const data = ((chart as { data?: unknown })?.data ?? chart) as Record<string, unknown>
        setMascot(resolveMascotFromCompute(toComputeSource(chart)))
        setCycle(cycleFromChart(data?.elementCycle))
        const person = {
          birthDate: String(data?.dob ?? ''),
          birthTime: data?.time ? String(data.time) : undefined,
          gender: toBaziGender(data?.gender),
        }
        const s = await fetchSummary(person)
        if (alive) setSummary(s)
      } catch {
        // network/parse failure → leave mascot null; the route renders its fallback, never throws
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  return { source: mascot ? { mascot, cycle, summary } : null }
}
