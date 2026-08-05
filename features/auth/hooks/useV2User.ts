// useV2User — the SINGLE-fetch identity seam for v2 pages (goo · G-0c, บอง 4-condition sign-off).
//
// Owns the /api/user fetch for the current identity and exposes the resolved row, so a page that needs the
// user in more than one place (calendar: useV2Tier for the gate + useCalendarMonth for birth data) fires it
// ONCE. The de-dup lives in lib/v2/user-cache (in-flight only — see its header for why there is no stored
// cache: a persisted row goes stale and a paid user keeps seeing the free gate). This hook is the React
// wrapper: cookie → getUser → { done, errored, user } for the pure computeTier reducer.
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
import type { TierSource } from '@/lib/v2/tier'

type UserRow = TierSource & { user_id?: string; error?: unknown }

export interface V2User {
  /** '' when no MEMBER_ID cookie is readable (anon, or SSR/first-paint before mount). */
  userId: string
  /** the user fetch has settled (success OR error). */
  done: boolean
  /** settled but no usable row (error shape / missing user_id / threw) — NEVER guessed as a valid row. */
  errored: boolean
  /** the resolved user row, or null (loading / no account / errored). */
  user: TierSource
}

export function useV2User(): V2User {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [state, setState] = useState<{ done: boolean; errored: boolean; user: TierSource }>({
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
    getUser(userId, UserGetById)
      .then((u) => {
        if (!alive) return // unmounted / identity changed mid-flight → drop (covers logout-clears-cookie)
        const row = u as UserRow | null
        if (!row || row.error || !row.user_id) {
          setState({ done: true, errored: true, user: null }) // could-not-determine — never a guessed free
          return
        }
        setState({ done: true, errored: false, user: row })
      })
      .catch(() => {
        if (alive) setState({ done: true, errored: true, user: null }) // transient throw → unknown, retryable
      })
    return () => {
      alive = false
    }
  }, [userId])

  return { userId, done: state.done, errored: state.errored, user: state.user }
}
