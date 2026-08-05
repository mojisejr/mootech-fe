// Unit gate for the v2 day-detail CLIENT cache (goo · G-2). Plain tsx + node:assert (matches ci.yml
// `for f in scripts/*.test.ts`). No React — this proves the DATA layer the anti-latch hook sits on.
//
// ANCHOR: scripts/day-detail-cache.test.ts#g2-day-detail-cache
// Bug-classes this owns:
//  1. CROSS-USER LEAK (บอง's cache condition 3) — the key MUST include userId, so after logout→login as a
//     new person on the same tab, the new user can NEVER be served the previous user's cached day. A key of
//     date-alone would leak. Also proven: clearDayDetailCache() (logout) drops resolved AND inflight.
//  2. CROSS-BIRTH STALE — the key includes the birth signature, so editing dob yields a new key (a day's
//     fortune is deterministic in user+birth+date; change birth → different fortune → must not reuse).
//  3. DEDUP — two concurrent reads of the same key share ONE fetch (the today-prefetch + the card must not
//     double-hit the BFF); a resolved key never re-fetches (that is what makes "กดกลับวันเดิม" instant).
//  4. FAILURE NEVER CACHED — a rejected fetch drops the in-flight entry so the next read retries (a transient
//     5xx must not poison the day forever).
import assert from 'node:assert'
import {
  dayKey,
  getDayDetail,
  hasDayDetail,
  peekDayDetail,
  clearDayDetailCache,
  _dayCacheSizes,
} from '../features/v2-calendar/hooks/day-detail-cache'
import type { DayDetail as LibDayDetail } from '../lib/v2-calendar/day-detail'

let pass = 0
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

// a minimal lib DayDetail stub tagged by `summary` so we can tell whose/what day came back.
const libDetail = (tag: string): LibDayDetail =>
  ({ date: '2026-08-05', dayGanzhi: '甲子', overallPercent: 70, grade: 'B', summary: tag,
     suitable: [], avoid: [], yams: [], compatAreas: [], advice: [], insight: '', dayDeity: '',
     spirits: [], wanPhra: { isWanPhra: false, label: '' }, colors: [], gates: [],
     dithi: { officer: '', officerDesc: '', jianchu: '' }, luckyDirection: '' }) as unknown as LibDayDetail

// ── dayKey: includes userId + birthSig + date (bug-class 1 & 2 — the key is the whole defence) ──
ok('dayKey includes userId', dayKey('user-A', 'sig', '2026-08-05').startsWith('user-A:'))
ok('dayKey includes date', dayKey('user-A', 'sig', '2026-08-05').endsWith(':2026-08-05'))
ok('dayKey different user → different key', dayKey('user-A', 'sig', '2026-08-05') !== dayKey('user-B', 'sig', '2026-08-05'))
ok('dayKey different birth → different key', dayKey('user-A', 'sig1', '2026-08-05') !== dayKey('user-A', 'sig2', '2026-08-05'))
ok('dayKey different date → different key', dayKey('user-A', 'sig', '2026-08-05') !== dayKey('user-A', 'sig', '2026-08-06'))

async function run() {
  clearDayDetailCache()

  // ── bug-class 3: dedup — two concurrent reads of ONE key share ONE fetch ──
  let fetchCount = 0
  const slowFetch = () => new Promise<LibDayDetail | null>((res) => { fetchCount += 1; setTimeout(() => res(libDetail('A-day5')), 5) })
  const kA5 = dayKey('user-A', 'sigA', '2026-08-05')
  const [r1, r2] = await Promise.all([getDayDetail(kA5, slowFetch), getDayDetail(kA5, slowFetch)])
  ok('dedup: concurrent same-key reads share ONE fetch', fetchCount === 1)
  ok('dedup: both callers get the same detail', r1?.summary === 'A-day5' && r2?.summary === 'A-day5')

  // ── bug-class 3: resolved-hit — a resolved key never re-fetches (instant re-view) ──
  ok('resolved key is marked resolved', hasDayDetail(kA5))
  const r3 = await getDayDetail(kA5, () => { fetchCount += 1; return Promise.resolve(libDetail('SHOULD-NOT-RUN')) })
  ok('resolved-hit: no second fetch', fetchCount === 1)
  ok('resolved-hit: returns the cached detail, not the new fetcher', r3?.summary === 'A-day5')
  ok('peek: resolved key returns the value synchronously', peekDayDetail(kA5)?.summary === 'A-day5')
  ok('peek: unknown key returns undefined (→ hook shows loading)', peekDayDetail(dayKey('user-A', 'sigA', '2026-12-25')) === undefined)

  // ── bug-class 1: CROSS-USER — user-B's key gets user-B's day, never user-A's cached day ──
  const kB5 = dayKey('user-B', 'sigB', '2026-08-05') // same date, different user
  ok('cross-user: user-B key is NOT resolved by user-A caching', !hasDayDetail(kB5))
  const rB = await getDayDetail(kB5, () => Promise.resolve(libDetail('B-day5')))
  ok('cross-user: user-B gets user-B detail', rB?.summary === 'B-day5')
  ok('cross-user: user-A still has user-A detail (no clobber)', peekDayDetail(kA5)?.summary === 'A-day5')

  // ── bug-class 1: logout — clearDayDetailCache drops BOTH resolved and inflight ──
  const pendingKey = dayKey('user-A', 'sigA', '2026-09-09')
  void getDayDetail(pendingKey, () => new Promise<LibDayDetail | null>(() => {})) // never resolves → stays in-flight
  ok('before clear: resolved and inflight both populated', _dayCacheSizes().resolved > 0 && _dayCacheSizes().inflight > 0)
  clearDayDetailCache()
  ok('logout: clear drops resolved', _dayCacheSizes().resolved === 0)
  ok('logout: clear drops inflight', _dayCacheSizes().inflight === 0)
  ok('logout: previous user-A day no longer served', peekDayDetail(kA5) === undefined)

  // ── bug-class 4: a rejected fetch is NOT cached — the next read retries ──
  const kFail = dayKey('user-C', 'sigC', '2026-10-10')
  let failCalls = 0
  await getDayDetail(kFail, () => { failCalls += 1; return Promise.reject(new Error('5xx')) }).catch(() => {})
  ok('failure: rejection is not stored as resolved', !hasDayDetail(kFail))
  ok('failure: in-flight entry dropped after reject', _dayCacheSizes().inflight === 0)
  const rRetry = await getDayDetail(kFail, () => { failCalls += 1; return Promise.resolve(libDetail('C-recovered')) })
  ok('failure: next read RETRIES (fetcher ran twice)', failCalls === 2)
  ok('failure: retry succeeds and caches', rRetry?.summary === 'C-recovered' && hasDayDetail(kFail))

  clearDayDetailCache()
  console.log(`✅ day-detail-cache.test.ts — ${pass} assertions passed`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
