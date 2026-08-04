// useV2Tier — the page-agnostic paid-tier seam (μุน Zone-4). Any v2 page (service / calendar / …) reads
// { isPaid, loading } from here to gate free-vs-paid content, WITHOUT useV2Home's routing/redirect (that
// hook also bounces a no-chart user to /register — unusable outside home). The paid rule lives once in
// lib/v2/tier.ts (isPaidMember); this hook only fetches the user and feeds the pure computeTier reducer.
//
// Idempotent effect (same discipline as useV2Home / #176): NO doneRef latch — StrictMode double-invokes,
// each run owns its `alive`, the surviving run resolves. NO routing here by design.
//
// SSR-SAFE BY DEFAULT (μุน found this on #171, moved into the seam here): an empty `userId` on the SERVER
// does NOT mean "no account" — it means "the cookie is unreadable in THIS render context" (react-cookie
// has no jar during SSR). Those are two different meanings crammed into one value. computeTier is right to
// read empty-userId as known-free (a pure function cannot know the difference), so the fix belongs HERE,
// not in the reducer: the tier is trusted only once the component has MOUNTED on the client, where the
// cookie actually exists. Before mount (SSR + the first client pass) it reads `null` — the "not determined"
// state the gate already handles by rendering NEITHER branch, so server and client-first render an
// identical tree (no hydration mismatch) and no page can ship a paid member the free/upsell branch.
// Guarding here (not in a per-page wrapper) means the next SSR consumer cannot silently re-step the leak.
//
// Home note: home already fetches the user via useV2Home and exposes `profile.showUpgrade` (= !isPaid) —
// derive isPaid from that there instead of calling this hook, so home keeps its SINGLE UserGetById (#165).
// useV2Tier is for the pages that do NOT already fetch the user.
import { useEffect, useRef, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { UserGetById } from '@/constants/api/api-user-get'
import { computeTier, type TierSource, type V2Tier } from '@/lib/v2/tier'

type TierUser = TierSource & { user_id?: string; error?: unknown }

export function useV2Tier(): V2Tier {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [state, setState] = useState<{ done: boolean; errored: boolean; user: TierSource }>({
    done: false,
    errored: false,
    user: null,
  })
  // SSR-safe gate: false on the server + the first client render, true after the mount effect. Until then
  // the tier reads `null` (see the header) so no branch commits before the cookie is actually readable.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // keep the reducer output stable across a StrictMode remount by resetting on userId change only
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return // no account → computeTier returns KNOWN free without a fetch
    if (lastUserId.current !== userId) {
      lastUserId.current = userId
      setState({ done: false, errored: false, user: null }) // new identity → back to loading
    }
    let alive = true
    ;(async () => {
      try {
        const u = (await UserGetById(userId)) as TierUser | null
        if (!alive) return
        // A valid user response ALWAYS carries user_id; an error shape ({error}) or a non-JSON 5xx body
        // has none → treat as "could not determine" (errored), NEVER as free (that would hide paid content).
        if (!u || u.error || !u.user_id) {
          setState({ done: true, errored: true, user: null })
          return
        }
        setState({ done: true, errored: false, user: u })
      } catch {
        if (alive) setState({ done: true, errored: true, user: null }) // transient → unknown, do not guess
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  // Before mount → null (not determined) so SSR and the first client pass agree; after mount → the reducer.
  if (!mounted) return { isPaid: null, loading: true }
  return computeTier({ userId, done: state.done, errored: state.errored, user: state.user })
}
