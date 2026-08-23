// ANCHOR: month-cache-deterministic-persist — the v2 ปฏิทิน month cache (P2, ฟีมเคาะ localStorage 2 ชั้น).
// Pins the rules that make "เดือนที่เคยดู ขึ้นทันที" safe: hit/miss, promote from localStorage (reopen app),
// dob-change → new key → miss (DoD #5), logout → everything cleared (DoD #6), a broken/throwing localStorage
// never breaks the app (DoD #7), a failure response is NEVER cached (isCacheableMonth), corrupt JSON is
// evicted. "Probe that lies" guard: several cases go RED if the peek returns stale / a failure is cached /
// dob does not re-key.
// Run: npx tsx scripts/month-cache.test.ts
import assert from 'node:assert/strict'
import {
  monthKey,
  monthYM,
  peekMonth,
  setMonth,
  clearMonthCache,
  isCacheableMonth,
  MONTH_CACHE_MAX,
  _monthCacheMemSize,
} from '../features/v2-calendar/hooks/month-cache'

// #293 — peekMonth now asks WHO is reading. The cases below exercise cache MECHANICS, so the viewer is a
// paying member throughout; the tier guard itself is proven in its own block at the end of this file.
const PAID_VIEWER = { paid: true }

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

// ── a Map-backed fake localStorage (the module reads globalThis.localStorage lazily, so we can swap it) ──
function makeFakeLS(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
  } as Storage
}
function installLS(ls: Storage | null) {
  ;(globalThis as { localStorage?: Storage | undefined }).localStorage = ls ?? undefined
}

// opaque day payload — the cache treats `days` as an opaque array; shape is the BFF's business.
const DAYS_A = [{ date: '2026-08-01', grade: 'A' }] as unknown as never[]
const DAYS_B = [{ date: '2026-09-01', grade: 'B' }] as unknown as never[]
const SIG1 = JSON.stringify({ dob: '1990-01-01', gender: 'M' })
const SIG2 = JSON.stringify({ dob: '1991-02-02', gender: 'M' }) // edited dob → different signature

// ── F4: no plaintext PII (name/dob/birthplace) in the on-disk key — the signature is hashed ──
t('monthKey hashes the birth signature — no plaintext name/dob/birthplace on disk', () => {
  const pii = JSON.stringify({ name: 'สมชาย ใจดี', dob: '1990-05-12', gender: 'MALE', place_name: 'กรุงเทพมหานคร' })
  const k = monthKey('uid-123', pii, monthYM(2026, 8))
  assert.ok(!k.includes('สมชาย'), 'name must not appear in the key')
  assert.ok(!k.includes('1990-05-12'), 'dob must not appear in the key')
  assert.ok(!k.includes('กรุงเทพมหานคร'), 'birthplace must not appear in the key')
  // still deterministic + still discriminates dob (DoD #5): same sig → same key, changed sig → different key
  assert.equal(k, monthKey('uid-123', pii, monthYM(2026, 8)), 'same person → same key (deterministic)')
  const pii2 = JSON.stringify({ name: 'สมชาย ใจดี', dob: '1991-06-13', gender: 'MALE', place_name: 'กรุงเทพมหานคร' })
  assert.notEqual(monthKey('uid-123', pii2, monthYM(2026, 8)), k, 'changed dob → different key')
})

// ── isCacheableMonth: a FAILURE must never be persisted ──
t('isCacheableMonth: real allowed month with days → true', () => {
  assert.equal(isCacheableMonth({ allowed: true, degraded: false, days: [{}] }), true)
})
t('isCacheableMonth: degraded → false (transient upstream failure, do not freeze)', () => {
  assert.equal(isCacheableMonth({ allowed: true, degraded: true, days: [{}] }), false)
})
t('isCacheableMonth: empty days → false', () => {
  assert.equal(isCacheableMonth({ allowed: true, degraded: false, days: [] }), false)
})
t('isCacheableMonth: gated (allowed:false) → false', () => {
  assert.equal(isCacheableMonth({ allowed: false, days: [{}] }), false)
})

