// Shared usage-limit / membership decision logic (Phase 2, #mootech-fullstack-supabase-fold).
// PURE functions only — NO db import — so they unit-test without a DB connection.
// Faithful port of the NestJS `isCheckUsage` family (chinese-calendar, member-with-friend,
// fortune-telling, heavenly-spirit-card). Those four variants diverge in: whether the code
// reflects membership (NO_PLAN/EXPIRED) or stays SUCCESS, the count window (none/month/day),
// whether the limit applies to paid members, and the OUT_OF_LIMIT message. This module
// captures the shared core; `lib/usage.ts` adds the DB read + per-endpoint wrappers.

// NestJS src/constants/ai-code-response.ts
export const AI_CODE = { SUCCESS: 200, EXPIRED: 402, NO_PLAN: 403, OUT_OF_LIMIT: 404 } as const
export const AI_MSG = {
  SUCCESS: 'SUCCESS',
  EXPIRED: 'หมดอายุ',
  NO_PLAN: 'ยังไม่ได้สมัครสมาชิก',
  OUT_OF_LIMIT: 'เกิน Limit ต่อวัน กรุณาลองใหม่อีกครั้งในวันถัดไป หรือ สมัครสมาชิก',
  OUT_OF_LIMIT_ALL: 'เกิน Limit การใช้งาน',
} as const

// NestJS src/constants/payment-plan.ts -> PaymentPlan.MEMBER
export const MEMBER_PLAN = 'MEMBER'

// Free ceiling for "เพิ่มเพื่อน" (member-with-friend). TEMPORARY pre-launch value (ฟีมเคาะ 2026-08-13,
// #262): raised 1 → 20. It lived as THREE hand-synced copies (lib/usage.ts, pages/api/member-with-friend,
// pages/api/user.ts) and a fourth copy on the prod read-path (user.ts, the value the FE add-friend button
// gates on) was missed in round 1. Single source now: all three friend read/enforce sites reference this.
// ⚠️ LAUNCH ROLLBACK: cut the free ceiling back here — one edit, and every friend site follows. The MEMBER
// ceiling (20) is a SEPARATE literal at each site and is NOT this constant (it does not roll back with free).
export const FREE_FRIEND_LIMIT = 20

// Free ceiling for ดูดวงสมพงศ์ (matching), per YEAR. ⚠️ CROSS-REPO DUPLICATE of the BE source of truth
// mootech-be src/constants/matching-limit.ts MATCHING_LIMIT.FREE (100). #264 forbids touching BE, but the
// quota indicator MUST show a number, so FE mirrors it here. If BE's ceiling changes, THIS must change too
// or the indicator will lie ("เหลือ X" while the server refuses). Members are UNLIMITED for matching (BE
// only counts+limits free users), so there is no member constant here.
export const FREE_MATCHING_LIMIT = 100

export type MembershipReason = 'NO_PLAN' | 'EXPIRED' | 'MEMBER'
export type UsageResult = { code: number; message: string; is_free: boolean }
export type LimitMode = 'none' | 'free-only' | 'all'

// Remaining-quota view for the Phase 2 indicator (#264). `unlimited` covers members on a quota BE never
// caps (matching); otherwise remaining is clamped at 0 (never negative — a user over an old ceiling shows
// 0 left, not a negative). used is carried for "used X / Y" style UI.
export type QuotaRemaining =
  | { unlimited: true; used: number }
  | { unlimited: false; limit: number; used: number; remaining: number }

// Pure decision: given membership + how many were used, how many are left. limitMember === null means
// members are not capped for this quota (→ unlimited). Mirrors the BE gate's shape (free vs member limit)
// but reports the REMAINDER instead of a pass/fail code, so the number on screen matches what the server
// would decide with the same count.
export function quotaRemaining(p: {
  isFree: boolean
  used: number
  limitFree: number
  limitMember: number | null
}): QuotaRemaining {
  const limit = p.isFree ? p.limitFree : p.limitMember
  if (limit === null) return { unlimited: true, used: p.used }
  return { unlimited: false, limit, used: p.used, remaining: Math.max(0, limit - p.used) }
}

