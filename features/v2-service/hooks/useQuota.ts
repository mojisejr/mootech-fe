// features/v2-service/hooks/useQuota.ts — Phase 2 (#264), μุน's half: the client view of the quota route.
//
// 🔴 #358 Phase 6 REPOINTED THIS AT /api/v2/quota, and the URL is the whole change — the wire shape, the
// view union and every consumer are untouched. It used to read /api/quota, which is v1's: 100 per YEAR,
// capped for free users only. This is a v2 hook read by the v2 compatibility screen, so once Phase 6 made
// the server refuse at 2/20/unlimited per MONTH, the old URL had the screen printing a number the server
// would not honour. The v1 route still exists and still answers v1 exactly as before.
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

/**
 * #557 — the two fields the ดวงสมพงษ์ quota carries and the เพิ่มเพื่อน quota does not.
 *
 * OPTIONAL on purpose. `friend` is v1's lifetime ceiling (#262): it has no window, so it has no reset day,
 * and demanding one here would turn a perfectly good friend quota into 'unavailable'. A consumer that has
 * no resetAt must say nothing about time rather than fall back to a period word — falling back is the
 * hand-typed claim this ticket removes.
 */
export type QuotaWindow = { resetAt?: string; tier?: string }

export type QuotaView =
  /** the request is in flight and has never resolved — show nothing, not a zero */
  | { state: 'loading' }
  /** we could not read it (network, 5xx, malformed) — show nothing at all, and never guess */
  | { state: 'unavailable' }
  /** this quota is not capped for this user (member, matching) — no number exists to show */
  | ({ state: 'unlimited' } & QuotaWindow)
  | ({ state: 'known'; remaining: number; limit: number; used: number } & QuotaWindow)

export type Quotas = { matching: QuotaView; friend: QuotaView }

const LOADING: Quotas = { matching: { state: 'loading' }, friend: { state: 'loading' } }
const UNAVAILABLE: Quotas = { matching: { state: 'unavailable' }, friend: { state: 'unavailable' } }

/**
 * The window half of the wire value, kept only when it is really there. A malformed resetAt is DROPPED
 * rather than passed on: the caller's "no date → say nothing about time" branch is the honest answer, and
 * it is the same branch the friend quota takes.
 */
function windowOf(q: unknown): QuotaWindow {
  const w = q as { resetAt?: unknown; tier?: unknown }
  const out: QuotaWindow = {}
  if (typeof w?.resetAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.resetAt)) out.resetAt = w.resetAt
  if (typeof w?.tier === 'string' && w.tier) out.tier = w.tier
  return out
}

/** Map one wire value → view. Anything not matching the contract is 'unavailable', never a number. */
function toView(q: QuotaRemaining | undefined): QuotaView {
  if (!q || typeof q !== 'object') return { state: 'unavailable' }
  if (q.unlimited === true) return { state: 'unlimited', ...windowOf(q) }
  if (q.unlimited === false && typeof q.remaining === 'number' && typeof q.limit === 'number') {
    return { state: 'known', remaining: q.remaining, limit: q.limit, used: q.used, ...windowOf(q) }
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
        // No `user_id` on the wire: /api/v2/quota takes its subject from the signed session (#391). The
        // `userId` argument still gates the call below, because a screen with no identity has nothing to
        // ask about — but it is not what the server believes.
        const res = await fetch('/api/v2/quota')
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
