// features/v2-service/hooks/useWorkResult.ts — #585 ก้อน 5, reading one colleague-lane result.
//
// 🔴 THE STATE IS A UNION, NOT A NULL. `entries | null` would have to mean three different things at
// once — still loading, no such result, and we failed — and the screen would end up guessing which. It
// guesses wrong in the direction that blames the user: "ไม่พบผลลัพธ์" shown while a request is still in
// flight, or shown when OUR join refused. Each state is its own case here, and the screen has to answer
// all four or it will not compile.
//
// WHY 404 AND 5xx STAY APART. pages/api/v2/matching/work/[id].ts answers 404 for "no row" and 500 when
// the stored readings do not line up with their people — it deliberately refuses to serve a best-effort
// list, because "these readings belong to somebody else" must never reach a screen. Those are different
// sentences to a person: one means the link is stale, the other means we broke something and they should
// not go hunting for a mistake of their own. Collapsing them here would throw that away at the one place
// that still knows.
import { useEffect, useState } from 'react'
import { V2MatchingWorkGetDetailApi } from '@/constants/api/api-v2-matching'
import type { WorkEntry } from '../work-comparison'

export type WorkResultState =
  | { status: 'loading' }
  /** the id resolved and the server handed back a list already in ranking order */
  | { status: 'ready'; matchingId: string; createAt: string; entries: WorkEntry[] }
  /** 404 — there is no such result (a stale link, someone else's id, a deleted row) */
  | { status: 'missing' }
  /** 5xx, a network failure, or a body we cannot read — OUR problem, said as ours */
  | { status: 'failed' }

/** narrow the wire body without trusting it: an `entries` that is not an array is a failure, not empty */
function readEntries(data: unknown): { matchingId: string; createAt: string; entries: WorkEntry[] } | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.ok !== true || !Array.isArray(d.entries)) return null
  return {
    matchingId: typeof d.matching_id === 'string' ? d.matching_id : '',
    createAt: typeof d.create_at === 'string' ? d.create_at : '',
    entries: d.entries as WorkEntry[],
  }
}

export function useWorkResult(matchingId: string): WorkResultState {
  // No id is not "loading forever" — the page gate should have caught it, and a screen stuck on a
  // spinner is the one outcome with no way out for the person looking at it.
  const [state, setState] = useState<WorkResultState>(matchingId ? { status: 'loading' } : { status: 'missing' })

  useEffect(() => {
    if (!matchingId) {
      setState({ status: 'missing' })
      return
    }
    let alive = true
    setState({ status: 'loading' })
    ;(async () => {
      try {
        const res = await V2MatchingWorkGetDetailApi(matchingId)
        if (!alive) return
        if (!res.ok) {
          // 404 is the only status that means "there is nothing here"; everything else is ours to own.
          setState(res.kind === 'http' && res.status === 404 ? { status: 'missing' } : { status: 'failed' })
          return
        }
        const read = readEntries(res.data)
        setState(read ? { status: 'ready', ...read } : { status: 'failed' })
      } catch {
        if (alive) setState({ status: 'failed' })
      }
    })()
    return () => {
      alive = false
    }
  }, [matchingId])

  return state
}
