// MuMate v2 — ปฏิทินดวง · useCalendarMonth (goo · CLIENT-TRUTH state + layer-2 data).
// Month cursor (prev/next/today) + the grid + the selected day.
//
// 🔒 SEAM (locked by บอง 2026-08-05 — do NOT change this shape without asking; μุน's screen binds to it):
//   month: CalendarMonth | null   — the whole month arrives as ONE API blob, so the only real states are
//                                    "no month yet" (null) and "full month". There is NO per-day unknown.
//   loading: boolean              — true while the month is not yet available.
//   selectedDate: string | null   — the day the card follows (null before the rule resolves it post-mount).
//   selectDay(date)               — user picks a day (grid cell → button, μุน's M-A).
//   year · monthIndex : number | null — the cursor's year/month, or `null` before the cursor resolves
//                                    (pre-mount). NEVER a made-up month: the old `?? MOCK_YEAR/MOCK_MONTH`
//                                    fallback (กรกฎาคม 2569) leaked as a real default (#208) — killed here so a
//                                    not-yet-known cursor reads honestly as null. Post-mount the cursor is ALWAYS
//                                    set (Bangkok-today or a nav), so month/year are real in EVERY data state —
//                                    loading · fetch-failed · anon · no-birth — which is what lets μุน keep the
//                                    [today][month][year] selector on screen always (the user's escape when a
//                                    month fails). (seam revised with บอง 2026-08-07 — selector-always)
//   todayISO · goPrev · goNext · goToday — unchanged (nav moves the cursor, so it works with month = null).
//
// CURSOR = null until mount, then Bangkok-TODAY's month (บอง's catch 2026-08-05). Resolving the current
// month CLIENT-SIDE post-mount — the SAME fence as todayISO — is why `month` is nullable: server + first
// client paint both see `null` (no clock-straddle hydration mismatch), then the effect sets today's month.
// This also matches G-0c's reality: a PERSONALISED month is fetched client-side (needs auth) and can never
// be SSR'd, so "null on first paint" is the truth either way.
//
// G-0c: the month now comes from the REAL pipe — /api/v2/calendar-month (BFF → bazi man-vs-day + almanac),
// adapted by assembleFeatureMonth. Identity (userId + birth `person`) comes from useV2User (the shared,
// de-duplicated /api/user fetch — no second UserGetById on the page, #165). The state machine below RESOLVES
// every branch (cursor / anon / user-loading / user-error / no-birth-profile / fetching / month) so the seam
// is never a stuck skeleton, and a month change clears the old month FIRST (no stale from the previous month).
import { useEffect, useMemo, useState } from 'react'
import { useHasMounted } from '@/lib/hooks/use-has-mounted'
import { useV2User } from '@/features/auth/hooks/useV2User'
import { isBirthProfileComplete, userRowToFeCalcInput } from '@/lib/bazi-bridge/input'
import { isPaidMember } from '@/lib/v2/tier'
import type { CalendarMonth } from '../types'
import { bangkokTodayISO, bangkokToday } from '../today'
import { defaultSelectedDate, isSelectableDate } from './selection'
import { assembleFeatureMonth } from './month-adapter'
import { fetchCalendarMonth, type CalendarRefusalReason } from './fetch-month'
import { monthKey, monthYM, peekMonth, setMonth, isCacheableMonth } from './month-cache'

type Cursor = { year: number; month: number }

