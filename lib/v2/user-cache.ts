// v2 — shared /api/user fetch DE-DUPLICATION (goo · G-0c identity, บอง 4-condition sign-off 2026-08-05).
//
// PROBLEM (#165 shape): a v2 page can mount two hooks that both need the user row — useV2Tier (paid gate)
// and, on the calendar, useCalendarMonth (birth data for the personalised month). Each firing its own
// UserGetById = two identical requests for one identity on one page.
//
// FIX: an IN-FLIGHT dedup ONLY. While a fetch for a userId is pending, every concurrent caller gets the
// SAME promise — one network request. The moment it settles (success OR failure) the entry is dropped.
//
// ❌ Deliberately NO persistent "resolved" cache. A stored row would go STALE for the whole session, and
// that is a MONEY bug, not a UX one: a user pays → returns to a page → the cached pre-payment row still
// says isPaid=false until they restart the app (บอง's catch). Dropping on settle means a later remount
// RE-FETCHES a fresh row — exactly today's behaviour, no regression, no TTL, no payment-flow cache-busting.
//
// SAFETY (บอง's 4 conditions):
//  1. keyed by the REAL userId (Map key) — never a single global slot.
//  2. failure is NEVER remembered — a reject/settle deletes the entry, so the next call retries.
//  3. clearUserCache() abandons any in-flight fetch on logout (useV2Logout).
//  4. proven by scripts/user-cache.test.ts — concurrent dedup AND change-userId-never-serves-old-row.
//
// This module imports NOTHING app-specific on purpose — the caller supplies the fetcher (useV2User passes
// the real UserGetById). That keeps it a pure, unit-testable primitive: a plain-tsx test can exercise it
// without dragging in Next's publicRuntimeConfig chain (which UserGetById needs and which is absent in a
// node test process).

// The row is opaque here — callers (useV2User) validate its shape. The real fetcher (UserGetById) RESOLVES
// with a row or an error shape ({error}); a network failure REJECTS. Either way nothing is persisted, so
// both are retryable.
type UserFetcher = (userId: string) => Promise<unknown>

const inflight = new Map<string, Promise<unknown>>()

/**
 * Fetch the user row for `userId`, de-duplicated across CONCURRENT callers only.
 * `fetcher` is supplied by the caller (useV2User → UserGetById; tests → a call-counting stub).
 */
export function getUser(userId: string, fetcher: UserFetcher): Promise<unknown> {
  const pending = inflight.get(userId)
  if (pending) return pending // a caller arrived during the in-flight window → SAME promise, no 2nd request

  // Start one request; drop the entry the instant it settles (success OR failure) so nothing persists.
  const p = fetcher(userId).finally(() => {
    // Only delete OUR entry — a newer identity's fetch (different key) is untouched.
    if (inflight.get(userId) === p) inflight.delete(userId)
  })
  inflight.set(userId, p)
  return p
}

/** Logout hygiene: abandon any in-flight fetch so the next login on this machine starts clean. */
export function clearUserCache(): void {
  inflight.clear()
}

/** test-only: how many identities are mid-flight right now. */
export function _inflightSize(): number {
  return inflight.size
}
