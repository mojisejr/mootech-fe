import { useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import type { GoalId } from '../components/IntentCheckScreen'

export type SaveState = 'idle' | 'saving' | 'done' | 'error'

// Saves the first-run result: POST /api/v2/onboarding → BE /consent (goal + PDPA consent + onboarded_at).
// Returns a boolean so the caller advances ONLY on a real success — a failed save must NOT pretend to
// have onboarded the user (else onboarded_at is unset and the gate loops them back next visit).
export function useSaveOnboarding(): { save: (goal: GoalId) => Promise<boolean>; state: SaveState } {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [state, setState] = useState<SaveState>('idle')

  const save = async (goal: GoalId): Promise<boolean> => {
    if (!userId) {
      setState('error')
      return false
    }
    setState('saving')
    try {
      const r = await fetch('/api/v2/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId, goal }),
      })
      const data = (await r.json().catch(() => null)) as { ok?: boolean } | null
      if (!r.ok || !data?.ok) {
        setState('error')
        return false
      }
      setState('done')
      return true
    } catch {
      setState('error')
      return false
    }
  }

  return { save, state }
}
