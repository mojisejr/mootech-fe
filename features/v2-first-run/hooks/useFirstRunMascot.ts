import { useEffect, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { UserGetById } from '@/constants/api/api-user-get'
import { ChineseHoroscopeGet } from '@/constants/api/api-chinese-horoscope-get'
import { resolveReturningResult } from '@/lib/auth/returning-result'
import { toComputeSource } from '@/lib/personalization/compute-source'
import { resolveMascotFromCompute, type MascotResult } from '@/lib/personalization/mascot'

// First-run element screen needs the user's REAL mascot (card art + element). It comes from the same
// compute home uses — chart created at register, re-read via ChineseHoroscopeGet — so the element on
// this screen can never disagree with the home greeting (#233 split-brain rule; the screen also logs a
// mismatch if the bazi summary names a different element). cycle + summary are Phase C; here the mascot
// (art + element) is the free, immediate half.
//
// Idempotent effect, no doneRef latch, per-run `alive` guard — same StrictMode-safe shape as useV2Home.
export function useFirstRunMascot(): { mascot: MascotResult | null; loading: boolean } {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [mascot, setMascot] = useState<MascotResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let alive = true
    ;(async () => {
      try {
        const u = await UserGetById(userId)
        if (!alive) return
        if (!u || u.error || !u.user_id) return // no user row → leave mascot null (caller shows a fallback)
        const { resultCode, isRefreshResult } = resolveReturningResult(u)
        if (!resultCode || isRefreshResult) return // no computed chart yet → no mascot to show
        const chart = await ChineseHoroscopeGet(userId, resultCode)
        if (!alive) return
        setMascot(resolveMascotFromCompute(toComputeSource(chart)))
      } catch {
        // network/parse failure → leave mascot null; the route renders its fallback, never throws
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  return { mascot, loading }
}
