// features/v2-service/hooks/useCompatibilityResult.ts — ดวงสมพงศ์ Slice 2C RESULT hook.
// goo owns: read the calculated result (v1 get-detail), parse it (compatibility-result.ts),
// and fetch the two mascots. μุน owns: the result screen that renders the returned contract and
// hides whatever is undefined.
//
// State-table (charter completeness — EVERY outcome resolves, NEVER infinite-load):
//   result: no matchingId → resolved{null}, loading OFF · loading → resolved{parsed} ·
//     API throw / malformed / legacy-no-pairMatch → resolved{null} + error=true (screen shows a
//     fallback, does NOT strand or fabricate).
//   mascots: fetched once dayGanzhi is known; a missing ganzhi or a 404 → undefined/null (the
//     screen hides that card — rule 4). Re-fetch is race-guarded by an alive flag.
import { useEffect, useState } from 'react'
import { UserMatchingCalculateWithStatusApi } from '@/constants/api/api-user-matching-calculate'
import { UserMatchingGetDetailApi } from '@/constants/api/api-user-matching-get-detail'
import {
  parseCompatibilityResult,
  applyCarriedBirth,
  mascotGanzhiPair,
  type CarriedPersons,
  type CompatibilityResult,
  type CompatMascot,
} from '../compatibility-result'
import type { CompatPerson } from '../compatibility-api'
import type { MatchingType } from '../compatibility'

export type { CompatibilityResult, CompatMascot }

// --- carry the form's birth data forward (no re-fetch on the result screen) ------------------
// The result's persons come from bazi (ganzhi/element/fourPillars) but carry NO birthDate/time;
// the form already has them (Slice 1 CompatPerson). So calculateCompatibility stashes the pair
// keyed by matchingId (sessionStorage — survives the navigate + a reload, gone with the tab), and
// the result hook reads it back and merges. Opening the result directly (no form) → no stash →
// birthDate/time stay undefined → the screen hides the line (rule 4).
const CARRY_PREFIX = 'compat-result-persons:'

export function rememberCompatPersons(matchingId: string, a: CompatPerson, b: CompatPerson): void {
  if (typeof window === 'undefined' || !matchingId) return
  try {
    const carried: CarriedPersons = {
      a: { name: a?.name, dob: a?.dob, time: a?.time, imageProfile: a?.imageProfile }, // 3C: + photo for the hero
      b: { name: b?.name, dob: b?.dob, time: b?.time, imageProfile: b?.imageProfile },
    }
    window.sessionStorage.setItem(CARRY_PREFIX + matchingId, JSON.stringify(carried))
  } catch {
    // sessionStorage unavailable / full → the header just hides the birthdate line; not fatal.
  }
}

function recallCompatPersons(matchingId: string): CarriedPersons | null {
  if (typeof window === 'undefined' || !matchingId) return null
  try {
    const raw = window.sessionStorage.getItem(CARRY_PREFIX + matchingId)
    return raw ? (JSON.parse(raw) as CarriedPersons) : null
  } catch {
    return null
  }
}

export type UseCompatibilityResult = {
  /** true while the calculated result is being read */
  loading: boolean
  /** true only when the result could not be loaded/parsed (screen shows a fallback, not a spinner) */
  error: boolean
  /** the parsed contract, or null when unavailable */
  result: CompatibilityResult | null
  /** mascot for person A's day-ganzhi — undefined (not fetched / no ganzhi) or null (not found) → hide card */
  mascotA?: CompatMascot | null
  /** mascot for person B's day-ganzhi */
  mascotB?: CompatMascot | null
  /** true while the two mascots are being fetched */
  loadingMascots: boolean
}

async function fetchMascot(ganzhi: string): Promise<CompatMascot | null> {
  try {
    const r = await fetch(`/api/bazi/mascot/${encodeURIComponent(ganzhi)}`)
    if (!r.ok) return null
    const data = (await r.json()) as { mascot?: CompatMascot | null }
    return data?.mascot ?? null
  } catch {
    return null // unreachable/timeout → hide the card, never throw at the user
  }
}