// ── memory hit / miss ──
t('miss on a fresh key → undefined', () => {
  installLS(makeFakeLS())
  clearMonthCache()
  assert.equal(peekMonth(monthKey('u1', SIG1, monthYM(2026, 8)), PAID_VIEWER), undefined)
})
t('setMonth then peek → memory hit returns the same days', () => {
  installLS(makeFakeLS())
  clearMonthCache()
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  setMonth(k, DAYS_A)
  assert.deepEqual(peekMonth(k, PAID_VIEWER), DAYS_A)
})

// ── ชั้น 2: reopen app (memory empty, value only in localStorage) → read + promote ──
t('reopen app: value only in localStorage → peek reads it AND promotes to memory', () => {
  const ls = makeFakeLS()
  installLS(ls)
  clearMonthCache() // memory empty
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  // simulate a prior session having persisted it (write straight to LS under the versioned prefix + shape)
  ls.setItem('mumate:cal:v1:' + k, JSON.stringify({ t: 1, d: DAYS_A }))
  assert.equal(_monthCacheMemSize(), 0, 'precondition: memory empty')
  assert.deepEqual(peekMonth(k, PAID_VIEWER), DAYS_A, 'reads from localStorage')
  assert.equal(_monthCacheMemSize(), 1, 'promoted into memory (next read is parse-free)')
})

// ── DoD #5: edit dob → new signature → new key → MISS (never the old month) ──
t('dob change → different key → miss (แก้วันเกิด ปฏิทินไม่ค้างของเก่า)', () => {
  installLS(makeFakeLS())
  clearMonthCache()
  const ym = monthYM(2026, 8)
  setMonth(monthKey('u1', SIG1, ym), DAYS_A)
  assert.equal(peekMonth(monthKey('u1', SIG2, ym), PAID_VIEWER), undefined, 'new dob signature must miss')
  assert.deepEqual(peekMonth(monthKey('u1', SIG1, ym), PAID_VIEWER), DAYS_A, 'old signature still its own entry')
})

// ── DoD #6: logout clears memory AND every persisted mumate:cal:* key ──
t('clearMonthCache → memory empty + no mumate:cal:* left in localStorage', () => {
  const ls = makeFakeLS()
  installLS(ls)
  clearMonthCache()
  setMonth(monthKey('u1', SIG1, monthYM(2026, 8)), DAYS_A)
  setMonth(monthKey('u1', SIG1, monthYM(2026, 9)), DAYS_B)
  ls.setItem('mumate:cal:v0:legacy', 'x') // an older-version residue must ALSO be swept
  ls.setItem('unrelated:key', 'keep') // ...but nothing outside our namespace
  clearMonthCache()
  assert.equal(_monthCacheMemSize(), 0, 'memory cleared')
  assert.equal(peekMonth(monthKey('u1', SIG1, monthYM(2026, 8)), PAID_VIEWER), undefined)
  let ours = 0
  for (let i = 0; i < ls.length; i++) if ((ls.key(i) ?? '').startsWith('mumate:cal:')) ours++
  assert.equal(ours, 0, 'all mumate:cal:* (every version) removed')
  assert.equal(ls.getItem('unrelated:key'), 'keep', 'other namespaces untouched')
})

// ── DoD #7: a broken/throwing localStorage NEVER breaks the app (memory still serves) ──
t('throwing localStorage → set/peek/clear never throw; memory layer still works', () => {
  const throwing = {
    get length(): number {
      throw new Error('boom')
    },
    clear() {
      throw new Error('boom')
    },
    getItem() {
      throw new Error('boom')
    },
    setItem() {
      throw new Error('boom')
    },
    removeItem() {
      throw new Error('boom')
    },
    key() {
      throw new Error('boom')
    },
  } as unknown as Storage
  installLS(throwing)
  clearMonthCache() // must not throw even though clear() throws
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  assert.doesNotThrow(() => setMonth(k, DAYS_A)) // setItem throws → swallowed, memory still set
  assert.deepEqual(peekMonth(k, PAID_VIEWER), DAYS_A, 'served from memory despite localStorage throwing')
})
t('localStorage access itself throws (private mode) → treated as absent, memory-only', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError')
    },
  })
  clearMonthCache()
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  assert.doesNotThrow(() => setMonth(k, DAYS_A))
  assert.deepEqual(peekMonth(k, PAID_VIEWER), DAYS_A)
  // restore a normal data property for any later work
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: undefined })
})

