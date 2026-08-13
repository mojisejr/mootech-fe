// Deterministic unit tests for lib/usage-core (Phase 2 hard gate, #mootech-fullstack-supabase-fold).
// DB-free — pure functions only. Run: npx tsx scripts/usage-core.test.ts
// Asserts the helper reproduces every NestJS isCheckUsage variant + isNotExpired + count windows.
import assert from 'node:assert/strict'
import {
  AI_CODE,
  AI_MSG,
  isNotExpired,
  classifyMembership,
  evaluateUsage,
  dayWindow,
  monthWindow,
  yearWindow,
  quotaRemaining,
  FREE_FRIEND_LIMIT,
  FREE_MATCHING_LIMIT,
} from '../lib/usage-core'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

// Fixed "now" = 2026-06-14 12:00 Asia/Bangkok (05:00 UTC) -> bkkDateStr '2026-06-14'
const NOW = new Date('2026-06-14T05:00:00Z')

// ── isNotExpired (date-only, Bangkok; not-expired iff today <= expireDay) ──
t('isNotExpired today == expire -> true', () => assert.equal(isNotExpired('2026-06-14', NOW), true))
t('isNotExpired past -> false', () => assert.equal(isNotExpired('2026-06-13', NOW), false))
t('isNotExpired future -> true', () => assert.equal(isNotExpired('2026-06-15', NOW), true))
t('isNotExpired datetime string slices to date -> true', () =>
  assert.equal(isNotExpired('2026-12-31 00:00:00', NOW), true))
t('isNotExpired null -> false', () => assert.equal(isNotExpired(null, NOW), false))
t('isNotExpired empty -> false', () => assert.equal(isNotExpired('', NOW), false))
t('isNotExpired garbage -> false', () => assert.equal(isNotExpired('not-a-date', NOW), false))
t('isNotExpired impossible date -> false', () => assert.equal(isNotExpired('2026-02-31', NOW), false))

// ── classifyMembership ──
t('classify null -> free/NO_PLAN', () =>
  assert.deepEqual(classifyMembership(null, NOW), { isFree: true, reason: 'NO_PLAN' }))
t('classify non-MEMBER plan -> free/NO_PLAN', () =>
  assert.deepEqual(classifyMembership({ planCode: 'HOROSCOPE', expireAt: '2099-01-01' }, NOW), {
    isFree: true,
    reason: 'NO_PLAN',
  }))
t('classify MEMBER expired -> free/EXPIRED', () =>
  assert.deepEqual(classifyMembership({ planCode: 'MEMBER', expireAt: '2026-06-13' }, NOW), {
    isFree: true,
    reason: 'EXPIRED',
  }))
t('classify MEMBER valid (today) -> paid/MEMBER', () =>
  assert.deepEqual(classifyMembership({ planCode: 'MEMBER', expireAt: '2026-06-14' }, NOW), {
    isFree: false,
    reason: 'MEMBER',
  }))
t('classify MEMBER valid (future) -> paid/MEMBER', () =>
  assert.deepEqual(classifyMembership({ planCode: 'MEMBER', expireAt: '2099-01-01' }, NOW), {
    isFree: false,
    reason: 'MEMBER',
  }))

// ── FREE_FRIEND_LIMIT: single source for the pre-launch friend ceiling (#262) ──
// The three friend sites (lib/usage.ts, pages/api/member-with-friend, pages/api/user.ts) all reference
// this. Revert here → all three follow → the real-path specs below + this assertion go red.
t('FREE_FRIEND_LIMIT === 20 (pre-launch)', () => assert.equal(FREE_FRIEND_LIMIT, 20))

// ── evaluateUsage: chinese-calendar (reflect membership, no count limit) ──
const cc = (reason: any, isFree: boolean) =>
  evaluateUsage({ reason, isFree, count: 0, limitFree: 0, limitMember: 0, limitMode: 'none', reflectMembershipCode: true })
t('chinese-calendar NO_PLAN -> 403 free', () =>
  assert.deepEqual(cc('NO_PLAN', true), { code: AI_CODE.NO_PLAN, message: AI_MSG.NO_PLAN, is_free: true }))
