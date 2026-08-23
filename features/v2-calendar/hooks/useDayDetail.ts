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
import { fetchDayDetail } from './fetch-day-detail'
import { libDayDetailToFeature } from './day-detail-adapter'
import { dayKey, getDayDetail, peekDayDetail } from './day-detail-cache'

export interface UseDayDetail {
  /** the selected day's detail — `null` while loading, or when there is no identity/complete profile. */
  detail: DayDetail | null
  /** true while the day-detail fetch is in flight (the card keeps its ring; only the text waits). */
  loading: boolean
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

  const [state, setState] = useState<{ detail: DayDetail | null; loading: boolean }>({ detail: null, loading: true })

  // Prefetch today once identity is ready — fire-and-forget into the shared cache (sets no state).
  useEffect(() => {
    if (!hasMounted || !userId || !person) return
    const today = bangkokTodayISO()
    const k = dayKey(userId, birthSig, today, paid)
    if (peekDayDetail(k) === undefined) {
      void getDayDetail(k, () => fetchDayDetail(person, today).then((r) => r.detail))
    }
  }, [hasMounted, userId, birthSig, person, paid])

  // The selected day's detail — anti-latch on [date].
  useEffect(() => {
    if (!date || !userId || !person) {
      setState({ detail: null, loading: false })
      return
    }
    const k = dayKey(userId, birthSig, date, paid)

    // Resolved-hit → render in THIS tick (no loading flash, no re-fetch).
    const peeked = peekDayDetail(k)
    if (peeked !== undefined) {
      setState({ detail: peeked ? libDayDetailToFeature(peeked) : null, loading: false })
      return
    }

    let alive = true
    setState({ detail: null, loading: true }) // new day → clear old text; the ring (month cell) stays visible
    getDayDetail(k, () => fetchDayDetail(person, date).then((r) => r.detail)).then((lib) => {
      if (!alive) return // date changed / unmounted mid-flight → drop this stale response (THE anti-latch)
      setState({ detail: lib ? libDayDetailToFeature(lib) : null, loading: false })
    })
    return () => {
      alive = false
    }
  }, [date, userId, birthSig, person, paid])

  return state
}
