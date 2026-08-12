// Usage-limit DB layer + per-endpoint wrappers (Phase 2, #mootech-fullstack-supabase-fold).
// Imports the live db; the PURE decision logic lives in ./usage-core (unit-tested DB-free).
// Each wrapper reproduces exactly one NestJS `isCheckUsage` variant. The count-based wrappers
// take the already-computed count as input, because each endpoint counts a different log table
// (member_with_friend / fortune_telling_log / heavenly_spirit_card_log) — use dayWindow/monthWindow
// from usage-core to build that count's BETWEEN range where the NestJS variant used one.
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberPayment } from '@/lib/db/schema'
import {
  AI_MSG,
  classifyMembership,
  evaluateUsage,
  type MembershipReason,
  type UsageResult,
} from './usage-core'

export * from './usage-core'

// Mirror NestJS MemberPaymentService.getMemberPayment: findOne by user_id (user_id is the PK of
// member_payment, so this is a single deterministic row) -> classify free/member + reason.
export async function resolveMembership(
  userId: string,
  now: Date = new Date(),
): Promise<{ isFree: boolean; reason: MembershipReason; memberPayment: typeof memberPayment.$inferSelect | null }> {
  const [mp] = await db
    .select()
    .from(memberPayment)
    .where(eq(memberPayment.userId, userId))
    .limit(1)
  const { isFree, reason } = classifyMembership(mp ?? null, now)
  return { isFree, reason, memberPayment: mp ?? null }
}

// chinese-calendar.isCheckUsage(user_id): membership only, no count; reflects NO_PLAN/EXPIRED.
export async function checkChineseCalendarUsage(userId: string, now?: Date): Promise<UsageResult> {
  const m = await resolveMembership(userId, now)
  return evaluateUsage({
    reason: m.reason,
    isFree: m.isFree,
    count: 0,
    limitFree: 0,
    limitMember: 0,
    limitMode: 'none',
    reflectMembershipCode: true,
  })
}

// member-with-friend.isCheckUsage(user_id, 20, 20): code stays SUCCESS until limit; members limited;
// no time window (lifetime count of member_with_friend rows); OUT_OF_LIMIT message = _ALL variant.
export async function checkMemberWithFriendUsage(userId: string, count: number, now?: Date): Promise<UsageResult> {
  const m = await resolveMembership(userId, now)
  return evaluateUsage({
    reason: m.reason,
    isFree: m.isFree,
    count,
    // เพดานเพื่อนชั่วคราวก่อน launch (ฟีมเคาะ 2026-08-13, #262): free 1 → 20
    limitFree: 20,
    limitMember: 20,
    limitMode: 'all',
    reflectMembershipCode: false,
    outOfLimitMessage: AI_MSG.OUT_OF_LIMIT_ALL,
  })
}

// fortune-telling.isCheckUsage(user_id, FORTUNE_LIMIT.FREE=1): only FREE users are limited
// (members never blocked); count window = current month. `count` = monthly fortune_telling_log count.
export async function checkFortuneTellingUsage(userId: string, count: number, now?: Date): Promise<UsageResult> {
  const m = await resolveMembership(userId, now)
  return evaluateUsage({
    reason: m.reason,
    isFree: m.isFree,
    count,
    limitFree: 1,
    limitMember: 1,
    limitMode: 'free-only',
    reflectMembershipCode: false,
  })
}

// heavenly-spirit-card.isCheckUsage(user_id, FORTUNE_LIMIT.FREE=1, FORTUNE_LIMIT.MEMBER=10): members
// limited too; count window = today. `count` = today's heavenly_spirit_card_log count.
export async function checkHeavenlySpiritUsage(userId: string, count: number, now?: Date): Promise<UsageResult> {
  const m = await resolveMembership(userId, now)
  return evaluateUsage({
    reason: m.reason,
    isFree: m.isFree,
    count,
    limitFree: 1,
    limitMember: 10,
    limitMode: 'all',
    reflectMembershipCode: false,
  })
}
