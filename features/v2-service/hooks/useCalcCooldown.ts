// features/v2-service/hooks/useCalcCooldown.ts — Phase 3 (#265): one minute between calculations,
// enforced from the button that spends the quota.
//
// WHY IT EXISTS: measured on prod, 454 free users went past their ceiling by tapping repeatedly — worst
// case 17 rows in 7 seconds. Every extra shot costs one calculation, so someone following the screen's
// own "ลองอีกครั้ง" could burn an allowance without ever seeing a result.
//
// 🔴 WHAT THIS DOES NOT DO — say it here so no one reads the name and assumes more. This is a control on
// ONE button in ONE tab. A second tab, a refresh mid-flight, or devtools all walk around it. The real
// race is server-side (the count happens before the calculation and the row is written ~3s after), and
// that lives in mootech-be#21. The guarantee here is exactly: *the same button cannot be fired twice
// inside a minute*.
//
// The deadline is stored, not the remaining seconds, and every tick recomputes from the clock — a
// decrementing counter drifts whenever the tab is backgrounded and throttled, and would also reset to a
// full minute across a remount, which is the "ถอยกลับมาแล้วยังนับต่อ" condition failing quietly.
import { useCallback, useEffect, useState } from 'react'

export const COOLDOWN_MS = 60_000

/** Per-user, so signing in as someone else does not inherit a stranger's cooldown. */
export function cooldownKey(userId: string): string {
  return `compat:lastCalcAt:${userId || 'anon'}`
}

function readLastAt(userId: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(cooldownKey(userId))
    const n = raw ? Number(raw) : 0
    // A garbage or future-dated value must not lock the button forever: anything that is not a sane past
    // timestamp is treated as "never pressed" rather than trusted.
    return Number.isFinite(n) && n > 0 && n <= Date.now() ? n : 0
  } catch {
    return 0 // storage disabled (private mode / blocked) — degrade to no cooldown, never to a dead button
  }
}

function remainingFrom(lastAt: number): number {
  if (!lastAt) return 0
  return Math.max(0, COOLDOWN_MS - (Date.now() - lastAt))
}

export type CalcCooldown = {
  /** whole seconds left, 0 when free to fire */
  secondsLeft: number
  active: boolean
  /** call at the MOMENT of the press — before the request, so a failed calculation still cools down */
  start: () => void
}

export function useCalcCooldown(userId: string): CalcCooldown {
  const [msLeft, setMsLeft] = useState(0)

  // Read on mount and whenever the identity changes. This is what survives navigating to the result and
  // coming back: the deadline is in storage, so the remount recomputes it instead of clearing it.
  useEffect(() => {
    setMsLeft(remainingFrom(readLastAt(userId)))
  }, [userId])

  useEffect(() => {
    if (msLeft <= 0) return
    const id = setInterval(() => setMsLeft(remainingFrom(readLastAt(userId))), 250)
    return () => clearInterval(id)
  }, [msLeft, userId])

  const start = useCallback(() => {
    const now = Date.now()
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(cooldownKey(userId), String(now))
    } catch {
      // Storage refused. The in-memory countdown below still runs for this mount, which is the case that
      // actually matters (rapid tapping); persistence across navigation is what is lost, not the guard.
    }
    setMsLeft(COOLDOWN_MS)
  }, [userId])

  return { secondsLeft: Math.ceil(msLeft / 1000), active: msLeft > 0, start }
}
