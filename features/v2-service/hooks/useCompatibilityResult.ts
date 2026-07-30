// features/v2-service/hooks/useCompatibilityResult.ts — ดวงสมพงศ์ Slice 2C RESULT hook.
// goo owns: read the calculated result (v1 get-detail), parse it (compatibility-result.ts),
// and fetch the two mascots. μุน owns: the result screen that renders the returned contract and
// hides whatever is undefined.
//
// State-table (charter completeness — EVERY outcome resolves, NEVER infinite-load):
//   result: no matchingId → resolved{null}, loading OFF · loading → resolved{parsed} ·
//     API throw / malformed / legacy-no-pairMatch → resolved{null} + error=true (screen shows a
//     fallback, does NOT strand or fabricate).
//   mascots: fetched once dayGanzhi is known; a missing ganzhi or a 404 → undefined/null (the
//     screen hides that card — rule 4). Re-fetch is race-guarded by an alive flag.
import { useEffect, useRef, useState } from 'react'
import { UserMatchingCalculateApi } from '@/constants/api/api-user-matching-calculate'
import { UserMatchingGetDetailApi } from '@/constants/api/api-user-matching-get-detail'
import {
  parseCompatibilityResult,
  mascotGanzhiPair,
  type CompatibilityResult,
  type CompatMascot,
} from '../compatibility-result'
import type { MatchingType } from '../compatibility'

export type { CompatibilityResult, CompatMascot }

export type UseCompatibilityResult = {
  /** true while the calculated result is being read */
  loading: boolean
  /** true only when the result could not be loaded/parsed (screen shows a fallback, not a spinner) */
  error: boolean
  /** the parsed contract, or null when unavailable */
  result: CompatibilityResult | null
  /** mascot for person A's day-ganzhi — undefined (not fetched / no ganzhi) or null (not found) → hide card */
  mascotA?: CompatMascot | null
  /** mascot for person B's day-ganzhi */
  mascotB?: CompatMascot | null
  /** true while the two mascots are being fetched */
  loadingMascots: boolean
}

async function fetchMascot(ganzhi: string): Promise<CompatMascot | null> {
  try {
    const r = await fetch(`/api/bazi/mascot/${encodeURIComponent(ganzhi)}`)
    if (!r.ok) return null
    const data = (await r.json()) as { mascot?: CompatMascot | null }
    return data?.mascot ?? null
  } catch {
    return null // unreachable/timeout → hide the card, never throw at the user
  }
}

export function useCompatibilityResult(matchingId: string): UseCompatibilityResult {
  const [loading, setLoading] = useState<boolean>(!!matchingId)
  const [error, setError] = useState<boolean>(false)
  const [result, setResult] = useState<CompatibilityResult | null>(null)
  const [mascotA, setMascotA] = useState<CompatMascot | null | undefined>(undefined)
  const [mascotB, setMascotB] = useState<CompatMascot | null | undefined>(undefined)
  const [loadingMascots, setLoadingMascots] = useState<boolean>(false)

  // Read + parse the calculated result. Idempotent effect (alive guard, no doneRef latch) so
  // StrictMode's double-invoke in dev resolves cleanly; prod mounts once.
  useEffect(() => {
    if (!matchingId) {
      setResult(null)
      setError(false)
      setLoading(false) // no id → resolved-empty, NOT stuck loading
      return
    }
    let alive = true
    setLoading(true)
    setError(false)
    ;(async () => {
      try {
        const resp = await UserMatchingGetDetailApi(matchingId)
        if (!alive) return
        const parsed = parseCompatibilityResult(resp)
        setResult(parsed)
        setError(parsed === null) // couldn't parse / no pairMatch → error state, screen shows fallback
      } catch {
        if (alive) {
          setResult(null)
          setError(true)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [matchingId])

  // Fetch the two mascots once the result's day-ganzhi are known. A missing ganzhi is skipped
  // (undefined) so the screen hides that card; no fabricated ganzhi.
  useEffect(() => {
    const { a, b } = mascotGanzhiPair(result)
    if (!a && !b) {
      setMascotA(undefined)
      setMascotB(undefined)
      setLoadingMascots(false)
      return
    }
    let alive = true
    setLoadingMascots(true)
    ;(async () => {
      const [ma, mb] = await Promise.all([
        a ? fetchMascot(a) : Promise.resolve<CompatMascot | null | undefined>(undefined),
        b ? fetchMascot(b) : Promise.resolve<CompatMascot | null | undefined>(undefined),
      ])
      if (!alive) return
      setMascotA(ma)
      setMascotB(mb)
      setLoadingMascots(false)
    })()
    return () => {
      alive = false
    }
  }, [result])

  return { loading, error, result, mascotA, mascotB, loadingMascots }
}

// --- calculate wrapper (goo's v1-wrap lane) -------------------------------------------------
// The RESULT slice's side-effecting call: UserMatchingCalculateApi creates a log row + consumes
// the user's matching quota, then returns { matching_id }. Wrapped here so μุน's view-result
// button just awaits a typed result and navigates. ⚠️ μุน owns the button's client state machine
// (guard double-tap so it fires ONCE, show loading, on error keep the user on the input screen —
// do NOT navigate). A genuine membership/limit gate returns NO matching_id (not an exception).
export type CalculateCompatibilityResult =
  | { ok: true; matchingId: string }
  | { ok: false; error: unknown }

export async function calculateCompatibility(
  userId: string,
  friendId: string,
  matchingType: MatchingType,
): Promise<CalculateCompatibilityResult> {
  if (!userId || !friendId) return { ok: false, error: 'missing-person' }
  try {
    const res = (await UserMatchingCalculateApi(userId, friendId, matchingType)) as
      | { matching_id?: string; error?: unknown }
      | null
    if (!res || res.error || !res.matching_id) {
      return { ok: false, error: res?.error ?? 'no-matching-id' } // membership/limit gate → no id
    }
    return { ok: true, matchingId: res.matching_id }
  } catch (error) {
    return { ok: false, error }
  }
}
