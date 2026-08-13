// features/v2-service/hooks/useQuota.ts — Phase 2 (#264), μุน's half: the client view of goo's
// GET /api/quota.
//
// WHY A 4-STATE UNION AND NOT `remaining: number | null`
// The screen must never print a number it does not have. If a failed or in-flight read collapses into
// the same value as a real zero, the indicator tells someone who still has quota that they are out —
// a wrong reason, which is strictly worse than the no-reason bug #263 just removed (that one only
// failed to explain; this one would explain incorrectly). `null` cannot carry "loading" AND
// "unavailable" AND "none left" without something downstream writing `?? 0`, so the three are separate
// constructors and there is no numeric field to read on the two that have no number.
//
// goo's wire type (QuotaRemaining in lib/usage-core.ts) has no loading/unavailable — correctly, since a
// response either exists or the request failed. Those two live HERE, which is where the fetch lives.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuotaRemaining } from '@/lib/usage-core'

export type QuotaView =
  /** the request is in flight and has never resolved — show nothing, not a zero */
  | { state: 'loading' }
  /** we could not read it (network, 5xx, malformed) — show nothing at all, and never guess */
  | { state: 'unavailable' }
  /** this quota is not capped for this user (member, matching) — no number exists to show */
  | { state: 'unlimited' }
  | { state: 'known'; remaining: number; limit: number; used: number }

export type Quotas = { matching: QuotaView; friend: QuotaView }

const LOADING: Quotas = { matching: { state: 'loading' }, friend: { state: 'loading' } }
const UNAVAILABLE: Quotas = { matching: { state: 'unavailable' }, friend: { state: 'unavailable' } }

/** Map one wire value → view. Anything not matching the contract is 'unavailable', never a number. */
function toView(q: QuotaRemaining | undefined): QuotaView {
  if (!q || typeof q !== 'object') return { state: 'unavailable' }
  if (q.unlimited === true) return { state: 'unlimited' }
  if (q.unlimited === false && typeof q.remaining === 'number' && typeof q.limit === 'number') {
    return { state: 'known', remaining: q.remaining, limit: q.limit, used: q.used }
  }
  return { state: 'unavailable' }
}

/**
 * Read both quotas for `userId`.
 *
 * Freshness (#264 done-cond: the number on screen must match what the server would decide):
 *  • on mount / whenever userId changes — covers coming BACK from the result route, since this screen
 *    remounts and a calculation that succeeded has already been counted by then.
 *  • via the returned `refetch`, for changes that happen WITHOUT leaving the screen — creating a friend
 *    is the real case: it decrements the friend quota while the user stands still.
 */
export function useQuota(userId: string): Quotas & { refetch: () => void } {
  const [quotas, setQuotas] = useState<Quotas>(LOADING)
  // Same alive/token guard the sibling hooks use: a slow response must not overwrite a newer one.
  const tokenRef = useRef(0)

  const load = useCallback(() => {
    if (!userId) {
      // No identity to ask about. Not an error and not a zero — there is simply nothing to show.
      setQuotas(UNAVAILABLE)
      return
    }
    const token = ++tokenRef.current
    setQuotas((prev) => (prev === LOADING ? prev : prev)) // keep the last known numbers while refetching
    ;(async () => {
      try {
        const res = await fetch(`/api/quota?user_id=${encodeURIComponent(userId)}`)
        if (!res.ok) throw new Error(`quota ${res.status}`)
        const body = (await res.json()) as { matching?: QuotaRemaining; friend?: QuotaRemaining }
        if (tokenRef.current !== token) return
        setQuotas({ matching: toView(body?.matching), friend: toView(body?.friend) })
      } catch {
        if (tokenRef.current !== token) return
        setQuotas(UNAVAILABLE)
      }
    })()
  }, [userId])

  useEffect(() => {
    load()
    return () => { tokenRef.current++ } // unmount invalidates any in-flight response
  }, [load])

  return { ...quotas, refetch: load }
}
