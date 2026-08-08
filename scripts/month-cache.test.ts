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
  _monthCacheMemSize,
} from '../features/v2-calendar/hooks/month-cache'

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
  assert.equal(peekMonth(monthKey('u1', SIG1, monthYM(2026, 8))), undefined)
})
t('setMonth then peek → memory hit returns the same days', () => {
  installLS(makeFakeLS())
  clearMonthCache()
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  setMonth(k, DAYS_A)
  assert.deepEqual(peekMonth(k), DAYS_A)
})

// ── ชั้น 2: reopen app (memory empty, value only in localStorage) → read + promote ──
t('reopen app: value only in localStorage → peek reads it AND promotes to memory', () => {
  const ls = makeFakeLS()
  installLS(ls)
  clearMonthCache() // memory empty
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  // simulate a prior session having persisted it (write straight to LS under the versioned prefix)
  ls.setItem('mumate:cal:v1:' + k, JSON.stringify(DAYS_A))
  assert.equal(_monthCacheMemSize(), 0, 'precondition: memory empty')
  assert.deepEqual(peekMonth(k), DAYS_A, 'reads from localStorage')
  assert.equal(_monthCacheMemSize(), 1, 'promoted into memory (next read is parse-free)')
})

// ── DoD #5: edit dob → new signature → new key → MISS (never the old month) ──
t('dob change → different key → miss (แก้วันเกิด ปฏิทินไม่ค้างของเก่า)', () => {
  installLS(makeFakeLS())
  clearMonthCache()
  const ym = monthYM(2026, 8)
  setMonth(monthKey('u1', SIG1, ym), DAYS_A)
  assert.equal(peekMonth(monthKey('u1', SIG2, ym)), undefined, 'new dob signature must miss')
  assert.deepEqual(peekMonth(monthKey('u1', SIG1, ym)), DAYS_A, 'old signature still its own entry')
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
  assert.equal(peekMonth(monthKey('u1', SIG1, monthYM(2026, 8))), undefined)
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
  assert.deepEqual(peekMonth(k), DAYS_A, 'served from memory despite localStorage throwing')
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
  assert.deepEqual(peekMonth(k), DAYS_A)
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
  assert.equal(peekMonth(k), undefined, 'corrupt → miss')
  assert.equal(ls.getItem('mumate:cal:v1:' + k), null, 'bad key evicted')
})
t('wrong-shape persisted value (not an array) → miss + evict', () => {
  const ls = makeFakeLS()
  installLS(ls)
  clearMonthCache()
  const k = monthKey('u1', SIG1, monthYM(2026, 8))
  ls.setItem('mumate:cal:v1:' + k, JSON.stringify({ nope: true }))
  assert.equal(peekMonth(k), undefined)
  assert.equal(ls.getItem('mumate:cal:v1:' + k), null)
})

console.log(`\n${pass} passed`)