// Civil 'YYYY-MM-DD' for a Date in Asia/Bangkok (NestJS MomentService is Bangkok-time).
export function bkkDateStr(now: Date = new Date()): string {
  // en-CA renders ISO-like YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// Civil timestamp 'YYYY-MM-DD HH:mm:ss' in Asia/Bangkok — what NestJS MomentService formats and what
// every legacy create_at/createAt column stores as a STRING (#357).
// ⚠️ lib/payment/repo.ts:35 has a private copy of this function. It is deliberately left alone here
// (touching the payment lane is out of #357's scope); if a third caller ever needs it, fold repo.ts
// onto this one rather than adding a copy — the FREE_FRIEND_LIMIT note above is what hand-synced
// copies cost us last time.
export function bkkTimestamp(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '00'
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`
}

// Mirror NestJS isNotExpired: date-only compare, not-expired iff today <= expireDay.
// expire_at is stored as 'YYYY-MM-DD' (member_payment.expire_at). Invalid/empty -> false.
export function isNotExpired(expireAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!expireAt) return false
  const expireStr = String(expireAt).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expireStr)) return false
  const [y, m, d] = expireStr.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return false // not a real calendar date (e.g. 2026-02-31)
  }
  return bkkDateStr(now) <= expireStr
}

// Classify a member_payment row into the shared free/member decision.
// !row OR plan != MEMBER -> free (NO_PLAN); MEMBER but expired -> free (EXPIRED); else paid member.
export function classifyMembership(
  mp: { planCode?: string | null; expireAt?: string | null } | null | undefined,
  now: Date = new Date(),
): { isFree: boolean; reason: MembershipReason } {
  if (!mp || mp.planCode !== MEMBER_PLAN) return { isFree: true, reason: 'NO_PLAN' }
  if (!isNotExpired(mp.expireAt, now)) return { isFree: true, reason: 'EXPIRED' }
  return { isFree: false, reason: 'MEMBER' }
}

// The full usage decision. `reflectMembershipCode` reproduces chinese-calendar (which surfaces
// NO_PLAN/EXPIRED); the other three NestJS variants leave those commented out so code stays
// SUCCESS until a limit trips. `limitMode`: 'none' = no count check (chinese-calendar);
// 'free-only' = only free users are limited (fortune-telling); 'all' = members limited too
// (member-with-friend, heavenly-spirit-card).
export function evaluateUsage(p: {
  reason: MembershipReason
  isFree: boolean
  count: number
  limitFree: number
  limitMember: number
  limitMode: LimitMode
  reflectMembershipCode: boolean
  outOfLimitMessage?: string
}): UsageResult {
  let code: number = AI_CODE.SUCCESS
  let message: string = AI_MSG.SUCCESS

  if (p.reflectMembershipCode) {
    if (p.reason === 'NO_PLAN') {
      code = AI_CODE.NO_PLAN
      message = AI_MSG.NO_PLAN
    } else if (p.reason === 'EXPIRED') {
      code = AI_CODE.EXPIRED
      message = AI_MSG.EXPIRED
    }
  }

  if (p.limitMode !== 'none') {
    const limitation = p.isFree ? p.limitFree : p.limitMember
    const considered = p.limitMode === 'all' ? true : p.isFree
    if (considered && p.count >= limitation) {
      code = AI_CODE.OUT_OF_LIMIT
      message = p.outOfLimitMessage ?? AI_MSG.OUT_OF_LIMIT
    }
  }

  return { code, message, is_free: p.isFree }
}

// Count windows as NestJS formats them (moment startOf/endOf), Asia/Bangkok.
export function dayWindow(now: Date = new Date()): { start: string; end: string } {
  const d = bkkDateStr(now)
  return { start: `${d} 00:00:00`, end: `${d} 23:59:59` }
}

export function monthWindow(now: Date = new Date()): { start: string; end: string } {
  const ym = bkkDateStr(now).slice(0, 7) // YYYY-MM
  const [y, m] = ym.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate() // day 0 of next month = last of this
  return { start: `${ym}-01 00:00:00`, end: `${ym}-${String(lastDay).padStart(2, '0')} 23:59:59` }
}

// Calendar-YEAR window, byte-for-byte what BE compares against (#264 trap). Mirrors
// mootech-be src/matching/matching.service.ts:71-84:
//   moment().startOf('year').format('YYYY-MM-DD 00:00:00')  ..  endOf('year').format('...23:59:59')
// in Asia/Bangkok, string-compared via Between() (inclusive both ends). startOf('year') is always Jan 1
// and endOf('year') Dec 31, so only the Bangkok YEAR matters — bkkDateStr gives the Bangkok civil date,
// so its year is correct even for a UTC instant that falls on the other side of the Bangkok year boundary.
export function yearWindow(now: Date = new Date()): { start: string; end: string } {
  const y = bkkDateStr(now).slice(0, 4) // YYYY in Asia/Bangkok
  return { start: `${y}-01-01 00:00:00`, end: `${y}-12-31 23:59:59` }
}