export interface UseCalendarMonth {
  /** The month currently in view (grid + summary source) — `null` until the month resolves (post-mount). */
  month: CalendarMonth | null
  /** true while the month is not yet available (before the cursor resolves; a real fetch later). */
  loading: boolean
  /**
   * 🔴 #530 — why the server refused this month, or `null` when it did not refuse. The screen's answer to
   * the two values is opposite, which is the entire reason the field exists:
   *   'out-of-span'  the package stops here      → invite an upgrade (ฟีมเคาะ 2026-08-24)
   *   'no-identity'  we cannot tell who you are  → the sign-in path
   * `null` covers every other empty month — loading, anon, no birth profile, a failed fetch — so a screen
   * that only special-cases these two strings still renders its existing neutral face for all of those.
   */
  refusal: CalendarRefusalReason | null
  /**
   * The cursor's year / month — `null` ONLY before the cursor resolves (pre-mount / SSR / first paint), so the
   * consumer shows a neutral label until then and NEVER a made-up month (was `?? MOCK_YEAR/MOCK_MONTH` = July
   * 2569, which leaked as a real default #208). Post-mount the cursor is always set, so these are real in EVERY
   * data state — loading · fetch-failed · anon · no-birth — letting the [today][month][year] selector stay put.
   */
  year: number | null
  monthIndex: number | null // 1-12
  /**
   * Today's ISO date (Asia/Bangkok) — `null` on the server render AND the first client paint
   * (hydration-fenced), then the real date after mount. Bind the "today" ring to this so the server
   * HTML and first client render agree (no ring), avoiding a midnight-straddle hydration mismatch.
   */
  todayISO: string | null
  /**
   * The day the bottom card follows. `null` before the rule resolves it (server + first paint, fenced).
   * On entering a month: today if today is in view, else day 1 — the old silent "day 14" is gone.
   */
  selectedDate: string | null
  /** Select a real (non-padding) day of the current month; ignores anything else. */
  selectDay: (date: string) => void
  goPrev: () => void
  goNext: () => void
  /** Jump the cursor to Bangkok-today's month. No-op until mounted (today is unknown before then). */
  goToday: () => void
}