// ── corrupt persisted JSON → miss + evict (never render garbage) ──
t('corrupt localStorage JSON → miss + evicts the bad key', () => {
  const ls = makeFakeLS()
  installLS(ls)
  clearMonthCache()
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  ls.setItem('mumate:cal:v1:' + k, '{not valid json')
  assert.equal(peekMonth(k, PAID_VIEWER), undefined, 'corrupt → miss')
  assert.equal(ls.getItem('mumate:cal:v1:' + k), null, 'bad key evicted')
})
t('wrong-shape persisted value (no `d` array) → miss + evict', () => {
  const ls = makeFakeLS()
  installLS(ls)
  clearMonthCache()
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  ls.setItem('mumate:cal:v1:' + k, JSON.stringify({ nope: true }))
  assert.equal(peekMonth(k, PAID_VIEWER), undefined)
  assert.equal(ls.getItem('mumate:cal:v1:' + k), null)
})
t('legacy array-shape entry (pre-{t,d}) → miss + evict (graceful migration, no crash)', () => {
  const ls = makeFakeLS()
  installLS(ls)
  clearMonthCache()
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  ls.setItem('mumate:cal:v1:' + k, JSON.stringify(DAYS_A)) // the shape a Vercel-preview visitor may hold
  assert.equal(peekMonth(k, PAID_VIEWER), undefined, 'old array shape not mis-read')
  assert.equal(ls.getItem('mumate:cal:v1:' + k), null, 'evicted → next view re-fetches')
})

// ── BOUNDED: never grows without limit (บอง's catch — silent DoD-#3 death when unbounded) ──
t(`localStorage capped at MONTH_CACHE_MAX (=${MONTH_CACHE_MAX}) — oldest-written evicted, newest kept`, () => {
  const ls = makeFakeLS()
  installLS(ls)
  clearMonthCache()
  // write MAX+5 distinct months with strictly increasing write-time
  const N = MONTH_CACHE_MAX + 5
  for (let i = 0; i < N; i++) {
    setMonth(monthKey('u1', SIG1, `2020-${String(i + 1).padStart(2, '0')}`), DAYS_A, 1000 + i)
  }
  let ours = 0
  for (let i = 0; i < ls.length; i++) if ((ls.key(i) ?? '').startsWith('mumate:cal:v1:')) ours++
  assert.equal(ours, MONTH_CACHE_MAX, 'localStorage bounded at the cap')
  // the 5 oldest (i=0..4, t=1000..1004) evicted; the newest present
  assert.equal(peekMonth(monthKey('u1', SIG1, '2020-01'), PAID_VIEWER), undefined, 'oldest evicted')
  assert.deepEqual(peekMonth(monthKey('u1', SIG1, `2020-${String(N).padStart(2, '0')}`), PAID_VIEWER), DAYS_A, 'newest kept')
})
t('memory layer also capped (does not grow unbounded within a session)', () => {
  installLS(makeFakeLS())
  clearMonthCache()
  for (let i = 0; i < MONTH_CACHE_MAX + 10; i++) {
    setMonth(monthKey('u1', SIG1, `2019-${String(i + 1).padStart(2, '0')}`), DAYS_A, 2000 + i)
  }
  assert.equal(_monthCacheMemSize(), MONTH_CACHE_MAX, 'memory bounded at the cap')
})

