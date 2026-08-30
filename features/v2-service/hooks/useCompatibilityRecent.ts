// features/v2-service/hooks/useCompatibilityRecent.ts — ดวงสมพงศ์ ก้อน 2G history hook.
// Reads the user's past compatibility readings and normalises them for the "ดูดวงสมพงศ์ล่าสุด" screen.
// μุน owns the screen; this is the small read-seam that feeds it.
//
// 🔴 #357: the read moved from v1 UserMatchingGetApi(user_id) → mootech-be to V2MatchingGetApi() →
// /api/v2/matching. The user_id ARGUMENT is gone: the server reads the caller from the signed session.
//
// ⚠️ The MEMBER_ID cookie gate below is KEPT deliberately, so this rewire changes routing and nothing
// else. It is now belt-only — the server would serve the right history without it — and it reproduces
// a known bug: mootech-fe#257 measured MEMBER_ID going missing from real browsers, and such a user
// sees an empty history here even though they are signed in and have readings. Removing the gate is a
// behaviour change that belongs to #257, not to a pipe move.
//
// State-table (charter completeness — EVERY outcome resolves, NEVER an infinite spinner):
//   no userId (anon / cookie not hydrated yet) → resolved-empty {items:[]}, loading OFF, error OFF.
//   loading → resolved {parsed items}, error OFF.
//   API throw / { error } / non-array → resolved {items:[]}, error ON → the screen shows an honest fallback,
//     not a spinner and not a fabricated row.
//   empty array → resolved {items:[]}, error OFF → the screen shows "ยังไม่มีประวัติ".
import { useEffect, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { V2MatchingGetApi } from '@/constants/api/api-v2-matching'
import { parseRecentMatches, type RecentMatchItem } from '../compatibility-recent'

export type UseCompatibilityRecent = {
  /** true while the history is being read (screen holds a skeleton, never forever) */
  loading: boolean
  /** true only when the list could not be read/parsed → screen shows a fallback, not a spinner */
  error: boolean
  /** the parsed history rows, or [] (empty history OR unavailable — the screen distinguishes via `error`) */
  items: RecentMatchItem[]
}

export function useCompatibilityRecent(): UseCompatibilityRecent {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''

  // start loading=true UNCONDITIONALLY (not !!userId): react-cookie can read the id cookie differently on
  // the server vs the client, so a userId-dependent initial state renders a different branch SSR vs CSR →
  // a hydration mismatch (which in dev pops the Next error overlay). The effect resolves the no-userId case
  // to empty. Same discipline as useCompatibility's loadingPerson1.
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)
  const [items, setItems] = useState<RecentMatchItem[]>([])

  // Idempotent effect (same discipline as useCompatibilityResult): alive guard, no doneRef latch, so
  // StrictMode's double-invoke in dev resolves cleanly and prod mounts once.
  useEffect(() => {
    if (!userId) {
      setItems([])
      setError(false)
      setLoading(false) // anon / cookie not ready → resolved-empty, NOT stuck loading
      return
    }
    let alive = true
    setLoading(true)
    setError(false)
    ;(async () => {
      try {
        const resp = await V2MatchingGetApi()
        if (!alive) return
        const { ok, items: parsed } = parseRecentMatches(resp)
        setItems(parsed)
        setError(!ok) // non-array / { error } → fallback, never a fabricated row
      } catch {
        if (alive) {
          setItems([])
          setError(true)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  return { loading, error, items }
}