t('chinese-calendar EXPIRED -> 402 free', () =>
  assert.deepEqual(cc('EXPIRED', true), { code: AI_CODE.EXPIRED, message: AI_MSG.EXPIRED, is_free: true }))
t('chinese-calendar MEMBER -> 200 paid', () =>
  assert.deepEqual(cc('MEMBER', false), { code: AI_CODE.SUCCESS, message: AI_MSG.SUCCESS, is_free: false }))

// ── evaluateUsage: member-with-friend (all, free=20/member=20 after #262, _ALL msg, code never NO_PLAN/EXPIRED) ──
// NOTE: this mirrors the config values in lib/usage.ts:checkMemberWithFriendUsage. The teeth that a
// revert of limitFree 20→1 must fail live in scripts/member-with-friend-limit.test.tsx (imports the
// REAL wrapper). This block only proves evaluateUsage's mechanics at that shape.
const mwf = (isFree: boolean, count: number, reason: any = isFree ? 'NO_PLAN' : 'MEMBER') =>
  evaluateUsage({ reason, isFree, count, limitFree: 20, limitMember: 20, limitMode: 'all', reflectMembershipCode: false, outOfLimitMessage: AI_MSG.OUT_OF_LIMIT_ALL })
t('mwf free under limit -> SUCCESS (code stays 200 even for NO_PLAN)', () =>
  assert.deepEqual(mwf(true, 0), { code: AI_CODE.SUCCESS, message: AI_MSG.SUCCESS, is_free: true }))
t('mwf free at 19 (under new limit) -> SUCCESS', () =>
  assert.deepEqual(mwf(true, 19), { code: AI_CODE.SUCCESS, message: AI_MSG.SUCCESS, is_free: true }))
t('mwf free at limit(20) -> OUT_OF_LIMIT _ALL', () =>
  assert.deepEqual(mwf(true, 20), { code: AI_CODE.OUT_OF_LIMIT, message: AI_MSG.OUT_OF_LIMIT_ALL, is_free: true }))
t('mwf member under limit(20) -> SUCCESS', () =>
  assert.deepEqual(mwf(false, 19), { code: AI_CODE.SUCCESS, message: AI_MSG.SUCCESS, is_free: false }))
t('mwf member at limit(20) -> OUT_OF_LIMIT _ALL', () =>
  assert.deepEqual(mwf(false, 20), { code: AI_CODE.OUT_OF_LIMIT, message: AI_MSG.OUT_OF_LIMIT_ALL, is_free: false }))

// ── evaluateUsage: fortune-telling (free-only limit; members never blocked; plain msg) ──
const ft = (isFree: boolean, count: number, reason: any = isFree ? 'NO_PLAN' : 'MEMBER') =>
  evaluateUsage({ reason, isFree, count, limitFree: 1, limitMember: 1, limitMode: 'free-only', reflectMembershipCode: false })
t('fortune free under limit -> SUCCESS', () =>
  assert.deepEqual(ft(true, 0), { code: AI_CODE.SUCCESS, message: AI_MSG.SUCCESS, is_free: true }))
t('fortune free at limit(1) -> OUT_OF_LIMIT (plain)', () =>
  assert.deepEqual(ft(true, 1), { code: AI_CODE.OUT_OF_LIMIT, message: AI_MSG.OUT_OF_LIMIT, is_free: true }))
t('fortune member huge count -> SUCCESS (members not limited)', () =>
  assert.deepEqual(ft(false, 9999), { code: AI_CODE.SUCCESS, message: AI_MSG.SUCCESS, is_free: false }))

// ── evaluateUsage: heavenly-spirit-card (all, free=1/member=10, plain msg) ──
const hs = (isFree: boolean, count: number, reason: any = isFree ? 'NO_PLAN' : 'MEMBER') =>
  evaluateUsage({ reason, isFree, count, limitFree: 1, limitMember: 10, limitMode: 'all', reflectMembershipCode: false })
t('heaven free at limit(1) -> OUT_OF_LIMIT', () =>
  assert.deepEqual(hs(true, 1), { code: AI_CODE.OUT_OF_LIMIT, message: AI_MSG.OUT_OF_LIMIT, is_free: true }))
