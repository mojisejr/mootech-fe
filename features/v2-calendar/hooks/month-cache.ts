// MuMate v2 — ปฏิทินดวง · month CLIENT cache (P2, ฟีมเคาะ localStorage 2 ชั้น). Makes "เดือนที่เคยดู ขึ้น
// ทันที" real — even after closing the app — so paging months / switching tabs / reopening never re-pays
// the ~6.8s first-view cost (pages/api/v2/calendar-month.ts:10-12).
//
//   ชั้น 1  memory Map   — sync, no parse. Instant re-view within a session.
//   ชั้น 2  localStorage — survives reload / tab-close / app reopen (the reason ฟีม asked for this over the
//                          in-memory server cache, which dies every deploy and is not shared to the browser).
//   read: memory → (miss) localStorage (promote to memory) → (miss) undefined → caller fetches.
//
// ❗ WHY a PERSISTED cache is safe here — the SAME rule day-detail-cache.ts states, applied to the month:
// a month's fortune is DETERMINISTIC in (userId, birth-signature, YYYY-MM) — bazi computes the same days for
// a fixed month+birth forever, so a stored result can never go stale. The key includes the birth signature
// (JSON.stringify(person) — identical determinant to the BFF's fortuneCacheKey), so editing dob yields a NEW
// key → the old month is never read again (แก้วันเกิด → ปฏิทินเปลี่ยนตาม, DoD #5). The user ROW is a
// DIFFERENT rule — NOT deterministic (a payment flips isPaid) → it is in-flight-ONLY (lib/v2/user-cache.ts),
// a money bug if persisted. This module deliberately walks BESIDE user-cache.ts, never touches it.
//
// ❗ FAILURE IS NEVER CACHED — isCacheableMonth() gates the write: a degraded/empty/gated response (upstream
// timeout, no identity) is transient, and a persisted empty month would freeze that failure forever. Only a
// real, non-empty, allowed month is stored (same discipline as day-detail's "a reject deletes the entry").
//
// ❗ localStorage NEVER throws to the caller — accessing it can itself throw (sandboxed iframe, Safari
// private mode, cookies disabled), and setItem can throw on quota. Every access is guarded → a broken/full/
// disabled localStorage silently degrades to memory-only; the app keeps working, just slower next time (DoD
// #7). The value is versioned (LS_WRITE_PREFIX) so a future shape change invalidates old entries instead of
// mis-rendering a previous deploy's JSON.
//
// ❗ BOUNDED — MONTH_CACHE_MAX caps BOTH layers with oldest-first eviction (บอง's catch: an UNBOUNDED cache
// never crashes, but once localStorage fills, setMonth silently no-ops FOREVER → new months stop persisting
// → DoD #3 dies with no signal). Numbers: a stored month ≈ 3.4 KB (measured — 31 days + key). The server's
// fortuneCache caps at 256; the browser has ~5 MB SHARED with other features (what-if, compat), so we cap
// FAR lower: 24 months ≈ 80 KB ≈ 1.5% of quota. There is no silent-death mode left — we never fill from our
// own growth, and we stay a good localStorage citizen. Each entry carries its write time so eviction is by
// oldest-written (a rarely-touched stale month goes first; re-fetching it later is the cheap, correct cost).
import type { CalendarDay as ApiCalendarDay } from '@/lib/v2-calendar/month'

// The cached payload is the RAW day array (exactly what the BFF returns / the server fortuneCache stores),
// NOT the assembled feature month — the caller re-runs assembleFeatureMonth on read, so a change to the
// assemble logic in a later deploy applies to cached data too, and the shape guard stays trivial (an array).
type MonthDays = ApiCalendarDay[]
// Persisted shape: `t` (write-time ms, for oldest-first eviction) + `d` (the raw days). `t` is the FIRST
// field so eviction can read it with a cheap prefix match, never a full parse of the big `d` array.
type StoredMonth = { t: number; d: MonthDays }

// ~24 months ≈ 80 KB ≈ 1.5% of a ~5 MB localStorage shared with other features. Generous for real browsing
// (2 years of DISTINCT viewed months); the oldest beyond this is evicted and simply re-fetched if revisited.
export const MONTH_CACHE_MAX = 24

const MEM = new Map<string, MonthDays>()

// Bump the version segment on any change to the stored shape → old-shape entries are ignored (and swept on
// logout by the broader clear prefix below), never parsed as the new shape.
const LS_WRITE_PREFIX = 'mumate:cal:v1:'
// Logout / hygiene sweeps EVERY version (mumate:cal:*), so no prior-version residue leaks to the next user.
const LS_CLEAR_PREFIX = 'mumate:cal:'

