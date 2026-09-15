import { useState } from 'react'
import { track } from '@/lib/analytics/track'
import { CookieKey } from '@/constants/cookie-key'
import type { GoalId } from '../components/IntentCheckScreen'

export type SaveState = 'idle' | 'saving' | 'done' | 'error'

// Saves the first-run result: POST /api/v2/onboarding → BE /consent (goal + PDPA consent + onboarded_at).
// Returns a boolean so the caller advances ONLY on a real success — a failed save must NOT pretend to
// have onboarded the user (else onboarded_at is unset and the gate loops them back next visit).
//
// 🔴 #252 — this hook no longer sends (or reads) `user_id`. It used to take it from the MEMBER_ID cookie,
// which is set client-side and is therefore whatever the sender wants it to be; the route now derives the
// caller from their signed session instead. The cookie read is removed rather than left in place unused,
// because a value that is still gathered "just in case" is a value the next editor will find a use for —
// and the whole point of #252 is that this flow must have no client-supplied notion of who is consenting.
// The pre-flight `if (!userId) → error` guard goes with it: the server is the only honest judge of that
// now, and a local guard on a forgeable value can only ever produce a WRONG refusal (a signed-in user
// whose cookie expired) — never a right one.
export function useSaveOnboarding(): { save: (goal: GoalId) => Promise<boolean>; state: SaveState } {
  const [state, setState] = useState<SaveState>('idle')

  const save = async (goal: GoalId): Promise<boolean> => {
    setState('saving')
    try {
      const r = await fetch('/api/v2/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Same-origin fetch: the httpOnly NextAuth session cookie rides along automatically, which is
        // exactly the credential the route trusts. Nothing about identity is stated here on purpose.
        body: JSON.stringify({ goal }),
      })
      const data = (await r.json().catch(() => null)) as { ok?: boolean } | null
      if (!r.ok || !data?.ok) {
        setState('error')
        return false
      }
      setState('done')
      // GA `sign_up` — the v2 "member" definition is exactly this write (user.onboarded_at), so this is
      // the one place the event belongs. Carries the login provider only; never the goal, never who.
      track('sign_up', { method: loginMethodFromCookie() })
      return true
    } catch {
      setState('error')
      return false
    }
  }

  return { save, state }
}

const KNOWN_METHODS = new Set(['line', 'google', 'facebook'])
function loginMethodFromCookie(): string {
  if (typeof document === 'undefined') return 'unknown'
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${CookieKey.LOGIN_PROVIDER}=([^;]*)`))
  const v = decodeURIComponent(m?.[1] ?? '').toLowerCase()
  return KNOWN_METHODS.has(v) ? v : 'unknown'
}
