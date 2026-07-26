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
import { useEffect, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { UserGetById } from '@/constants/api/api-user-get'
import { userRowToFeCalcInput, isBirthProfileComplete, type UserBirthRow } from '@/lib/bazi-bridge/input'
import type { DailyFortune, HomePersona } from '@/pages/api/home-fortune'

export type { DailyFortune, HomePersona }

// One BFF call (/api/home-fortune → bazi /api/home) returns BOTH the daily fortune and the persona
// (ธาตุ + strength) — bazi derives them from the same compute, so exposing both here keeps it to a
// single round-trip (no second bazi compute). ScoreRingCard consumes `fortune`; the greeting ธาตุ
// line consumes `persona.strengthLabel` (element comes from the compute/mascot source at the wire).
export function useHomeFortune(): { fortune: DailyFortune | null; persona: HomePersona | null; loading: boolean } {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [fortune, setFortune] = useState<DailyFortune | null>(null)
  const [persona, setPersona] = useState<HomePersona | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Idempotent effect (no doneRef latch). React StrictMode (dev) double-invokes: run A fires, its
    // cleanup sets alive=false, run B fires fresh. Each invocation owns its `alive`; the surviving run
    // resolves `loading`. A persistent doneRef would let run A win the latch, then its cleanup kills
    // its own alive → `finally { if (alive) setLoading(false) }` is skipped and the skeleton hangs
    // forever (the /v2 fortune-card bug). It also blocked re-fetch when userId changed. Prod builds
    // mount once; /api/home-fortune is an idempotent daily compute, so the dev double-call is harmless.
    if (!userId) return // no id yet → effect re-runs when the cookie syncs (userId dep)
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
        const data = (r.ok ? await r.json() : { fortune: null, persona: null }) as {
          fortune: DailyFortune | null
          persona: HomePersona | null
        }
        if (alive) {
          setFortune(data.fortune ?? null)
          setPersona(data.persona ?? null)
        }
      } catch {
        if (alive) {
          setFortune(null)
          setPersona(null)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  return { fortune, persona, loading }
}