t('heaven member under limit(10) -> SUCCESS', () =>
  assert.deepEqual(hs(false, 9), { code: AI_CODE.SUCCESS, message: AI_MSG.SUCCESS, is_free: false }))
t('heaven member at limit(10) -> OUT_OF_LIMIT', () =>
  assert.deepEqual(hs(false, 10), { code: AI_CODE.OUT_OF_LIMIT, message: AI_MSG.OUT_OF_LIMIT, is_free: false }))

// ── count windows (Bangkok) ──
t('dayWindow', () =>
  assert.deepEqual(dayWindow(NOW), { start: '2026-06-14 00:00:00', end: '2026-06-14 23:59:59' }))
t('monthWindow (30-day month)', () =>
  assert.deepEqual(monthWindow(NOW), { start: '2026-06-01 00:00:00', end: '2026-06-30 23:59:59' }))
t('monthWindow (leap February)', () =>
  assert.deepEqual(monthWindow(new Date('2024-02-10T05:00:00Z')), {
    start: '2024-02-01 00:00:00',
    end: '2024-02-29 23:59:59',
  }))

// ── yearWindow (#264 trap): must equal BE matching.service.ts startOf/endOf year, Bangkok, string ──
t('yearWindow mid-year -> Jan 1 .. Dec 31 (same year)', () =>
  assert.deepEqual(yearWindow(NOW), { start: '2026-01-01 00:00:00', end: '2026-12-31 23:59:59' }))
// Bangkok is UTC+7: an instant late on Dec 31 UTC is already NEXT YEAR in Bangkok. A naive UTC
// getFullYear() would bucket this into 2026 and the count would silently miss/overcount → indicator lies.
t('yearWindow Bangkok year boundary (Dec 31 18:00Z = next year in BKK)', () =>
  assert.deepEqual(yearWindow(new Date('2026-12-31T18:00:00Z')), {
    start: '2027-01-01 00:00:00',
    end: '2027-12-31 23:59:59',
  }))
t('yearWindow just-before boundary stays this year (Dec 31 10:00Z = 17:00 BKK)', () =>
  assert.deepEqual(yearWindow(new Date('2026-12-31T10:00:00Z')), {
    start: '2026-01-01 00:00:00',
    end: '2026-12-31 23:59:59',
  }))

// ── quotaRemaining (#264): remaining = clamp0(limit - used); member=null → unlimited ──
t('FREE_MATCHING_LIMIT === 100 (mirrors BE MATCHING_LIMIT.FREE)', () =>
  assert.equal(FREE_MATCHING_LIMIT, 100))
t('matching free used 3 -> remaining 97', () =>
  assert.deepEqual(quotaRemaining({ isFree: true, used: 3, limitFree: 100, limitMember: null }), {
    unlimited: false, limit: 100, used: 3, remaining: 97,
  }))
t('matching member -> unlimited (BE never caps members)', () =>
  assert.deepEqual(quotaRemaining({ isFree: false, used: 999, limitFree: 100, limitMember: null }), {
    unlimited: true, used: 999,
  }))
t('used at limit -> remaining 0', () =>
  assert.deepEqual(quotaRemaining({ isFree: true, used: 100, limitFree: 100, limitMember: null }).remaining, 0))
t('used OVER old ceiling -> remaining 0, never negative', () =>
  assert.deepEqual(quotaRemaining({ isFree: true, used: 105, limitFree: 100, limitMember: null }).remaining, 0))
t('friend free used 19 (limit 20) -> remaining 1', () =>
  assert.deepEqual(quotaRemaining({ isFree: true, used: 19, limitFree: 20, limitMember: 20 }), {
    unlimited: false, limit: 20, used: 19, remaining: 1,
  }))
t('friend member used 5 (limit 20) -> remaining 15 (member NOT unlimited for friend)', () =>
  assert.deepEqual(quotaRemaining({ isFree: false, used: 5, limitFree: 20, limitMember: 20 }), {
    unlimited: false, limit: 20, used: 5, remaining: 15,
  }))

if (!process.exitCode) console.log(`✓ all ${pass} usage-core assertions passed`)
else console.error(`\n${pass} passed, FAILURES above`)
