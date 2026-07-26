// MuMate v2 home — Zone 1 daily-fortune data hook (logic seam). Lamun's ScoreRingCard consumes
// { fortune, loading }. Consumes the user row fetched ONCE by useV2Home (#165 — NO second UserGetById
// here), builds the bazi `person` via the existing mapper, and calls the same-origin BFF
// (/api/home-fortune → bazi /api/home). grade = gradeForPercent from bazi (single-sourced).
//
// State-table (completeness-pass — every outcome RESOLVES, never a stuck skeleton):
//   no user yet → loading=true (wait; effect re-runs when useV2Home resolves the user)
//   no user_id / error / incomplete birth profile → fortune=null, loading=false (fallback)
//   BFF/bazi error / timeout → fortune=null, loading=false (BFF already degrades to {fortune:null})
//   success → fortune, loading=false
import { useEffect, useState } from 'react'
import { userRowToFeCalcInput, isBirthProfileComplete } from '@/lib/bazi-bridge/input'
import type { HomeUser } from '@/features/auth/hooks/useV2Home'
import type { DailyFortune, HomePersona } from '@/pages/api/home-fortune'

export type { DailyFortune, HomePersona }

// One BFF call (/api/home-fortune → bazi /api/home) returns BOTH the daily fortune and the persona
// (ธาตุ + strength) — bazi derives them from the same compute, so exposing both here keeps it to a
// single round-trip (no second bazi compute). ScoreRingCard consumes `fortune`; the greeting ธาตุ
// line consumes `persona.strengthLabel` (element comes from the compute/mascot source at the wire).
export function useHomeFortune(user: HomeUser | null): { fortune: DailyFortune | null; persona: HomePersona | null; loading: boolean } {
  const [fortune, setFortune] = useState<DailyFortune | null>(null)
  const [persona, setPersona] = useState<HomePersona | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Idempotent effect (no doneRef latch). React StrictMode (dev) double-invokes: run A fires, its
    // cleanup sets alive=false, run B fires fresh. Each invocation owns its `alive`; the surviving run
    // resolves `loading`. A persistent doneRef would let run A win the latch, then its cleanup kills its
    // own alive → `finally { if (alive) setLoading(false) }` is skipped and the skeleton hangs forever
    // (the /v2 fortune-card bug). Prod builds mount once; /api/home-fortune is an idempotent daily
    // compute, so the dev double-call is harmless.
    // No usable profile → no card (graceful). isBirthProfileComplete guards dob+gender (never guess).
    if (!user || user.error || !user.user_id || !isBirthProfileComplete(user)) {
      setFortune(null)
      setPersona(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const person = userRowToFeCalcInput(user)
        const r = await fetch('/api/home-fortune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person, anonId: user.user_id }),
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
  }, [user])

  return { fortune, persona, loading }
}
