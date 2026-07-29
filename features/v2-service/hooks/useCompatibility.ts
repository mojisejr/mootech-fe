// features/v2-service/hooks/useCompatibility.ts — ดวงสมพงศ์ Slice 1, the goo↔μุน LOGIC SEAM.
// goo owns: kind→{title,matching_type} contract, person-1/person-2 state, the enable condition, and the
// v1-API wrap. μุน owns: the screen, the profile rows, the 2-state button, and mapping the v1
// modal-select-freind item → a CompatPerson before calling selectFriend (she is already "ครอบ modal v1").
//
// State-table (charter completeness + too's adversary — EVERY outcome resolves, NEVER infinite-load):
//   person1 (the current user, "คุณ"): loading → resolved{real row} · resolved{cookie-name only}(API error/throw:
//     do NOT fabricate dob/time, do NOT strand) · no-userId → resolved{null}, loading OFF.
//   person2 (the friend): null → set by selectFriend (μุน's wrapped modal) → cleared by clearFriend.
//   button: canViewResult = person1 && person2 (done-cond #5: gray until BOTH; click while gray does nothing —
//     enforced by μุน gating on this flag). Slice 1 does NOT fire UserMatchingCalculateApi (result slice; the
//     endpoint has side effects — done-cond #9). matchingType is HELD and proven (done-cond #2), not sent yet.
import { useCallback, useEffect, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { UserGetById } from '@/constants/api/api-user-get'
import { MemberWithFriendCreateApi } from '@/constants/api/api-member-with-friend-create'
import type { CompatibilityConfig, CompatibilityKind, MatchingType } from '../compatibility'
import { buildCreateFriendArgs, type NewFriendForm } from '../compatibility-api'

// One person row the screen renders (both "คุณ" and the chosen friend share this shape).
export type CompatPerson = {
  /** current user's id for person1; friend_id for person2 (the value the result slice passes to calculate) */
  id: string
  name: string
  /** 'YYYY-MM-DD' | '' */
  dob: string
  /** 'HH:mm' | '' (empty when birth time is not remembered) */
  time: string
  /** picture URL, '' when none */
  imageProfile: string
}

export type CreateFriendResult =
  | { ok: true; friend: unknown }
  | { ok: false; error: unknown }

export type UseCompatibility = {
  kind: CompatibilityKind
  title: string
  matchingType: MatchingType
  /** the current user, "คุณ" — real data (done-cond #3), never hardcoded */
  person1: CompatPerson | null
  /** the chosen friend/partner — null until μุน's wrapped modal calls selectFriend */
  person2: CompatPerson | null
  /** true while person1 is being fetched (μุน holds a skeleton on row 1) */
  loadingPerson1: boolean
  /** the button gate: enabled ONLY when both people are present (done-cond #5) */
  canViewResult: boolean
  /** μุน calls this from the wrapped v1 modal after mapping its item → CompatPerson */
  selectFriend: (friend: CompatPerson) => void
  clearFriend: () => void
  /** wraps v1 create-friend (surname/gender gap-filled + documented in compatibility-api) */
  createFriend: (form: NewFriendForm) => Promise<CreateFriendResult>
}

// The current-user row from UserGetById (/api/user). Only the fields Slice 1 reads are typed.
type UserRow = {
  error?: unknown
  user_id?: string
  name?: string | null
  dob?: string | null
  time?: string | null
  picture_url?: string | null
}

export function useCompatibility(config: CompatibilityConfig): UseCompatibility {
  const [cookies] = useCookies([CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const cookieName = (cookies[CookieKey.MEMBER_NAME] as string) || ''

  const [person1, setPerson1] = useState<CompatPerson | null>(null)
  const [loadingPerson1, setLoadingPerson1] = useState<boolean>(true)
  const [person2, setPerson2] = useState<CompatPerson | null>(null)

  // Idempotent effect (same discipline as useV2Home #176): NO doneRef latch. React StrictMode double-invokes
  // in dev; each run owns its `alive` and the surviving run resolves. Prod mounts once.
  useEffect(() => {
    if (!userId) {
      setPerson1(null)
      setLoadingPerson1(false) // anon/no-cookie → resolved-empty, NOT stuck loading
      return
    }
    let alive = true
    setLoadingPerson1(true)
    ;(async () => {
      try {
        const u = (await UserGetById(userId)) as UserRow | null
        if (!alive) return
        if (!u || u.error || !u.user_id) {
          // transient API error → show the real name we already hold (cookie), leave dob/time empty
          // rather than fabricating them or stranding row 1 on a spinner. done-cond #3 stays honest.
          setPerson1({ id: userId, name: cookieName, dob: '', time: '', imageProfile: '' })
        } else {
          setPerson1({
            id: userId,
            name: u.name || cookieName,
            dob: u.dob || '',
            time: u.time || '',
            imageProfile: u.picture_url || '',
          })
        }
      } catch {
        if (alive) setPerson1({ id: userId, name: cookieName, dob: '', time: '', imageProfile: '' })
      } finally {
        if (alive) setLoadingPerson1(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [userId, cookieName])

  const selectFriend = useCallback((friend: CompatPerson) => setPerson2(friend), [])
  const clearFriend = useCallback(() => setPerson2(null), [])

  const createFriend = useCallback(
    async (form: NewFriendForm): Promise<CreateFriendResult> => {
      if (!userId) return { ok: false, error: 'no-user' }
      try {
        // v1 call made HERE (client-only) so the pure adapter stays node-testable; args from the tested builder.
        const res = (await MemberWithFriendCreateApi(...buildCreateFriendArgs(userId, form))) as { error?: unknown } | null
        if (!res || res.error) return { ok: false, error: res?.error ?? 'create-failed' }
        return { ok: true, friend: res }
      } catch (error) {
        return { ok: false, error }
      }
    },
    [userId],
  )

  return {
    kind: config.kind,
    title: config.title,
    matchingType: config.matchingType,
    person1,
    person2,
    loadingPerson1,
    canViewResult: person1 !== null && person2 !== null,
    selectFriend,
    clearFriend,
    createFriend,
  }
}
