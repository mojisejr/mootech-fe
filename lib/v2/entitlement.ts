// v2 ENTITLEMENTS (mootech-fe#358) — PURE. The ONE table that answers "this tier gets how much".
//
// 🔴 WHY A SEPARATE FILE AND NOT A CHANGE TO lib/usage-core.ts. v1 runs on those constants and mirrors
// mootech-be's own ceilings (usage-core.ts:30-35 says so itself: change one and the indicator lies).
// Editing FREE_MATCHING_LIMIT from 100 to 2 would make v1 tell a user "เหลือ 2" while BE still allows 100.
// So v2 gets its own table here; v1's numbers are never touched. Merging the two is #247's job, at launch.
//
// 🔴 THE NUMBERS ARE NOT INVENTED. They are what the shop screen already sells, and that file is the one
// the live /v2/shop reads: features/v2-shop/packages.ts:60-96
//     ดวงสมพงษ์ การงาน+ความรัก   Free 2 match   ·  Mumate + 20 match  ·  Pro ไม่จำกัด
//     ปฏิทินดวงเฉพาะบุคคล        Free 1 เดือน   ·  Mumate + 1 ปีเต็ม   ·  Pro ไม่จำกัด
//
// 🔴 TWO SHAPES, NOT ONE — this is the whole reason the ticket exists.
//     COUNT   ดวงสมพงษ์  "how many times this month"        → resets when the month rolls
//     SPAN    ปฏิทินดวง  "how far can you scroll from now"  → nothing to count, nothing to reset
//   A gate that only knows how to count cannot express the calendar at all. Anyone comparing NUMBERS
//   between design and code would tick the calendar off as done, because there is no number to compare.
//
// 🔴 RESET IS NOT A JOB. ฟีมเคาะ 2026-08-24: monthly, no carry-over. We never store "remaining" anywhere —
// the count is a live COUNT(*) over a month window (lib/usage-core.ts:145 monthWindow, Asia/Bangkok), so
// the roll-over happens because the WHERE clause moved. No cron, no reset table, nothing to fail.

/** The three levels member_subscription.tier_code is allowed to hold (0006 CHECK constraint). */
export type Tier = 'FREE' | 'PLUS' | 'PRO'

/** Features this table governs. Deliberately NOT the four on the shop card — เชี่ยวมู chat and เซียมซี have
 *  no route calling their counters yet (lib/usage.ts:73 and :88 are dead code today), so a ceiling for them
 *  would be a promise about a door that does not exist. They ride with #356. */
export type CountFeature = 'compatibility'
export type SpanFeature = 'calendar'

/** null = unlimited. Never 0 — 0 would read as "blocked", and blocked is not what any tier here means. */
export type Unlimited = null

// ── the table ────────────────────────────────────────────────────────────────────────────────────────
// 🔑 DoD (ตู๋ ④): adding a feature must touch THIS FILE ONLY. If a second file has to change, the seam
// failed and the ticket did not do its job. Keep every new entitlement inside these two maps.

/** Times per CALENDAR MONTH (Asia/Bangkok). */
const COUNT_PER_MONTH: Record<CountFeature, Record<Tier, number | Unlimited>> = {
  compatibility: { FREE: 2, PLUS: 20, PRO: null },
}

/**
 * How many months are reachable, counting the current month as 1.
 * Symmetric: you can look back as far as you can look forward (ฟีมเคาะ 2026-08-24, ทาง A).
 *   FREE 1  → only this month
 *   PLUS 12 → this month ±11  (Aug reaches next Jul, and Aug reaches last Sep)
 *   PRO     → no wall
 */
const SPAN_MONTHS: Record<SpanFeature, Record<Tier, number | Unlimited>> = {
  calendar: { FREE: 1, PLUS: 12, PRO: null },
}

// ── readers ──────────────────────────────────────────────────────────────────────────────────────────

/** Monthly ceiling for a counted feature. null = unlimited. */
export function monthlyQuotaFor(tier: Tier, feature: CountFeature): number | Unlimited {
  return COUNT_PER_MONTH[feature][tier]
}

