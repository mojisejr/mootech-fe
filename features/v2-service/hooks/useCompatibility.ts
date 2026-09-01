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
//     enforced by μุน gating on this flag). Slice 1 does NOT fire the calculate call at all (result slice; the
//     endpoint has side effects — done-cond #9). matchingType is HELD and proven (done-cond #2), not sent yet.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { UserGetById } from '@/constants/api/api-user-get'
import { MemberWithFriendCreateApi } from '@/constants/api/api-member-with-friend-create'
import { MemberWithFriendGetDetailApi } from '@/constants/api/api-member-with-friend-get-detail'
import { MemberWithFriendUpdateProfileWithStatusApi } from '@/constants/api/api-member-with-friend-update-profile'
import type { CompatibilityConfig, CompatibilityKind, MatchingType } from '../compatibility'
import {
  buildCreateFriendArgs,
  buildEditFriendArgs,
  mapUpdateFriendResult,
  friendInputToPerson,
  applyFriendDetail,
  type CompatPerson,
  type SelectFriendInput,
  type FriendDetail,
  type NewFriendForm,
  type EditFriendForm,
  type UpdateFriendResult,
} from '../compatibility-api'

export type { CompatPerson, SelectFriendInput }

export type CreateFriendResult =
  | { ok: true; friend: unknown }
  | { ok: false; error: unknown }

// UpdateFriendResult + the failure classification live in compatibility-api (pure, unit-tested).
export type { UpdateFriendResult }

export type UseCompatibility = {
  kind: CompatibilityKind
  title: string
  matchingType: MatchingType
  /** #569 — the work role currently selected (colleague screen only; equals matchingType) */
  role: MatchingType
  /** #569 — change the work role. Only the colleague screen renders a control that calls this. */
  setRole: (role: MatchingType) => void
  /** the current user, "คุณ" — real data (done-cond #3), never hardcoded */
  person1: CompatPerson | null
  /** the chosen friend/partner — null until μุน's wrapped modal calls selectFriend */
  person2: CompatPerson | null
  /** true while person1 is being fetched (μุน holds a skeleton on row 1) */
  loadingPerson1: boolean
  /** true while person2's dob/time is being enriched from the friend detail (skeleton the birthdate line) */
  loadingPerson2: boolean
  /** the button gate: enabled ONLY when both people are present (done-cond #5) */
  canViewResult: boolean
  /** μุน calls this with the fields v1's onClickMatching gives (id, name, surname, picture_url); the hook
   *  fills dob/time by reading the friend detail. person2 appears instantly with name+picture. */
  selectFriend: (friend: SelectFriendInput) => void
  clearFriend: () => void
  /** wraps v1 create-friend (surname/gender gap-filled + documented in compatibility-api) */
  createFriend: (form: NewFriendForm) => Promise<CreateFriendResult>
  /** wraps v1 update-profile with STATUS (#266): edit an existing friend, returning a reason on failure.
   *  On ok the caller MUST re-read the friend (selectFriend again) so person2 reflects the new data before
   *  the next calc — the detail is a fresh GET (no cache), so a re-select fully refreshes it. */
  updateFriendProfile: (friendId: string, form: EditFriendForm) => Promise<UpdateFriendResult>
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

  // #569 — which work role the user is looking at. `config.matchingType` is the DEFAULT, not the answer:
  // the colleague screen offers three (COLLEAGUE_ROLES) and the love screen offers none, so the value that
  // reaches calculateCompatibility has to be state, not a constant read off the config.
  // Reset on kind change: /love and /colleague are the same component, and carrying BOSS into the love
  // screen would send the engine a work relationship for a couple.
  const [role, setRole] = useState<MatchingType>(config.matchingType)
  useEffect(() => {
    setRole(config.matchingType)
  }, [config.kind, config.matchingType])

  const [person1, setPerson1] = useState<CompatPerson | null>(null)
  const [loadingPerson1, setLoadingPerson1] = useState<boolean>(true)
  const [person2, setPerson2] = useState<CompatPerson | null>(null)
  const [loadingPerson2, setLoadingPerson2] = useState<boolean>(false)
  // Race guard: each selectFriend bumps this token; a detail response only applies if its token is still the
  // latest (rapid re-select A→B must not let A's slow detail overwrite B). Same family as the alive-guard below.
  const selectTokenRef = useRef(0)

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

  const selectFriend = useCallback((input: SelectFriendInput) => {
    // instant: show name + picture right away (dob/time blank), then enrich from the friend detail
    const token = ++selectTokenRef.current
    setPerson2(friendInputToPerson(input))
    setLoadingPerson2(true)
    ;(async () => {
      try {
        const detail = (await MemberWithFriendGetDetailApi(input.id)) as FriendDetail | null
        if (selectTokenRef.current !== token) return // a newer selection won → drop this stale detail
        setPerson2((prev) => (prev && prev.id === input.id ? applyFriendDetail(prev, detail) : prev))
      } catch {
        // detail fetch failed → keep the name+picture person (no strand, no fabricated dob/time)
      } finally {
        if (selectTokenRef.current === token) setLoadingPerson2(false)
      }
    })()
  }, [])
  const clearFriend = useCallback(() => {
    selectTokenRef.current++ // invalidate any in-flight enrichment
    setPerson2(null)
    setLoadingPerson2(false)
  }, [])

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

  // Edit an existing friend's profile (#266). Status-aware so a failed save says WHY, not one blob. The
  // v1 call is made HERE (client) from the tested positional builder; the pure adapter stays node-testable.
  const updateFriendProfile = useCallback(
    async (friendId: string, form: EditFriendForm): Promise<UpdateFriendResult> => {
      if (!friendId) return { ok: false, reason: 'system', error: 'no-friend-id' }
      const res = await MemberWithFriendUpdateProfileWithStatusApi(...buildEditFriendArgs(friendId, form))
      return mapUpdateFriendResult(res)
    },
    [],
  )

  return {
    kind: config.kind,
    title: config.title,
    matchingType: role,
    role,
    setRole,
    person1,
    person2,
    loadingPerson1,
    loadingPerson2,
    canViewResult: person1 !== null && person2 !== null,
    selectFriend,
    clearFriend,
    createFriend,
    updateFriendProfile,
  }
}
