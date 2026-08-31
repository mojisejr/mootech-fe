// features/v2-service/components/compat-quota-copy.ts — the ดวงสมพงษ์ refusal, built from the wire.
//
// 🔴 WHY THIS IS A FUNCTION AND NOT A STRING (#557). The line it replaces was a constant that named the
// period by hand: first "สำหรับปีนี้", then "สำหรับเดือนนี้". Both were true when typed and neither could
// go red on its own — the first one even carried a comment citing a verified BE fact, and that fact
// expired when #358 Phase 6 moved this lane to a calendar month. A hand-typed period is a SECOND
// definition of the window, and it is the copy of the two that nothing tests.
//
// So the period is gone and a DATE takes its place, carried from lib/v2/compat-quota.ts's `resetAt`, which
// lib/usage-core.ts:monthResetAt derives from the same `monthWindow` the counter uses. Move the window and
// the sentence moves with it, because there is nothing left here to forget to change.
//
// PURE (no React, no I/O) so the exact rendered strings can be asserted, not a fragment of them.
import { formatThaiDateAbbr } from '@/lib/v2/thai-date'

/** Line 1 is the same in both branches: WHAT happened. It never mentions time. */
export const COMPAT_QUOTA_BLOCKED_HEADLINE = 'ใช้สิทธิ์ดูดวงสมพงศ์ครบแล้ว'

/** The guidance shown when we do not know the reset day. Says nothing about time, on purpose. */
export const COMPAT_QUOTA_BLOCKED_FALLBACK = 'ดูผลที่เคยคำนวณไว้ได้ที่ "ดูดวงสมพงศ์ล่าสุด" ด้านล่าง'

/**
 * The two lines of the quota refusal.
 *
 * `resetAt` present and real → line 2 says the day the allowance is back. That is the whole point of the
 * ticket: a PLUS member who runs out on the 5th is 25 days from more, and the screen used to send them
 * away as if the year were over.
 *
 * `resetAt` absent or malformed → line 2 falls back to the history pointer and says NOTHING about time.
 * ❌ It must not fall back to a period word. "เดือนนี้" with no date behind it is exactly the un-testable
 * claim this file exists to delete, and an unavailable quota read is precisely when we know least.
 */
export function compatQuotaBlockedLines(resetAt?: string): [string, string] {
  const day = formatThaiDateAbbr(resetAt ?? '')
  return [COMPAT_QUOTA_BLOCKED_HEADLINE, day ? `ได้สิทธิ์คืนวันที่ ${day}` : COMPAT_QUOTA_BLOCKED_FALLBACK]
}
