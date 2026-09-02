// features/v2-service/hooks/useColleagueCandidates.ts — #585 ก้อน 3, the state behind the three slots.
//
// WHY A SECOND HOOK AND NOT A CHANGE TO useCompatibility. That hook is goo's locked logic seam and it
// owns ONE friend (`person2`). Turning `person2` into an array would push array types into the love
// screen, which can never have more than one — every love-side reader would grow a `[0]` that is right
// today and wrong the first time the cap moves. So "many people" lives beside it, never inside it, the
// same reason colleague-candidates.ts sits above the single-pair primitives.
//
// WHAT IT REUSES. The two pure adapters (`friendInputToPerson`, `applyFriendDetail`) and the detail API
// are the SAME ones useCompatibility calls, imported from compatibility-api.ts. A person chosen here and
// a person chosen there therefore come out byte-identical; a second private mapper would be a second
// thing to keep in step.
//
// 🔴 ENRICHMENT IS PER PERSON, NOT PER SCREEN. Picking someone shows name + picture immediately and the
// birthdate arrives after a fetch. With three slots those fetches overlap, so a single "loading" flag
// would be a lie in both directions: it would blank a row whose detail already landed, and it would show
// a settled row while its own fetch was still out. The set of ids currently in flight is the honest
// shape, and the row asks about ITSELF.
//
// 🔴 STALE-DROP IS KEYED BY ID, NOT BY A SINGLE COUNTER. useCompatibility can use one counter because it
// has one slot. Here, picking into slot 2 must not invalidate the fetch still running for slot 0 — a
// shared counter would drop it and that row would keep its blank birthdate forever, with nothing on
// screen saying why.
import { useCallback, useRef, useState } from 'react'
import { MemberWithFriendGetDetailApi } from '@/constants/api/api-member-with-friend-get-detail'
import {
  applyFriendDetail,
  friendInputToPerson,
  type CompatPerson,
  type FriendDetail,
  type SelectFriendInput,
} from '../compatibility-api'
import {
  addCandidate,
  removeCandidate,
  setCandidateAt,
  canCompare,
  candidateSlots,
  type CandidateSlot,
} from '../colleague-candidates'

export type ColleagueCandidates = {
  /** always MAX_CANDIDATES rows, filled first — what the form renders */
  slots: CandidateSlot[]
  /** the chosen people, in order, without the empty tail */
  chosen: readonly CompatPerson[]
  /** is THIS person's birthdate still being fetched? */
  isLoadingDetail: (id: string) => boolean
  /** put someone in a specific slot (an empty slot, or a filled one being swapped) */
  pickAt: (index: number, input: SelectFriendInput) => void
  /** append to the first free slot — what "create a friend, then use them" does */
  append: (input: SelectFriendInput) => void
  /** take someone out; later slots move up */
  remove: (id: string) => void
  /** may the compare button fire? */
  canCompare: boolean
}

export function useColleagueCandidates(): ColleagueCandidates {
  const [chosen, setChosen] = useState<readonly CompatPerson[]>([])
  const [loadingIds, setLoadingIds] = useState<readonly string[]>([])
  // id → the token of the newest fetch for that id. A reply whose token is no longer the newest is dropped.
  const tokens = useRef(new Map<string, number>())
  const nextToken = useRef(0)

  const enrich = useCallback((id: string) => {
    const token = ++nextToken.current
    tokens.current.set(id, token)
    setLoadingIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    ;(async () => {
      try {
        const detail = (await MemberWithFriendGetDetailApi(id)) as FriendDetail | null
        if (tokens.current.get(id) !== token) return // a newer pick of the same person won
        setChosen((prev) => prev.map((p) => (p.id === id ? applyFriendDetail(p, detail) : p)))
      } catch {
        // detail fetch failed → keep the name + picture person. NEVER fabricate a dob: the row would
        // then state a birthdate the calculation was not run on, and only the row is visible.
      } finally {
        if (tokens.current.get(id) === token) {
          setLoadingIds((prev) => prev.filter((x) => x !== id))
        }
      }
    })()
  }, [])

  const pickAt = useCallback(
    (index: number, input: SelectFriendInput) => {
      const person = friendInputToPerson(input)
      setChosen((prev) => setCandidateAt(prev, index, person))
      enrich(person.id)
    },
    [enrich],
  )

  const append = useCallback(
    (input: SelectFriendInput) => {
      const person = friendInputToPerson(input)
      let landed = false
      setChosen((prev) => {
        const next = addCandidate(prev, person)
        landed = next !== prev // addCandidate returns the SAME reference when it refuses
        return next
      })
      // Only fetch a detail for someone who actually took a slot. Firing on a refused duplicate would
      // flip that person's row back into its loading state for no reason.
      if (landed) enrich(person.id)
    },
    [enrich],
  )

  const remove = useCallback((id: string) => {
    tokens.current.delete(id) // an in-flight detail for a removed person has nowhere to land
    setChosen((prev) => removeCandidate(prev, id))
    setLoadingIds((prev) => prev.filter((x) => x !== id))
  }, [])

  const isLoadingDetail = useCallback((id: string) => loadingIds.includes(id), [loadingIds])

  return {
    slots: candidateSlots(chosen),
    chosen,
    isLoadingDetail,
    pickAt,
    append,
    remove,
    canCompare: canCompare(chosen),
  }
}