/** `YYYY-MM` from a 1-12 month (same format as the BFF's month param). */
export function monthYM(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Cache key — the fortune's determinants: userId + birth signature + month. Matches fortuneCacheKey. */
export function monthKey(userId: string, birthSig: string, ym: string): string {
  return `${userId}:${birthSig}:${ym}`
}

/**
 * Only a REAL month is cacheable — a failure must never be persisted (it would freeze forever). allowed:false
 * = gated/no-identity; degraded = upstream unreachable; empty days = nothing computed. Pure so it is unit-
 * testable and the "never cache a failure" invariant lives in one named place, not inline in the hook.
 */
export function isCacheableMonth(resp: { allowed?: boolean; degraded?: boolean; days?: unknown }): boolean {
  return resp.allowed === true && !resp.degraded && Array.isArray(resp.days) && resp.days.length > 0
}

/**
 * SYNC peek — memory first (instant, no parse), then localStorage (parse + promote to memory), else
 * `undefined`. Returning in the same tick is what lets the hook render a cached month WITHOUT a loading
 * flash (DoD #1). A corrupt or wrong-shaped localStorage entry is treated as a miss and evicted.
 */
export function peekMonth(key: string): MonthDays | undefined {
  const mem = MEM.get(key)
  if (mem) return mem

  const raw = safeGet(LS_WRITE_PREFIX + key)
  if (raw === null) return undefined
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMonth>
    if (!parsed || !Array.isArray(parsed.d)) {
      safeRemove(LS_WRITE_PREFIX + key) // wrong shape (old version / tampered) → miss + evict
      return undefined
    }
    const days = parsed.d
    MEM.set(key, days) // promote to ชั้น 1 so the next read is parse-free
    capMem()
    return days
  } catch {
    safeRemove(LS_WRITE_PREFIX + key) // corrupt JSON → miss + evict
    return undefined
  }
}

/** Store a real month in BOTH layers, bounded (oldest-first eviction). Best-effort localStorage: quota/
 *  disabled → memory-only, never throws. `now` is injectable for deterministic tests (default = wall clock). */
export function setMonth(key: string, days: MonthDays, now: number = Date.now()): void {
  MEM.set(key, days)
  capMem()
  const stored: StoredMonth = { t: now, d: days }
  safeSet(LS_WRITE_PREFIX + key, JSON.stringify(stored))
  capLs()
}

// ── bounded eviction ──────────────────────────────────────────────────────────────────────────────────
// Keep the Map (insertion-ordered) at ≤ MONTH_CACHE_MAX — drop the oldest-inserted first.
function capMem(): void {
  while (MEM.size > MONTH_CACHE_MAX) {
    const oldest = MEM.keys().next().value
    if (oldest === undefined) break
    MEM.delete(oldest)
  }
}

// Keep our localStorage entries at ≤ MONTH_CACHE_MAX — evict the oldest-WRITTEN first. Reads `t` from the
// leading `{"t":<ms>` prefix (no full parse of the big `d` array); a value that does not match is treated as
// oldest (t=0) so a legacy/garbage entry is the first to go.
function capLs(): void {
  const ls = getLS()
  if (!ls) return
  try {
    const entries: { key: string; t: number }[] = []
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (!k || !k.startsWith(LS_WRITE_PREFIX)) continue
      const raw = ls.getItem(k) ?? ''
      const m = raw.match(/^\{"t":(\d+)/)
      entries.push({ key: k, t: m ? Number(m[1]) : 0 })
    }
    if (entries.length <= MONTH_CACHE_MAX) return
    entries.sort((a, b) => a.t - b.t) // oldest first
    for (const e of entries.slice(0, entries.length - MONTH_CACHE_MAX)) ls.removeItem(e.key)
  } catch {
    // a throwing localStorage → nothing to cap; memory is already bounded
  }
}

/** Logout hygiene — drop the whole month cache (memory + every mumate:cal:* key, any version) so the next
 *  identity on this machine never sees the previous person's months (DoD #6). */
export function clearMonthCache(): void {
  MEM.clear()
  safeClearPrefix(LS_CLEAR_PREFIX)
}

/** test-only introspection. */
export function _monthCacheMemSize(): number {
  return MEM.size
}

// ── localStorage access, fully guarded ────────────────────────────────────────────────────────────────
// getLS() itself is wrapped: reading `globalThis.localStorage` can THROW (Safari private mode historically,
// sandboxed contexts). In SSR / the test runner there is no localStorage → null → the cache is memory-only,
// which is correct (peek/set only run client-side in a useEffect anyway).
function getLS(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage
    return ls ?? null
  } catch {
    return null
  }
}

function safeGet(k: string): string | null {
  const ls = getLS()
  if (!ls) return null
  try {
    return ls.getItem(k)
  } catch {
    return null
  }
}

function safeSet(k: string, v: string): void {
  const ls = getLS()
  if (!ls) return
  try {
    ls.setItem(k, v)
  } catch {
    // quota exceeded / disabled → skip persistence; memory layer still serves this session (DoD #7)
  }
}

function safeRemove(k: string): void {
  const ls = getLS()
  if (!ls) return
  try {
    ls.removeItem(k)
  } catch {
    // ignore — nothing to do if it cannot be removed
  }
}

function safeClearPrefix(prefix: string): void {
  const ls = getLS()
  if (!ls) return
  try {
    const keys: string[] = []
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (k && k.startsWith(prefix)) keys.push(k)
    }
    for (const k of keys) ls.removeItem(k) // collect-then-remove (removing while indexing shifts the list)
  } catch {
    // a throwing localStorage → nothing to clear from our side; memory was already cleared
  }
}
