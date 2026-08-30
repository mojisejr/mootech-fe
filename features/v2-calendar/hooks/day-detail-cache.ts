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

/**
 * 🔴 #529 — WHAT THIS CACHE STORES, and why it is no longer the detail object alone.
 *
 * The stored value used to be `LibDayDetail | null`, so `null` was the only way to say "no detail" and it
 * collapsed three different situations into one pixel: the upstream broke, the profile has no birthday,
 * and — since #358 Phase 3 — *this day is outside what your package sells*. The route emits `outOfSpan`
 * and features/v2-calendar/hooks/fetch-day-detail.ts carries it across the wire, but the value cached
 * here was rebuilt as `r.detail`, so the flag died at this boundary and the screen showed the person a
 * broken card where ฟีมเคาะ 2026-08-24 says it should show an invitation to upgrade.
 *
 * ⚠️ The widening is what makes the fix possible — a cache hit can only return what the cache holds. This
 * is deliberately a small record rather than the raw response: `cached`/`degraded` are transport facts
 * about ONE request and must never be replayed from a later hit.
 *
 * 🔴 A WALLED DAY IS NEVER STORED — see isCacheableDay below. An earlier version of this comment called
 * `outOfSpan` "a property of the (user, birth, date, tier) key and so safe to store". ตู๋ measured that
 * the key does not carry the tier at all — it carries a boolean — and the span is three-valued, so the
 * sentence was false at the only place it mattered.
 */
export type CachedDay = {
  detail: LibDayDetail | null
  /** the day sits outside this tier's span — a paid wall, NOT a failure. */
  outOfSpan: boolean
}

type Fetcher = () => Promise<CachedDay>

const resolved = new Map<string, CachedDay>()
const inflight = new Map<string, Promise<CachedDay>>()

/** stable key — the BFF's dayCacheKey determinants (userId + birth signature + date) PLUS the tier, which
 *  the BFF does not need in its own key because it caches the FULL day and trims per response (#226). */
export function dayKey(userId: string, birthSig: string, date: string, paid: boolean): string {
  return `${userId}:${birthSig}:${date}:${paid ? 'paid' : 'free'}`
}

/**
 * Resolve a day's detail, deduped. Resolved-hit → instant (no re-fetch). In-flight → share the promise.
 * Else fetch; on success store; on failure drop the in-flight entry (retryable, never a cached failure).
 */
/**
 * 🔴 #529 / ตู๋ B1 — may this answer be REMEMBERED? A walled day may not, and the reason is the key.
 *
 * `dayKey` ends in a boolean (`paid`), while the calendar span has three values —
 * lib/v2/entitlement.ts:52 `calendar: { FREE: 1, PLUS: 12, PRO: null }`. So PLUS and PRO share one key
 * while disagreeing about which months they may open. ตู๋ ran it: a PLUS member hits the wall, buys PRO
 * (pages/v2/shop/result.tsx:61 returns them with router.push, a SOFT navigation, so this module-level map
 * survives and only logout clears it), reopens the day, and is invited to upgrade to the level they just
 * bought. Before #529 the same stale key held `detail: null` and rendered the neutral face; storing the
 * flag is what would have turned that staleness into an upsell aimed at someone who already paid.
 *
 * Two ways to close it, and this is the second: put the real level in the key, or refuse to store a walled
 * day. The key is the wrong lever here — pages/api/v2/day-detail.ts:123 trims the reply by the BOOLEAN
 * (`paid ? detail : pickFreeDayDetail(detail)`), so PLUS and PRO receive an identical `detail`, and adding
 * the tier would miss every cached day of a PLUS→PRO upgrade to re-fetch content that did not change —
 * paying the bazi cost #358 measured at ~6.8s per month per person for nothing. A walled day, by contrast,
 * costs almost nothing to re-fetch: day-detail.ts:112 returns before any upstream call.
 *
 * 🔑 μุน named the precedent: the month lane already does exactly this one layer up —
 * features/v2-calendar/hooks/month-cache.ts:119 `isCacheableMonth` keeps a GATED month out of storage, so
 * a refusal is never replayed there either. Same principle, one layer down.
 */
export function isCacheableDay(day: CachedDay): boolean {
  return !day.outOfSpan
}

export function getDayDetail(key: string, fetcher: Fetcher): Promise<CachedDay> {
  const hit = resolved.get(key)
  if (hit) return Promise.resolve(hit)
  const pending = inflight.get(key)
  if (pending) return pending

  const p = fetcher()
    .then((day) => {
      // A walled day is answered but never remembered ⇒ every reopen asks the server again and so can
      // never contradict it. The caller still gets the flag from THIS response, so the screen behaves
      // identically on the first view; what changes is only what survives to the second.
      if (isCacheableDay(day)) resolved.set(key, day)
      return day
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

/** SYNC peek: the resolved record if cached, else `undefined` — lets a re-view render the cached day in
 * the SAME tick (no loading flash), instead of waiting a microtask for a promise.
 * #529: returns the whole CachedDay, so an out-of-span day stays out-of-span on a cache hit. Returning
 * the detail alone here is precisely how the flag was lost the first time. */
export function peekDayDetail(key: string): CachedDay | undefined {
  return resolved.get(key)
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