// ── F3: quota — evict OUR OWN + retry; honest victim path (never crash, never silent-death from our growth) ──
// count-limited fake: setItem of a NEW key throws QuotaExceededError once at capacity (updating existing ok).
function makeQuotaLS(limit: number): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      if (!m.has(k) && m.size >= limit) {
        const e = new Error('QuotaExceededError') as Error & { name: string }
        e.name = 'QuotaExceededError'
        throw e
      }
      m.set(k, String(v))
    },
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => Array.from(m.keys())[i] ?? null,
  } as Storage
}

t('quota from OUR OWN growth → evict oldest + retry → newest persists, never throws (F3)', () => {
  const ls = makeQuotaLS(15) // localStorage that refuses a new key past 15 entries
  installLS(ls)
  clearMonthCache()
  // write well past the quota limit; each over-limit write must evict our oldest and retry, not no-op
  let threw = false
  try {
    for (let i = 0; i < 40; i++) setMonth(monthKey('u1', SIG1, `2020-${String(i + 1).padStart(2, '0')}`), DAYS_A, 5000 + i)
  } catch {
    threw = true
  }
  assert.equal(threw, false, 'setMonth never throws under quota')
  // the MOST RECENT month is persisted ON DISK (not silently dropped) — read the fake LS directly
  const raw = ls.getItem('mumate:cal:v1:' + monthKey('u1', SIG1, '2020-40'))
  assert.ok(raw, 'newest month persisted to localStorage despite quota')
  assert.deepEqual((JSON.parse(raw as string) as { d: unknown }).d, DAYS_A, 'and it is the right data')
  let ours = 0
  for (let i = 0; i < ls.length; i++) if ((ls.key(i) ?? '').startsWith('mumate:cal:v1:')) ours++
  assert.ok(ours <= 15, `our LS entries stay bounded under quota (${ours} ≤ 15)`)
})

t('quota from ANOTHER feature (our entries cannot free it) → memory-only, no crash (F3 honest victim)', () => {
  const ls = makeQuotaLS(5)
  installLS(ls)
  clearMonthCache()
  for (let i = 0; i < 5; i++) ls.setItem(`other-feature:${i}`, 'x') // a foreign feature fills the quota
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  assert.doesNotThrow(() => setMonth(k, DAYS_A, 9000)) // we evict our own (none) → retry fails → swallow
  assert.deepEqual(peekMonth(k, PAID_VIEWER), DAYS_A, 'served from MEMORY (LS write lost — victim, not cause)')
  let foreign = 0
  for (let i = 0; i < ls.length; i++) if ((ls.key(i) ?? '').startsWith('other-feature:')) foreign++
  assert.equal(foreign, 5, "another feature's entries left untouched")
})

console.log(`\n${pass} passed`)


// ── #293 · the tier guard on the READ ─────────────────────────────────────────────────────────────────
// Bug-class this owns: closing a SERVER gate and believing the users are gated. Every entry in this store
// is paid content (isCacheableMonth writes only on allowed===true), it lives in localStorage, and it was
// filled during the 18 days the gate stood open. Turning the API refusal on does not reach a single one of
// those devices — the app would open, peek, and render a paid month for a free viewer, with the ticket
// closed and the server behaving perfectly.
//
// 🔴 MUTANT CONTRACT: delete the `if (!viewer.paid) return undefined` line in peekMonth → the first case
// below goes RED (a free viewer reads a stored month).
{
  clearMonthCache()
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  setMonth(k, DAYS_A)

  assert.deepEqual(peekMonth(k, { paid: true }), DAYS_A, 'a paying viewer still reads instantly (no slowdown)')
  assert.equal(peekMonth(k, { paid: false }), undefined, '🔴 a FREE viewer must not read a stored paid month')

  // …and the entry is NOT destroyed: a lapsed member who renews gets their own months back instantly.
  // Enforcing a permission must not delete the user's data.
  assert.deepEqual(peekMonth(k, { paid: true }), DAYS_A, 'renewing restores the instant read (nothing was evicted)')
  console.log('  ✓ #293 tier guard: free viewer blocked · paid viewer unaffected · entry preserved')
}