export function useCompatibilityResult(matchingId: string): UseCompatibilityResult {
  const [loading, setLoading] = useState<boolean>(!!matchingId)
  const [error, setError] = useState<boolean>(false)
  const [result, setResult] = useState<CompatibilityResult | null>(null)
  const [mascotA, setMascotA] = useState<CompatMascot | null | undefined>(undefined)
  const [mascotB, setMascotB] = useState<CompatMascot | null | undefined>(undefined)
  const [loadingMascots, setLoadingMascots] = useState<boolean>(false)

  // Read + parse the calculated result. Idempotent effect (alive guard, no doneRef latch) so
  // StrictMode's double-invoke in dev resolves cleanly; prod mounts once.
  useEffect(() => {
    if (!matchingId) {
      setResult(null)
      setError(false)
      setLoading(false) // no id → resolved-empty, NOT stuck loading
      return
    }
    let alive = true
    setLoading(true)
    setError(false)
    ;(async () => {
      try {
        const resp = await UserMatchingGetDetailApi(matchingId)
        if (!alive) return
        // merge the birthDate/time carried from the form (no re-fetch); no carry → header hides the line
        const parsed = applyCarriedBirth(parseCompatibilityResult(resp), recallCompatPersons(matchingId))
        setResult(parsed)
        setError(parsed === null) // couldn't parse / no pairMatch → error state, screen shows fallback
      } catch {
        if (alive) {
          setResult(null)
          setError(true)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [matchingId])

  // Fetch the two mascots once the result's day-ganzhi are known. A missing ganzhi is skipped
  // (undefined) so the screen hides that card; no fabricated ganzhi.
  useEffect(() => {
    const { a, b } = mascotGanzhiPair(result)
    if (!a && !b) {
      setMascotA(undefined)
      setMascotB(undefined)
      setLoadingMascots(false)
      return
    }
    let alive = true
    setLoadingMascots(true)
    ;(async () => {
      const [ma, mb] = await Promise.all([
        a ? fetchMascot(a) : Promise.resolve<CompatMascot | null | undefined>(undefined),
        b ? fetchMascot(b) : Promise.resolve<CompatMascot | null | undefined>(undefined),
      ])
      if (!alive) return
      setMascotA(ma)
      setMascotB(mb)
      setLoadingMascots(false)
    })()
    return () => {
      alive = false
    }
  }, [result])

  return { loading, error, result, mascotA, mascotB, loadingMascots }
}

// --- calculate wrapper (goo's v1-wrap lane) -------------------------------------------------
// The RESULT slice's side-effecting call: UserMatchingCalculateApi creates a log row + consumes
// the user's matching quota, then returns { matching_id }. Takes the two CompatPerson from the form
// (person1 = the user, person2 = the friend) — extracts the ids for the v1 call AND stashes their
// birthDate/time so the result screen's header can show them without a re-fetch. Wrapped here so
// μุน's view-result button just awaits a typed result and navigates. ⚠️ μุน owns the button's client
// state machine (guard double-tap so it fires ONCE, show loading, on error keep the user on the input
// screen — do NOT navigate).
//
// #263 — WHY it failed, not just THAT it failed. The old code collapsed three very different failures
// (410 quota gate · 5xx server down · no-response network) into one `{ok:false}` blob, so the screen
// showed "คำนวณไม่สำเร็จ ลองอีกครั้ง" for all — which wrongly invites a retry that burns more quota.
// Now the failure carries a `reason` so μุน can write distinct copy. The RAW BE message is NOT surfaced
// (AI_CODE_RESPONSE_MESSAGE.OUT_OF_LIMIT still says "ต่อวัน" and predates the 100/ปี ceiling — it lies);
// we emit a reason CODE and let the UI own the words.
export type CompatCalcErrorReason =
  | 'quota' // 410 GONE — free ceiling reached
  | 'system' // 5xx (or any other error status / malformed success) — server-side, not the user's fault
  | 'network' // no HTTP response — offline / timeout / CORS
export type CalculateCompatibilityResult =
  | { ok: true; matchingId: string }
  | { ok: false; reason: CompatCalcErrorReason; error?: unknown }

export async function calculateCompatibility(
  person1: CompatPerson,
  person2: CompatPerson,
  matchingType: MatchingType,
): Promise<CalculateCompatibilityResult> {
  const userId = person1?.id
  const friendId = person2?.id
  // Missing a person is a caller/precondition bug, not a server failure — bucket as system (μุน's
  // generic copy) since the button is gated on both people existing, so this path is not user-reachable.
  if (!userId || !friendId) return { ok: false, reason: 'system', error: 'missing-person' }

  const res = await UserMatchingCalculateWithStatusApi(userId, friendId, matchingType)

  if (res.ok) {
    const data = res.data as { matching_id?: string } | null
    if (data?.matching_id) {
      rememberCompatPersons(data.matching_id, person1, person2) // carry birthDate/time → result header
      return { ok: true, matchingId: data.matching_id }
    }
    // 2xx but no matching_id = BE contract violation; user can't fix it → system.
    return { ok: false, reason: 'system', error: 'no-matching-id' }
  }

  if (res.kind === 'network') return { ok: false, reason: 'network', error: res.error }
  // http error status
  if (res.status === 410) return { ok: false, reason: 'quota', error: res.data }
  return { ok: false, reason: 'system', error: res.data } // 5xx and any other error status
}
