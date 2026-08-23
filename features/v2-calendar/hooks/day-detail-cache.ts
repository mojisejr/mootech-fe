// MuMate v2 — ปฏิทินดวง · day-detail CLIENT cache (G-2). Makes "กดกลับวันที่เคยดู = ไม่ยิงซ้ำ" (บอง's CoD)
// real, and lets the today-prefetch share the card's fetch.
//
// ❗ WHY a RESOLVED cache is safe here but was a MONEY BUG for the user row (useV2User is in-flight-ONLY):
// a day's detail is DETERMINISTIC in (userId, birth-signature, date) — bazi computes the same fortune for a
// fixed day+birth forever, so a stored result can never go stale. The user ROW is NOT deterministic (a
// payment flips isPaid), so caching it stranded a paid user on the free gate. Different data, different rule.
// The key includes the birth signature, so editing dob yields a new key (no cross-birth stale).
//
// 🔴 #226 ADDED A FOURTH DETERMINANT — `paid`. Since the BFF now TRIMS the reply by tier, the same
// (user, birth, date) resolves to two DIFFERENT objects, and the sentence above stopped being true the
// moment that shipped. Without this dimension a user who upgrades inside the app keeps being served the
// free-shaped day out of this Map until a reload — exactly the "stranded a paid user on the free gate"
// bug this header warns about, re-entering through the door it was written to guard.
// (The upgrade path is real: /v2/shop is one tap from this screen.)
//
// Failure is never cached (a reject deletes the in-flight entry → retryable). clearDayDetailCache() on
// logout drops everything (next identity starts clean).
import type { DayDetail as LibDayDetail } from '@/lib/v2-calendar/day-detail'

type Fetcher = () => Promise<LibDayDetail | null>

const resolved = new Map<string, LibDayDetail | null>()
const inflight = new Map<string, Promise<LibDayDetail | null>>()

/** stable key — the BFF's dayCacheKey determinants (userId + birth signature + date) PLUS the tier, which
 *  the BFF does not need in its own key because it caches the FULL day and trims per response (#226). */
export function dayKey(userId: string, birthSig: string, date: string, paid: boolean): string {
  return `${userId}:${birthSig}:${date}:${paid ? 'paid' : 'free'}`
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