export function useCalendarMonth(): UseCalendarMonth {
  const hasMounted = useHasMounted()

  // Cursor starts NULL (hydration fence) — resolved to Bangkok-today's month in a post-mount effect.
  const [cursor, setCursor] = useState<Cursor | null>(null)
  useEffect(() => {
    const t = bangkokToday()
    setCursor((c) => c ?? { year: t.year, month: t.month }) // set once; nav changes are preserved
  }, [])

  // Identity: the page-shared, de-duplicated /api/user fetch (no 2nd UserGetById — #165). Birth `person` is
  // built only from a COMPLETE profile (dob + gender) — never guessed; a no-dob account yields no month.
  const { userId, user, done, errored } = useV2User()
  const person = useMemo(
    () => (user && isBirthProfileComplete(user) ? userRowToFeCalcInput(user) : null),
    [user],
  )

  // The fetched month + loading. State machine (each branch resolves — no stuck skeleton):
  //   no cursor (pre-mount)         → null, loading (cursor resolving)
  //   no account (anon)             → null, settled (personalised month needs an identity)
  //   user still fetching           → null, loading
  //   user errored / no birth data  → null, settled (nothing to compute)
  //   fetching the month            → null, loading (old month cleared FIRST → never stale)
  //   month arrived                 → the assembled month, settled
  // 🔴 #530 — `refusal` is the THIRD thing this state carries, and it is why the shape widened. `month:
  // null` has always meant five different things (cursor resolving · anon · user errored · no birth data ·
  // the fetch failed) and the screen renders one neutral face for all of them. "Your package stops here"
  // is not one of those: ฟีมเคาะ 2026-08-24 that it should invite an upgrade. It cannot ride on `month`
  // because null is already overloaded, so it gets its own field and defaults to null everywhere else.
  const [monthState, setMonthState] = useState<{
    month: CalendarMonth | null
    loading: boolean
    refusal: CalendarRefusalReason | null
  }>({
    month: null,
    loading: true,
    refusal: null,
  })
  const { month, loading, refusal } = monthState

  useEffect(() => {
    if (!cursor) return setMonthState({ month: null, loading: true, refusal: null }) // cursor resolving (fenced pre-mount)
    if (!userId) return setMonthState({ month: null, loading: false, refusal: null }) // anon → no personalised month
    if (!done) return setMonthState({ month: null, loading: true, refusal: null }) // user row still in flight
    if (errored || !user) return setMonthState({ month: null, loading: false, refusal: null }) // could not get the user row
    if (!person) return setMonthState({ month: null, loading: false, refusal: null }) // profile incomplete → nothing to compute

    // ── 2-layer client cache (P2) ──────────────────────────────────────────────────────────────────
    // SYNC peek BEFORE any `loading:true`: a cached month (memory or localStorage) renders in THIS SAME
    // tick → no skeleton แว้บ (DoD #1/#2/#3) and NO fetch fires → the POST goes from 3 to 1 (DoD #4). Doing
    // the peek before setMonthState is the whole trick — clearing to loading:true first would flash the
    // skeleton even on a hit. Key determinants = the BFF's exactly (userId + birth signature + YYYY-MM), so
    // editing dob makes `person` (and the signature) change → a fresh key → a miss → refetch (DoD #5).
    const key = monthKey(userId, JSON.stringify(person), monthYM(cursor.year, cursor.month))
    // #293 — the gate is closed now, so the cache must not become the way around it: every stored month is
    // paid content, and the ones written during the 18 days the gate stood open are still on real devices.
    const cachedDays = peekMonth(key, { paid: isPaidMember(user) })
    if (cachedDays) {
      setMonthState({ month: assembleFeatureMonth(cursor.year, cursor.month, cachedDays), loading: false, refusal: null })
      return // instant, no fetch
    }

    let alive = true
    setMonthState({ month: null, loading: true, refusal: null }) // MISS → clear the previous month BEFORE the fetch → never stale
    // #391: userId is no longer SENT — the BFF reads the session. It stays in `key` above because
    // the CLIENT cache still has to be partitioned per account on a shared device.
    fetchCalendarMonth(person, cursor.year, cursor.month).then((resp) => {
      if (!alive) return // month changed / unmounted mid-flight → drop this (stale) response
      // Cache only a REAL month — a degraded/empty/gated response is transient and must never be persisted
      // (a frozen empty month = a failure cached forever). Store the RAW days; assemble is re-run on read.
      if (isCacheableMonth(resp)) setMonth(key, resp.days)
      // #530 — a refusal reason only survives here when the response actually refused. isCacheableMonth
      // already keeps a gated month out of the cache, so a refusal is never replayed from storage either.
      setMonthState({
        month: assembleFeatureMonth(cursor.year, cursor.month, resp.days),
        loading: false,
        refusal: resp.allowed ? null : (resp.reason ?? null),
      })
    })
    return () => {
      alive = false
    }
    // person is memoized (stable per user), so within a mount this fires only on cursor / identity change.
  }, [cursor, userId, done, errored, person])

  // Only expose today AFTER mount — the fence. Before mount both server and client see null.
  const todayISO = hasMounted ? bangkokTodayISO() : null

  // Selected day. Re-applies the default rule whenever the MONTH changes (cursor move / first resolve) or
  // today resolves (mount). A manual selectDay within a month persists — it changes neither `month` nor
  // `todayISO`, so this effect does not re-fire and overwrite it. `null` until the month exists.
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  useEffect(() => {
    setSelectedDate(month ? defaultSelectedDate(month, todayISO) : null)
  }, [month, todayISO])

  const selectDay = (date: string) => {
    if (month && isSelectableDate(month, date)) setSelectedDate(date)
  }

  const goPrev = () =>
    setCursor((c) => (c ? (c.month === 1 ? { year: c.year - 1, month: 12 } : { year: c.year, month: c.month - 1 }) : c))
  const goNext = () =>
    setCursor((c) => (c ? (c.month === 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: c.month + 1 }) : c))
  const goToday = () => {
    if (!hasMounted) return // today unknown before mount — never guess it on the server
    const t = bangkokToday()
    setCursor({ year: t.year, month: t.month })
  }

  return {
    month,
    loading,
    refusal,
    year: cursor?.year ?? null, // null = cursor not resolved yet (pre-mount); NEVER a made-up month (#208)
    monthIndex: cursor?.month ?? null,
    todayISO,
    selectedDate,
    selectDay,
    goPrev,
    goNext,
    goToday,
  }
}
