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

export type MembershipReason = 'NO_PLAN' | 'EXPIRED' | 'MEMBER'
export type UsageResult = { code: number; message: string; is_free: boolean }
export type LimitMode = 'none' | 'free-only' | 'all'

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
