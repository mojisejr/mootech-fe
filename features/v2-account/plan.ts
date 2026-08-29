// features/v2-account/plan.ts — PURE. What the status card on จอ "สิทธิ์ของฉัน" says (#365).
//
// Extracted from the screen for the same reason features/v2-shop/result-state.ts was: the branch that
// decides WORDS must be exercisable without mounting a page. Importing it from the component pulled
// useV2User → next/config into the test env, which is a router-shaped dependency on a rule that has no
// business knowing about routers.
import { formatThaiDateAbbr } from '@/lib/v2/thai-date'

/** What the status card says, derived ONCE so the JSX below has no branching left to get wrong. */
export type Plan = { heading: string; sub: string; level: string | null; isFree: boolean }

// 🔴 The three inputs are deliberately kept apart: `isPaid` decides paid-ness, `tier` names it, `expireAt`
// dates it — and each can be null independently. Collapsing them into one "status" string is how a legacy
// member (paid, unnamed, no v2 date) ends up rendered as Free.
export function planFor(m: { isPaid?: boolean | null; tier?: string | null; expireAt?: string | null }): Plan {
  const paid = m.isPaid === true
  if (!paid) {
    // KNOWN not-paid. ❌ Never "หมดอายุ" — a free account never had a plan to expire.
    return { heading: 'Mumate Free', sub: 'ยังไม่ได้เป็นสมาชิก', level: null, isFree: true }
  }
  // Paid. The NAME may still be unknown — ⚠️ no longer because they are legacy: since #358 Phase 1 a valid legacy member arrives already named 'PRO' (lib/v2/subscription.ts:26), so this
  // branch is now a paid viewer whose name did not reach us. Unknown must not undo "this person paid", and the word FREE must never reach a paying member's screen.
  const named = m.tier && m.tier !== 'FREE' ? m.tier : null
  const heading = named === 'PRO' ? 'Mumate Pro' : named === 'PLUS' ? 'Mumate +' : 'สมาชิก'
  const dateText = m.expireAt ? formatThaiDateAbbr(m.expireAt) : ''
  return {
    heading,
    // No date to show ⇒ say nothing about dates rather than invent or imply one.
    // ⚠️ This is NOT "the legacy path" any more. Since #358 Phase 1 a VALID legacy member carries their
    // member_payment.expire_at through this same field (lib/v2/subscription.ts:26 names them; the legacy
    // arm of resolveMembershipFromRows attaches the date), so they land on the "ใช้ได้ถึง …" branch. What
    // reaches this branch now is a paid viewer whose expiry did not reach us at all.
    sub: dateText ? `ใช้ได้ถึง ${dateText}` : 'สมาชิกปัจจุบัน',
    level: named ?? 'สมาชิก',
    isFree: false,
  }
}
