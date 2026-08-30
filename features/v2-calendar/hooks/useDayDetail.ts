// MuMate v2 — ปฏิทินดวง · useDayDetail (goo · G-2). The card's จังหวะ-2 text + the day-detail screen.
//
// Given the selected date it returns { detail, loading }: detail from the real /api/v2/day-detail pipe
// (adapted lib→feature), null while loading / when there's no identity. The card's RING (grade/%/干支/วันพระ)
// comes INSTANT from the month cell (จังหวะ-1, μุน's M-B) — this hook only feeds the TEXT (จังหวะ-2), so the
// ring is never blank while the text loads.
//
// 🚨 ANTI-LATCH (the trap that spun PR#97 six rounds): NO doneRef. Each date owns its `alive`; on a date
// change the previous effect's cleanup sets alive=false, so its (now stale) response can NEVER setState —
// clicking day 2 shows day 2, never a latched day 1. The surviving run resolves. Re-viewing a day is instant
// and never re-fetches (day-detail-cache — safe RESOLVED cache because a day's fortune is deterministic).
// Prefetch today on mount (most users view today first) so the default card is warm.
import { useEffect, useMemo, useState } from 'react'
import { useV2User } from '@/features/auth/hooks/useV2User'
import { useHasMounted } from '@/lib/hooks/use-has-mounted'
import { isBirthProfileComplete, userRowToFeCalcInput } from '@/lib/bazi-bridge/input'
import { isPaidMember } from '@/lib/v2/tier'
import type { DayDetail } from '../types'
import { bangkokTodayISO } from '../today'
import { fetchDayDetail, type DayDetailResponse } from './fetch-day-detail'
import { libDayDetailToFeature } from './day-detail-adapter'
import { dayKey, getDayDetail, peekDayDetail, type CachedDay } from './day-detail-cache'

export interface UseDayDetail {
  /** the selected day's detail — `null` while loading, or when there is no identity/complete profile. */
  detail: DayDetail | null
  /** true while the day-detail fetch is in flight (the card keeps its ring; only the text waits). */
  loading: boolean
  /**
   * 🔴 #529 — THE THIRD STATE. `detail: null` with `loading: false` used to mean all of: the upstream
   * timed out · there is no identity · the birth profile is incomplete · and (since #358 Phase 3) *this
   * day is outside what your package sells*. The last one is not a failure and must not read as one:
   * ฟีมเคาะ 2026-08-24 that pressing past your span should INVITE AN UPGRADE, and a state indistinguishable
   * from breakage cannot invite anything — least of all to the FREE user we are trying to sell to.
   *
   * true ⇒ a paid wall. false ⇒ everything else, including every genuine failure. A screen that ignores
   * this field behaves exactly as it did before.
   */
  outOfSpan: boolean
}

/** #529 — response → the record the cache MAY hold. A walled day is never stored (isCacheableDay), so
 *  `outOfSpan` reaches the screen from a live answer every time rather than from memory; `cached`/
 *  `degraded` are facts about one request and are dropped here for the same reason. */
function toCachedDay(r: DayDetailResponse): CachedDay {
  return { detail: r.detail, outOfSpan: r.outOfSpan === true }
}

/** #529 — the cached record → what the screen reads. One place performs the lib→feature adaptation, so
 *  the cache-hit branch and the fetch branch cannot answer differently for the same stored day. */
function toState(day: CachedDay): { detail: DayDetail | null; outOfSpan: boolean } {
  return { detail: day.detail ? libDayDetailToFeature(day.detail) : null, outOfSpan: day.outOfSpan }
}

export function useDayDetail(date: string): UseDayDetail {
  const hasMounted = useHasMounted()
  const { userId, user } = useV2User()
  const person = useMemo(() => (user && isBirthProfileComplete(user) ? userRowToFeCalcInput(user) : null), [user])
  // #226 — the reply is now TIER-SHAPED (the BFF trims the paid sections for a free caller), so the tier is
  // part of what identifies a cached day. Read from the SAME row `person` comes from, through the one frozen
  // client rule (isPaidMember) — never a second definition of "paid". `person` is non-null below, so `user`
  // is too: the tier is known whenever a key gets built.
  const paid = isPaidMember(user)
  // Same determinants as the BFF cache key — dob edit → new signature → no cross-birth stale.
  const birthSig = useMemo(() => (person ? JSON.stringify(person) : ''), [person])

  const [state, setState] = useState<{ detail: DayDetail | null; loading: boolean; outOfSpan: boolean }>({
    detail: null,
    loading: true,
    outOfSpan: false,
  })

  // Prefetch today once identity is ready — fire-and-forget into the shared cache (sets no state).
  useEffect(() => {
    if (!hasMounted || !userId || !person) return
    const today = bangkokTodayISO()
    const k = dayKey(userId, birthSig, today, paid)
    if (peekDayDetail(k) === undefined) {
      // #529 — the prefetch stores the SAME record the selected-day path stores. Caching `r.detail` here
      // and the full record there would make today's card depend on which path warmed it.
      void getDayDetail(k, () => fetchDayDetail(person, today).then(toCachedDay))
    }
  }, [hasMounted, userId, birthSig, person, paid])

  // The selected day's detail — anti-latch on [date].
  useEffect(() => {
    if (!date || !userId || !person) {
      setState({ detail: null, loading: false, outOfSpan: false })
      return
    }
    const k = dayKey(userId, birthSig, date, paid)

    // Resolved-hit → render in THIS tick (no loading flash, no re-fetch).
    const peeked = peekDayDetail(k)
    if (peeked !== undefined) {
      // #529 — an out-of-span day is out-of-span on a re-view too. The cache used to hold the detail
      // alone, so this branch could only ever answer "no detail" and the wall became a crash on every hit.
      setState({ ...toState(peeked), loading: false })
      return
    }

    let alive = true
    setState({ detail: null, loading: true, outOfSpan: false }) // new day → clear old text; the ring (month cell) stays visible
    getDayDetail(k, () => fetchDayDetail(person, date).then(toCachedDay)).then((day) => {
      if (!alive) return // date changed / unmounted mid-flight → drop this stale response (THE anti-latch)
      setState({ ...toState(day), loading: false })
    })
    return () => {
      alive = false
    }
  }, [date, userId, birthSig, person, paid])

  return state
}
