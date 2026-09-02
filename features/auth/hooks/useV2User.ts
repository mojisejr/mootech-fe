// useV2User — the SINGLE-fetch identity seam for v2 pages (goo · G-0c, บอง 4-condition sign-off).
//
// Owns the /api/user fetch for the current identity and exposes the resolved row, so a page that needs the
// user in more than one place (calendar: useV2Tier for the gate + useCalendarMonth for birth data) fires it
// ONCE. The de-dup lives in lib/v2/user-cache (in-flight only — see its header for why there is no stored
// cache: a persisted row goes stale and a paid user keeps seeing the free gate). This hook is the React
// wrapper: cookie → getUser → { done, errored, user } for the pure computeTier reducer.
//
// 🔴 IF YOU ARE HERE TO ADD REVALIDATION, READ THIS FIRST (mojisejr/mootech-fe#529, ตู๋).
// The header two lines up argues that a stored row goes stale and a paid user keeps seeing the free gate.
// That is a real argument and it points straight at adding a refetch — which is why this note lives HERE,
// on the file someone would edit, and not only in the file that depends on it.
//
// The effect below refetches on `[userId]` alone. Consumers rely on that: features/v2-calendar/hooks/
// useDayDetail.ts derives its cache key from this row (tier + birth signature) and stamps that whole key
// into its own state, so an answer for one identity can never be shown for another. It was written when
// `paid` could not flip under a fixed `userId` — precisely the invariant a revalidate would remove.
// ⇒ adding revalidation is fine; adding it WITHOUT checking that hook's key stamp is not. Nothing here
//   will go red on its own.
//
// 🔴 `done: false` DOES NOT MEAN "a fetch is running". Line 67 sets it for an anonymous visitor too, where
// no fetch is issued at all. A consumer writing `loading = !done` will spin forever for every signed-out
// person; the pending state is `Boolean(userId) && !done`.
//
// Idempotent effect (same discipline as useV2Tier / useV2Home — the #175/#176 latch class): NO doneRef.
// StrictMode double-invokes; each run owns its `alive`, the surviving run resolves. The `alive` guard sits
// on EVERY resolution path (success-valid, success-error-shape, reject) so a fetch that settles AFTER the
// hook unmounts or the identity changes (e.g. logout clears the cookie mid-flight) can never setState a
// dead/stale component.
import { useEffect, useRef, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { UserGetById } from '@/constants/api/api-user-get'
import { getUser } from '@/lib/v2/user-cache'
import type { UserBirthRow } from '@/lib/bazi-bridge/input'

/**
 * The fetched /api/user row — the SUPERSET both consumers narrow from: useV2Tier reads `payment` (via
 * computeTier), useCalendarMonth reads the birth fields (via userRowToFeCalcInput). The birth fields are
 * GENUINELY nullable — a user who has not completed their profile has no dob (the real "no-dob" account) —
 * so the optionality mirrors real data and is guarded by isBirthProfileComplete; it is NOT a loose "maybe
 * missing" on always-present data. `payment` is likewise absent for a free user. computeTier only ever reads
 * `payment`, so widening the row here cannot change isPaid for any of the 4 consumers (proven: v2-tier.test).
 */
export type V2UserRow = UserBirthRow & {
  payment?: { is_not_expired?: boolean | null } | null
  // #383 — the v2 membership composite. OPTIONAL on purpose: it is null when the server could not
  // determine it (the v2 lookup failed) and absent from any response served before #383 shipped, and
  // neither case may read as "free" — consumers narrow it through parseTierCode, which maps both to null.
  // #365 — expireAt rides on the same composite (lib/v2/subscription.ts attaches it from the row the ONE
  // selection rule picked). null = no v2 row decided the verdict (legacy-paid / free / not-determined).
  // 🔴 null is NOT "expired" — isPaid is the only field that answers that.
  membership?: { isPaid?: boolean | null; tier?: string | null; source?: string; expireAt?: string | null } | null
  user_id?: string
  error?: unknown
}

export interface V2User {
  /** '' when no MEMBER_ID cookie is readable (anon, or SSR/first-paint before mount). */
  userId: string
  /** the user fetch has settled (success OR error). */
  done: boolean
  /** settled but no usable row (error shape / missing user_id / threw) — NEVER guessed as a valid row. */
  errored: boolean
  /** the resolved user row, or null (loading / no account / errored). */
  user: V2UserRow | null
}

export function useV2User(): V2User {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [state, setState] = useState<{ done: boolean; errored: boolean; user: V2UserRow | null }>({
    done: false,
    errored: false,
    user: null,
  })
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) {
      // No account (or cookie not yet readable) → known, no fetch. computeTier reads empty userId as
      // known-free; consumers that need the row (useCalendarMonth) simply wait (user stays null).
      setState({ done: false, errored: false, user: null })
      lastUserId.current = ''
      return
    }
    if (lastUserId.current !== userId) {
      lastUserId.current = userId
      setState({ done: false, errored: false, user: null }) // new identity → loading; never surface the old row
    }
    let alive = true
    // #473 watchdog — a hung /api/user (or a hung identity check upstream of it) used to pin every
    // card on "กำลังตรวจสอบสถานะสมาชิกของคุณ…" forever. After the grace window we settle the fetch as
    // errored, which computeTier maps to `isPaid: null / loading: false` — the honest
    // "ตอนนี้เราตรวจสอบสถานะสมาชิกของคุณไม่ได้ · ลองโหลดหน้านี้ใหม่อีกครั้ง" verdict with a reload
    // escape. Fail-closed by design: unknown stays UNKNOWN, never a guessed free/paid (#384 class).
    const watchdog = window.setTimeout(() => {
      if (!alive) return
      setState((prev) => (prev.done ? prev : { done: true, errored: true, user: null }))
    }, 15000)
    getUser(userId, UserGetById)
      .then((u) => {
        if (!alive) return // unmounted / identity changed mid-flight → drop (covers logout-clears-cookie)
        window.clearTimeout(watchdog)
        const row = u as V2UserRow | null
        if (!row || row.error || !row.user_id) {
          setState({ done: true, errored: true, user: null }) // could-not-determine — never a guessed free
          return
        }
        setState({ done: true, errored: false, user: row })
      })
      .catch(() => {
        if (!alive) return
        window.clearTimeout(watchdog)
        setState({ done: true, errored: true, user: null }) // transient throw → unknown, retryable
      })
    return () => {
      alive = false
      window.clearTimeout(watchdog)
    }
  }, [userId])

  return { userId, done: state.done, errored: state.errored, user: state.user }
}