/** Reachable span in months (current month counts as 1). null = unlimited. */
export function spanMonthsFor(tier: Tier, feature: SpanFeature): number | Unlimited {
  return SPAN_MONTHS[feature][tier]
}

/** Whole months between two 'YYYY-MM' strings (b − a). Negative when b is earlier. */
export function monthDistance(a: string, b: string): number {
  const parse = (ym: string): [number, number] => {
    const m = /^(\d{4})-(\d{2})$/.exec(ym)
    if (!m) throw new Error(`not a YYYY-MM month: ${JSON.stringify(ym)}`)
    return [Number(m[1]), Number(m[2])]
  }
  const [ay, am] = parse(a)
  const [by, bm] = parse(b)
  return (by * 12 + (bm - 1)) - (ay * 12 + (am - 1))
}

/**
 * May this tier open `requestedMonth` when "now" is `currentMonth`? Both 'YYYY-MM'.
 *
 * 🔴 This is the SERVER's answer, not the screen's. #391/#293 taught us the same lesson twice: hiding a
 * month in the UI is layout, and layout is not a gate — curl reads it anyway. Every calendar route must
 * ask this before it returns days.
 */
export function isMonthReachable(tier: Tier, feature: SpanFeature, requestedMonth: string, currentMonth: string): boolean {
  const span = spanMonthsFor(tier, feature)
  if (span === null) return true
  return Math.abs(monthDistance(currentMonth, requestedMonth)) <= span - 1
}


// ── #358 Phase 3 — the ONE call both calendar routes make ────────────────────────────────────────────
//
// 🔴 WHY A COMBINED FUNCTION AND NOT TWO STEPS AT EACH ROUTE. Phase 2 existed because the month gate and
// the day gate answered "is this person paid" from two different places. Handing each route a `tier` and
// letting it call isMonthReachable itself would rebuild that seam one level up: two call sites, two
// chances to pass a different feature, a different "today", or a different tier mapping. One function, one
// copy of the rule, and the two routes cannot disagree even if someone edits only one of them.
import { parseTierCode, type TierCode } from './tier'

/** What the resolvers actually return (lib/v2/subscription.ts resolveSubscription). */
export type MembershipVerdictLike = { isPaid: boolean | null; tier: TierCode | string | null }

/**
 * The level a verdict spends. The only place this mapping exists.
 *
 * 🔴 `isPaid: true` with `tier: null` spends PRO, and that is a DECISION rather than a fallthrough.
 * Since Phase 1 a valid legacy member is NAMED 'PRO' (lib/v2/subscription.ts:26), so paid-with-no-name
 * should be unreachable through the resolvers. If it happens anyway the two errors are not symmetric:
 * reading it as FREE takes the calendar from somebody we KNOW paid — the exact damage
 * mojisejr/mootech-fe#525 is open about — while reading it as PRO gives a broken row more than it bought.
 * #352's closing criterion is that legacy members must not lose access, so this errs where that points.
 * ⚠️ One line, one file, no call site to chase if ฟีม wants the other reading.
 *
 * `isPaid` false OR null both spend FREE. null means NOT DETERMINED and must never unlock, which is the
 * same fail-closed reading pages/api/v2/day-detail.ts:82 has always used.
 */
export function entitlementTierOf(verdict: MembershipVerdictLike): Tier {
  if (verdict.isPaid !== true) return 'FREE'
  if (verdict.tier === null || verdict.tier === undefined) return 'PRO' // decision — see above
  return parseTierCode(verdict.tier) ?? 'PRO' // an unmappable NAME must not cost a known-paid member access
}

/**
 * May this person open this month? BOTH calendar routes call exactly this and neither restates any part
 * of it. 'YYYY-MM' both sides.
 *
 * 🔴 This is the SERVER's answer. The screen hiding an arrow is layout, and layout is not a gate — #226
 * closed a bug where the paid sections were trimmed only by the UI and curl read them anyway.
 */
export function calendarMonthReachable(verdict: MembershipVerdictLike, requestedMonth: string, currentMonth: string): boolean {
  return isMonthReachable(entitlementTierOf(verdict), 'calendar', requestedMonth, currentMonth)
}
