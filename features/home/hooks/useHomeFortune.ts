// MuMate v2 home — Zone 1 daily-fortune data hook (logic seam). Lamun's ScoreRingCard consumes
// { fortune, loading }. Fetches the user's birth profile, builds the bazi `person` via the existing
// mapper, and calls the same-origin BFF (/api/home-fortune → bazi /api/home). grade = gradeForPercent
// from bazi (single-sourced).
//
// State-table (completeness-pass — every outcome RESOLVES, never a stuck skeleton):
//   no userId (race) → wait; effect re-runs when the cookie syncs (userId dep)
//   UserGetById error / no user_id / incomplete birth profile → fortune=null, loading=false (fallback)
//   BFF/bazi error / timeout → fortune=null, loading=false (BFF already degrades to {fortune:null})
//   success → fortune, loading=false
import { useEffect, useRef, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { UserGetById } from '@/constants/api/api-user-get'
import { userRowToFeCalcInput, isBirthProfileComplete, type UserBirthRow } from '@/lib/bazi-bridge/input'
import type { DailyFortune } from '@/pages/api/home-fortune'

export type { DailyFortune }

export function useHomeFortune(): { fortune: DailyFortune | null; loading: boolean } {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [fortune, setFortune] = useState<DailyFortune | null>(null)
  const [loading, setLoading] = useState(true)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!userId || doneRef.current) return // no id yet → effect re-runs when the cookie syncs
    doneRef.current = true
    let alive = true
    ;(async () => {
      try {
        const user = (await UserGetById(userId)) as (UserBirthRow & { error?: unknown; user_id?: string }) | null
        // No usable profile → no card (graceful). isBirthProfileComplete guards dob+gender (never guess).
        if (!user || user.error || !user.user_id || !isBirthProfileComplete(user)) return
        const person = userRowToFeCalcInput(user)
        const r = await fetch('/api/home-fortune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person, anonId: userId }),
        })
        const data = (r.ok ? await r.json() : { fortune: null }) as { fortune: DailyFortune | null }
        if (alive) setFortune(data.fortune ?? null)
      } catch {
        if (alive) setFortune(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  return { fortune, loading }
}
