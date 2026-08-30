// Usage-limit DB layer + per-endpoint wrappers (Phase 2, #mootech-fullstack-supabase-fold).
// Imports the live db; the PURE decision logic lives in ./usage-core (unit-tested DB-free).
// Each wrapper reproduces exactly one NestJS `isCheckUsage` variant. The count-based wrappers
// take the already-computed count as input, because each endpoint counts a different log table
// (member_with_friend / fortune_telling_log / heavenly_spirit_card_log) — use dayWindow/monthWindow
// from usage-core to build that count's BETWEEN range where the NestJS variant used one.
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberPayment, userMatching, memberWithFriend } from '@/lib/db/schema'
import {
  AI_MSG,
  classifyMembership,
  evaluateUsage,
  quotaRemaining,
  yearWindow,
  FREE_FRIEND_LIMIT,
  FREE_MATCHING_LIMIT,
  type MembershipReason,
  type QuotaRemaining,
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
    // เพดานเพื่อนชั่วคราวก่อน launch (#262): free 1 → 20. Single source = FREE_FRIEND_LIMIT (usage-core).
    limitFree: FREE_FRIEND_LIMIT,
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

// matching.isCheckUsage(user_id, MATCHING_LIMIT.FREE=100) — the GATE for ดูดวงสมพงษ์ (#357).
// Faithful to mootech-be src/matching/matching.service.ts:41-92: only FREE users are limited (members
// are never blocked), the membership code is NOT reflected (be leaves NO_PLAN/EXPIRED commented out at
// :52-62, so the code stays SUCCESS until the ceiling trips), the OUT_OF_LIMIT message is the _ALL
// variant (:86), and the count window is the calendar YEAR (:71-84) — yearWindow, never monthWindow.
// `count` = the caller's user_matching rows inside that window; checkMatchingQuota below counts the
// same table with the same window, so the number on screen and the gate cannot disagree.
export async function checkMatchingUsage(userId: string, count: number, now?: Date): Promise<UsageResult> {
  const m = await resolveMembership(userId, now)
  return evaluateUsage({
    reason: m.reason,
    isFree: m.isFree,
    count,
    limitFree: FREE_MATCHING_LIMIT,
    limitMember: FREE_MATCHING_LIMIT,
    limitMode: 'free-only',
    reflectMembershipCode: false,
    outOfLimitMessage: AI_MSG.OUT_OF_LIMIT_ALL,
  })
}

// Count the caller's user_matching rows in the SAME calendar-year window the gate uses. Kept next to
// the gate so the two can never drift onto different windows.
export async function countMatchingInYear(userId: string, now: Date = new Date()): Promise<number> {
  const { start, end } = yearWindow(now)
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userMatching)
    .where(and(eq(userMatching.userId, userId), gte(userMatching.createAt, start), lte(userMatching.createAt, end)))
  return row?.n ?? 0
}

// --- Phase 2 quota indicators (#264): remaining-quota reads for the pre-click indicator ------------
// These report the REMAINDER (not a pass/fail code) using the SAME count windows the server gates on, so
// the number on screen matches what the server would decide. The two quotas count different tables and
// use different windows — matching = user_matching in the current calendar year (BE trap: yearWindow must
// match matching.service.ts exactly); friend = member_with_friend lifetime (BE counts all rows, no window).

// ดูดวงสมพงศ์: free = FREE_MATCHING_LIMIT per year; members are uncapped (BE only limits free) → unlimited.
export async function checkMatchingQuota(userId: string, now: Date = new Date()): Promise<QuotaRemaining> {
  const m = await resolveMembership(userId, now)
  const { start, end } = yearWindow(now)
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userMatching)
    .where(and(eq(userMatching.userId, userId), gte(userMatching.createAt, start), lte(userMatching.createAt, end)))
  return quotaRemaining({ isFree: m.isFree, used: row?.n ?? 0, limitFree: FREE_MATCHING_LIMIT, limitMember: null })
}

// เพิ่มเพื่อน: free and member both capped at FREE_FRIEND_LIMIT (#262); count is the user's lifetime rows.
export async function checkFriendQuota(userId: string, now: Date = new Date()): Promise<QuotaRemaining> {
  const m = await resolveMembership(userId, now)
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memberWithFriend)
    .where(eq(memberWithFriend.userId, userId))
  return quotaRemaining({ isFree: m.isFree, used: row?.n ?? 0, limitFree: FREE_FRIEND_LIMIT, limitMember: FREE_FRIEND_LIMIT })
}
