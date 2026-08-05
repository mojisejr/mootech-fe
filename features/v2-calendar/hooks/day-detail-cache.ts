// MuMate v2 — ปฏิทินดวง · day-detail CLIENT cache (G-2). Makes "กดกลับวันที่เคยดู = ไม่ยิงซ้ำ" (บอง's CoD)
// real, and lets the today-prefetch share the card's fetch.
//
// ❗ WHY a RESOLVED cache is safe here but was a MONEY BUG for the user row (useV2User is in-flight-ONLY):
// a day's detail is DETERMINISTIC in (userId, birth-signature, date) — bazi computes the same fortune for a
// fixed day+birth forever, so a stored result can never go stale. The user ROW is NOT deterministic (a
// payment flips isPaid), so caching it stranded a paid user on the free gate. Different data, different rule.
// The key includes the birth signature, so editing dob yields a new key (no cross-birth stale).
//
// Failure is never cached (a reject deletes the in-flight entry → retryable). clearDayDetailCache() on
// logout drops everything (next identity starts clean).
import type { DayDetail as LibDayDetail } from '@/lib/v2-calendar/day-detail'

type Fetcher = () => Promise<LibDayDetail | null>

const resolved = new Map<string, LibDayDetail | null>()
const inflight = new Map<string, Promise<LibDayDetail | null>>()

/** stable key — same determinants as the BFF's dayCacheKey (userId + birth signature + date). */
export function dayKey(userId: string, birthSig: string, date: string): string {
  return `${userId}:${birthSig}:${date}`
}

/**
 * Resolve a day's detail, deduped. Resolved-hit → instant (no re-fetch). In-flight → share the promise.
 * Else fetch; on success store; on failure drop the in-flight entry (retryable, never a cached failure).
 */
export function getDayDetail(key: string, fetcher: Fetcher): Promise<LibDayDetail | null> {
  if (resolved.has(key)) return Promise.resolve(resolved.get(key) ?? null)
  const pending = inflight.get(key)
  if (pending) return pending

  const p = fetcher()
    .then((detail) => {
      resolved.set(key, detail)
      return detail
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key)
    })
  inflight.set(key, p)
  return p
}

/** true if this key is already resolved (used to decide "instant" vs "loading"). */
export function hasDayDetail(key: string): boolean {
  return resolved.has(key)
}

/** SYNC peek: the resolved value (detail or null) if cached, else `undefined` — lets a re-view render the
 * cached day in the SAME tick (no loading flash), instead of waiting a microtask for a promise. */
export function peekDayDetail(key: string): LibDayDetail | null | undefined {
  return resolved.has(key) ? (resolved.get(key) ?? null) : undefined
}

/** logout hygiene — drop every cached day + any in-flight fetch. */
export function clearDayDetailCache(): void {
  resolved.clear()
  inflight.clear()
}

/** test-only introspection. */
export function _dayCacheSizes(): { resolved: number; inflight: number } {
  return { resolved: resolved.size, inflight: inflight.size }
}
