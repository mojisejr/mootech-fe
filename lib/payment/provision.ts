// v2 PROVISIONING (mootech-fe#355, Phase 3) — PURE, no DB. Given a paid quote, computes exactly what to
// write: a NEW member_subscription row (history — never overwrites) and the member_payment SHADOW.
//
// 🔴 The v1 bug this avoids (#354 ②, digest): v1 provisions by `save()` onto member_payment whose PK is
// user_id — a renewal UPDATES the single row and recomputes expire from TODAY, so buying again while still
// subscribed BURNS the remaining days. v2 writes a fresh member_subscription row per purchase, and the
// shadow MERGES (never overwrites).
//
// 🔴 Shadow rules (ฟีมเคาะ, #355) — member_payment's one PK row decides membership for BOTH v1 and v2
// (lib/usage.ts resolveMembership → classifyMembership), and the accounts hit are the TEAM's real ones
// (ฟีม tests real payments before launch), so a wrong shadow demotes a real member:
//   ① plan_code is ALWAYS 'MEMBER'         — else classifyMembership reads free
//   ② expire_at = GREATEST(existing, new)  — never shorten; a longer existing membership is preserved
//   ③ the shadow is ONE-WAY                — v2 never reads member_payment back to decide its own status
//      (that read lives only in lib/v2/subscription.ts's fallback, which is the LEGACY path, not v2's)
import type { Quote, ExpireSpec } from './catalog'

// ── pure civil-date math (no moment; UTC, month/year add clamps to end-of-month like moment) ──────────
function parseYmd(ymd: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) throw new Error(`not a YYYY-MM-DD date: ${JSON.stringify(ymd)}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}
function fmt(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = parseYmd(ymd)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}
export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = parseYmd(ymd)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate() // day 0 of nm+1 = last day of nm
  return fmt(ny, nm, Math.min(d, lastDay)) // clamp (Jan 31 + 1M → Feb 28/29), matches moment
}

// expire_at = (today + buffer_day days) + N units, formatted YYYY-MM-DD. start_at = today + buffer_day days.
// Mirrors v1 member-payment.service.ts exactly (buffer applied first, then the package duration).
export function computeExpireDate(today: string, bufferDay: number, spec: ExpireSpec): string {
  const base = addDays(today, Math.max(0, Math.trunc(bufferDay) || 0))
  switch (spec.unit) {
    case 'D':
      return addDays(base, spec.value)
    case 'M':
      return addMonths(base, spec.value)
    case 'Y':
      return addMonths(base, spec.value * 12)
  }
}

// GREATEST for ISO 'YYYY-MM-DD' strings is a plain lexicographic max (zero-padded ⇒ string order = date
// order). null/blank existing ⇒ the new date.
export function laterDate(existing: string | null | undefined, next: string): string {
  const e = (existing ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(e) && e > next ? e : next
}

export type SubscriptionWrite = {
  userId: string
  tierCode: string
  packageCode: string
  amountSatang: number
  startAt: string
  expireAt: string
  paymentId: string
  status: 'ACTIVE'
}
export type ShadowWrite = {
  userId: string
  planCode: 'MEMBER' // rule ①
  packageCode: string
  startAt: string
  expireAt: string // rule ②: GREATEST(existing, new)
}

// Build the two writes for a successful payment. `existingMemberPayment` is the caller's current
// member_payment row (or null) — only its expireAt matters, for the GREATEST merge.
//
// 🔴 #456 — `carryOverDays` is the days the buyer had LEFT on what they already held, and they are added on
// top of the package's own span. This is ทาง C (ฟีมเคาะ 2026-08-26): full price, no proration, but not one
// paid day is lost. It defaults to 0 so every existing caller and every FIRST purchase behaves exactly as
// before — the DoD requires a first purchase to be unchanged "แม้แต่วันเดียว".
//
// 🔴 It is added to the SUBSCRIPTION row, and the shadow merge then sees the carried span too. That
// direction matters: lib/v2/subscription.ts picks a live v2 row OVER the legacy member_payment date, so a
// v2 row written WITHOUT the carry-over would win against — and therefore silently shorten — a longer
// legacy membership. Carrying first and merging second means neither store can shorten the other.
export function buildProvision(args: {
  userId: string
  quote: Quote
  paymentId: string
  today: string
  existingMemberPayment: { expireAt?: string | null } | null
  carryOverDays?: number
}): { subscription: SubscriptionWrite; shadow: ShadowWrite } {
  const { userId, quote, paymentId, today, existingMemberPayment } = args
  // Never negative (that would SHORTEN the purchase) and never fractional — days are whole things here.
  const carryOverDays = Math.max(0, Math.trunc(args.carryOverDays ?? 0) || 0)
  const startAt = addDays(today, Math.max(0, Math.trunc(quote.bufferDay) || 0))
  const newExpire = addDays(computeExpireDate(today, quote.bufferDay, quote.expire), carryOverDays)

  return {
    subscription: {
      userId,
      tierCode: quote.tierCode,
      packageCode: quote.packageCode,
      amountSatang: quote.amountSatang,
      startAt,
      expireAt: newExpire, // the subscription row records THIS purchase's own span (not merged)
      paymentId,
      status: 'ACTIVE',
    },
    shadow: {
      userId,
      planCode: 'MEMBER',
      packageCode: quote.packageCode,
      startAt,
      expireAt: laterDate(existingMemberPayment?.expireAt, newExpire), // rule ②
    },
  }
}
