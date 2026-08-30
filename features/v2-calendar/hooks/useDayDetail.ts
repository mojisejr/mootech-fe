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
  const { userId, user, done: identityDone } = useV2User()
  const person = useMemo(() => (user && isBirthProfileComplete(user) ? userRowToFeCalcInput(user) : null), [user])
  // #226 — the reply is now TIER-SHAPED (the BFF trims the paid sections for a free caller), so the tier is
  // part of what identifies a cached day. Read from the SAME row `person` comes from, through the one frozen
  // client rule (isPaidMember) — never a second definition of "paid". `person` is non-null below, so `user`
  // is too: the tier is known whenever a key gets built.
  const paid = isPaidMember(user)
  // Same determinants as the BFF cache key — dob edit → new signature → no cross-birth stale.
  const birthSig = useMemo(() => (person ? JSON.stringify(person) : ''), [person])

  // 🔴 THE STATE CARRIES THE DATE IT DESCRIBES (ตู๋, measured on mojisejr/mootech-fe#534's clean head).
  //
  // `date` is a PROP and this was a prop-less state, so on the render right after the caller selects a new
  // day — before the effect below runs — React hands the screen the NEW date beside the PREVIOUS day's
  // answer. ตู๋ measured it on the real screen: tapping from a walled day to a reachable one showed the
  // upgrade card ON THE REACHABLE DAY in 1 of 3 renders after the tap. That is this pair of tickets' own
  // defect arriving through the other door — a day that is fine, described as a paid wall.
  //
  // 🔴 THE STAMP IS THE WHOLE CACHE KEY, NOT JUST THE DATE (ตู๋'s follow-up). The effect depends on
  // date · userId · birthSig · person · paid, and `dayKey` already carries all of them, so stamping `date`
  // alone covered one determinant out of four. Today the other three can only move when `userId` moves —
  // useV2User refetches on `[userId]` alone (features/auth/hooks/useV2User.ts:92) — so the narrow stamp
  // was CORRECT, but only because of properties of another file. ตู๋'s test for when that is not good
  // enough: could someone edit the third file for their own reasons and break this, would they have any
  // cause to open this one, and would anything go red? Here that is yes / no / no — and useV2User's own
  // header (:5-6) argues for adding revalidation, which is exactly the edit that would do it.
  //
  // Stamping the key makes the mismatch REPRESENTABLE, so the reader below can refuse to answer for a day
  // this state is not about. It also deletes a cross-file promise: features/v2-calendar/refusal-view.ts
  // orders `outOfSpan` above `loading`, which was safe only because this hook happened never to set both —
  // an invariant living in one file and relied upon in another, with nothing failing if it broke. A stale
  // day now reads as `loading` here, so that ordering cannot be wrong whatever this hook does.
  const [state, setState] = useState<{ key: string; date: string; detail: DayDetail | null; loading: boolean; outOfSpan: boolean }>({
    key: '',
    date: '',
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

  // The key this render is ASKING about. Hoisted out of the effect so the early-return branches can stamp
  // it too: dayKey is pure string concatenation and `birthSig` is '' when there is no profile, so it is
  // defined in every branch, including the ones that never reach a fetch.
  const askedKey = dayKey(userId, birthSig, date, paid)

  // The selected day's detail — anti-latch on [date].
  useEffect(() => {
    // 🔴 THIS BRANCH USED TO ANSWER FOR TWO SITUATIONS THAT ARE NOT ALIKE (ลามุน, measured in a browser).
    //
    //   the user row has not arrived yet   STILL CHANGING  ⇒ `loading: false` is a lie
    //   it arrived and has no birth date   SETTLED         ⇒ `loading: false` is correct
    //
    // Collapsed, the first one told the screen "we are done and there is nothing", one frame after identity
    // resolved and before this effect had fetched anything. On `main` that state wore a spinner so nobody
    // could see it was wrong; mojisejr/mootech-fe#534 gives it words, and the words say the app failed. She
    // sampled every painted frame: with /api/user delayed 1500ms the failure copy appeared at 2000ms and
    // was replaced at 2037ms. Her page-level guard shortens it 40x but cannot close it, because that guard
    // reads `isPaid !== null`, which settles to false BEFORE the row lands.
    //
    // 🔑 Third shape of one family, all three found in a day: an answer older than the question the screen
    // is asking — stale about the CACHE, stale about the DAY (both closed above), and stale about
    // NOT-STARTED-YET (here). Splitting it also lets features/v2-calendar drop `identityResolved`, removing
    // another cross-file promise.
    if (!date) {
      setState({ key: askedKey, date, detail: null, loading: false, outOfSpan: false }) // no day selected — settled
      return
    }
    // `userId` empty means NO ACCOUNT, which useV2User treats as known rather than pending
    // (features/auth/hooks/useV2User.ts:64-69: no fetch is issued at all), so it is settled too.
    //
    // 🔴 THIS CHECK MUST STAY ABOVE THE ONE BELOW (ตู๋). useV2User sets `done: false` for an anonymous
    // visitor as well — it is "no fetch was started", not "a fetch is running" — so a rule of the form
    // `loading = !done` alone would spin forever for everybody who is not signed in. The pending state is
    // `Boolean(userId) && !done`, and the branch order is how that is expressed here.
    if (!userId) {
      setState({ key: askedKey, date, detail: null, loading: false, outOfSpan: false })
      return
    }
    // Signed in, but the row is still in flight. NOT settled — and saying so is the whole fix.
    if (!identityDone) {
      setState({ key: askedKey, date, detail: null, loading: true, outOfSpan: false })
      return
    }
    // The row arrived. No usable birth profile now means exactly that, and it will not change by waiting.
    if (!person) {
      setState({ key: askedKey, date, detail: null, loading: false, outOfSpan: false })
      return
    }
    const k = askedKey

    // Resolved-hit → render in THIS tick (no loading flash, no re-fetch).
    const peeked = peekDayDetail(k)
    if (peeked !== undefined) {
      // #529 — an out-of-span day is out-of-span on a re-view too. The cache used to hold the detail
      // alone, so this branch could only ever answer "no detail" and the wall became a crash on every hit.
      setState({ key: askedKey, date, ...toState(peeked), loading: false })
      return
    }

    let alive = true
    setState({ key: askedKey, date, detail: null, loading: true, outOfSpan: false }) // new day → clear old text; the ring (month cell) stays visible
    getDayDetail(k, () => fetchDayDetail(person, date).then(toCachedDay)).then((day) => {
      if (!alive) return // date changed / unmounted mid-flight → drop this stale response (THE anti-latch)
      setState({ key: askedKey, date, ...toState(day), loading: false })
    })
    return () => {
      alive = false
    }
  }, [date, userId, identityDone, birthSig, person, paid, askedKey])

  // A state describing a DIFFERENT day is not an answer about this one. Reading it as `loading` is the
  // honest translation — we are between the caller's choice and the effect that serves it — and it is the
  // one reading that can never show a wall, or a fortune, belonging to the day before.
  if (state.key !== askedKey) return { detail: null, loading: true, outOfSpan: false }
  return { detail: state.detail, loading: state.loading, outOfSpan: state.outOfSpan }
}
