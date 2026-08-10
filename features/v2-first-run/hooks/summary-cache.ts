// First-run reading (POST /api/bazi/element-summary) CLIENT cache + prefetch (#233 C3). The reading is the
// one SLOW piece (~10s: bazi computes the full chart). Firing it when the element screen mounts means the
// user stares at a skeleton; firing it at REGISTER success — right after the chart is minted — means it runs
// while the user spends ~20-30s on intent + pdpa, so the block is usually ready by the time they arrive.
//
// 🔴 MEMORY-ONLY — never localStorage (same PII stance as chart-cache.ts: a personal reading never touches
// disk). Keyed by userId; one in-flight/resolved promise per identity, so the selector reuses the prefetch
// instead of firing a second call.
import type { AsyncState, ElementSummary } from '@/features/v2-first-run/components/ElementResultScreen'
import { summaryStateFromResponse } from './first-run-source-map'

export type SummaryPerson = { birthDate: string; birthTime?: string; gender: 'male' | 'female' | 'unspecified' }

const MEM = new Map<string, Promise<AsyncState<ElementSummary>>>()

async function fetchSummary(person: SummaryPerson): Promise<AsyncState<ElementSummary>> {
  try {
    const r = await fetch('/api/bazi/element-summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ person }),
    })
    const body = await r.json().catch(() => null)
    return summaryStateFromResponse(r.ok, body)
  } catch {
    return { status: 'error' } // timeout / network / abort → error, never a silent "nothing here"
  }
}

/** Kick the reading off at register success. No-op if already in flight/cached for this user. */
export function prefetchSummary(userId: string, person: SummaryPerson): void {
  if (!userId || MEM.has(userId)) return
  MEM.set(userId, fetchSummary(person))
}

/** The selector's read: reuse the register-time prefetch (instant / already in flight) if present, else
 *  fetch now. Either way the same promise is cached so nothing double-fetches. */
export function getSummary(userId: string, person: SummaryPerson): Promise<AsyncState<ElementSummary>> {
  const cached = userId ? MEM.get(userId) : undefined
  if (cached) return cached
  const p = fetchSummary(person)
  if (userId) MEM.set(userId, p)
  return p
}

/** Drop the cache (on logout, alongside clearChartCache). */
export function clearSummaryCache(userId?: string): void {
  if (userId) MEM.delete(userId)
  else MEM.clear()
}
