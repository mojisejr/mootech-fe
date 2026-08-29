// BFF — v2 ปฏิทินดวง PAID month grid. Browser → this route (same-origin) → bazi man-vs-day (personalised
// per-day fortune) + almanac (วันพระ), in PARALLEL. WHY a proxy (same as home-fortune): BAZI_BASE_URL is
// a SERVER env, birth data must not leave to a 3rd origin, no browser→bazi CORS.
//
// SCOPE (ฟีม 2026-08-03): personalised month fortune is PAID only. resolveSubscription gates server-side —
// free/expired → { allowed:false, days:[] } with NO upstream call (defence-in-depth; the UI shell also
// hides it). วันพระ is served to BOTH tiers from the SAME almanac source (see lib/v2-calendar/month.ts and
// the ungated almanac-month route) — one source, no drift. We do NOT touch chinese-calendar/month.ts.
//
// PERF (μุน asks): cache per (user, month) so paging months back/forth never re-pays the 6.8s cold
// fortune; the almanac half is cached per month across all users. First view of a new month is ~6.8s
// (upstream man-vs-day) — flagged to product; not blocking this phase.
//
// 🔴 IDENTITY (#391) — user_id is derived from the signed session and is NOT read from the body.
// It used to be, and it was the SUBJECT OF THE MEMBERSHIP GATE, so the sender got to nominate whose
// membership was checked: send a paying member's id with your own birth data and the paid month comes
// back. It never fired only because the gate switch stood open and the whole branch was skipped — safe by
// a switch, not by design, with that switch already scheduled to be flipped. Hence the order: fix the
// subject first (#391), flip after (#293, done 2026-08-23 — the gate below is CLOSED now).
// The same session id also keys the server-side fortune cache below — one identity in this file, not two.
import type { NextApiRequest, NextApiResponse } from 'next'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'
import { resolveSubscription } from '@/lib/v2/subscription'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { CALENDAR_MONTH_GATE_OPEN } from '@/lib/v2-calendar/gate'
import {
  BAZI_TIMEOUT_MS,
  fetchAlmanacDays,
  fetchFortuneDays,
  fortuneCacheGet,
  fortuneCacheKey,
  fortuneCacheSet,
  mergeCalendarMonth,
  parseMonth,
  type AlmanacDay,
} from '@/lib/v2-calendar/month'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  // `userId` is deliberately NOT destructured: this route no longer has any notion of who the SENDER
  // says they are. A field that is never read cannot be trusted by accident later.
  const { person, month } = (req.body ?? {}) as { person?: FeCalcInput; month?: string }

  const parsed = parseMonth(month)
  if (!parsed) return res.status(400).json({ error: 'Invalid month; expected "YYYY-MM".' })
  if (!person) return res.status(400).json({ error: 'person (birth data) is required.' })
  // ── IDENTITY ─────────────────────────────────────────────────────────────────────────────────────
  // Ordering note (deliberately NOT the same as pages/api/v2/onboarding.ts, which puts identity first):
  // the refusal below carries `year`/`month` from `parsed`, and the calendar screen reads them — moving
  // identity above the parse would mean changing the response shape μุน's UI consumes. What an
  // unauthenticated caller learns from the order is "was my month string well formed", which is not a
  // secret. Nothing that touches membership, the cache, or the upstream happens before this point.
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) {
    // Not signed in / no account yet / ambiguous identity → exactly the answer the old `!userId` branch
    // gave (200 + allowed:false), so the screen needs no change. Fail closed, never a 4xx the UI must learn.
    return res.status(200).json({ allowed: false, year: parsed.year, month: parsed.month, days: [] })
  }
  const userId = who.userId

  // ── 🔓 MEMBERSHIP GATE — TEMPORARILY OPEN (ฟีม 2026-08-05, Track B-4) ───────────────────────────────
  // The switch lives in lib/v2-calendar/gate.ts and is CLOSED (#293, 2026-08-23), so this branch is the
  // live path now, not a dormant one. The subject below is the SESSION's user (#391), which is why closing
  // the gate could not be turned into a way to be someone else.
  if (!CALENDAR_MONTH_GATE_OPEN) {
    // 🔴 #358 Phase 2 — ONE resolver for both calendar gates. This used to call `resolveMembership`
    // (lib/usage.ts:27), which reads member_payment and nothing else, while day-detail.ts:82 has always
    // called `resolveSubscription` (lib/v2/subscription.ts:220), which reads member_subscription first and
    // only then falls back to that same member_payment read. Two gates on ONE feature, two stores.
    //
    // 🔴 THE DISAGREEMENT RUNS BOTH WAYS. `resolveSubscription` is a superset over the STORES it reads but
    // NOT over the VERDICTS: `isFree` is a boolean, `isPaid` is boolean | null, and a live v2 row is
    // answered from that row ALONE — the legacy branch is never consulted (lib/v2/subscription.ts:211).
    // Measured through both real handlers, and photographed on the real screen:
    //
    //   live v2 row, no valid member_payment row     before: month FREE, day PAID   after: both PAID
    //   valid member_payment PLUS a live v2 row
    //   whose tier_code cannot be mapped             before: month PAID, day FREE   after: both REFUSE
    //   valid member_payment PLUS a live FREE row    before: month PAID, day FREE   after: both REFUSE
    //
    // Rows 2 and 3 LOSE this calendar. Two earlier drafts of this comment said "the user sees nothing
    // change"; both were false, and neither was caught by re-reading.
    //
    // 🔴 REACHABILITY, and this is where the second draft was wrong in a way that mattered:
    //   row 1  UNREACHABLE by purchase. lib/payment/repo.ts:729 inserts the subscription and :743 upserts
    //          the member_payment shadow in ONE transaction, expiry GREATEST at :760.
    //   row 2  UNREACHABLE while 0006 is applied. lib/db/0006_member_subscription.sql:33 CHECKs
    //          tier_code IN ('FREE','PLUS','PRO') and lib/v2/tier.ts:73 maps all three.
    //          ⚠️ ? unknown whether prod carries 0006.
    //   row 3  NOT REACHABLE BY PURCHASE either, and I claimed the opposite before reading the write path.
    //          'FREE' does pass the CHECK, maps cleanly, and is not paid (lib/v2/tier.ts:124) — but
    //          lib/payment/catalog.ts:78-80 throws UnsellablePackageError for a FREE tier BEFORE pricing
    //          and AFTER the isActive check, so activating one of the 6 FREE-tier catalogue rows does not
    //          sell it. scripts/payment-catalog.test.ts:29 pins this with an isActive:true row, and the pin
    //          has teeth. lib/payment/repo.ts:729 is the ONLY insert outside tests.
    //          ⇒ the row can arrive by hand or by ops, not by anyone buying anything.
    //          ⚠️ ? unknown whether prod holds any member_subscription row with tier_code = 'FREE'.
    //
    // Row 3 is NOT introduced here: day-detail.ts:82 has always used this resolver, so that user is already
    // refused day details on main. This route joining it turns half-broken into fully broken.
    //
    // 🔑 Worth keeping: the reachability of row 3 was asserted four times in this branch and was wrong
    // three of them. What settled it was grepping for the WRITE path, which took one command and which
    // nobody ran until the third round of review.
    // Owned by mojisejr/mootech-fe#525, pinned by ⑥ in scripts/calendar-gates-one-source.test.tsx.
    //
    // Done before Phase 3's three-level span ceiling on purpose: put a ceiling on top of two disagreeing
    // sources and a failure cannot be attributed to either.
    //
    // `isPaid === true` and not `!isFree`: only a literal true unlocks — the same fail-closed reading
    // day-detail.ts:82 uses, so the two gates now agree about the undetermined case too. That agreement is
    // row 2: a deliberate behaviour change, not a side effect.
    let paid = false
    try {
      paid = (await resolveSubscription(userId)).isPaid === true
    } catch {
      paid = false // cannot confirm membership → treat as free (fail-closed)
    }
    if (!paid) return res.status(200).json({ allowed: false, year: parsed.year, month: parsed.month, days: [] })
  }
  // ────────────────────────────────────────────────────────────────────────────────────────────────

  // ── PAID: fortune + วันพระ in PARALLEL (total ≈ max, not sum). Graceful on any miss. ──
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
  try {
    const { rawInput } = toBaziInput(person) // the true determinant of the fortune → also the cache key

    // ── cache keyed on (SESSION user, birth-signature, month): a user's month fortune is deterministic in the
    // birth input → serve instantly on re-view / prefetch; a changed dob yields a different key (no stale).
    const cacheKey = fortuneCacheKey(userId, rawInput, month as string)
    const cached = fortuneCacheGet(cacheKey)
    if (cached) {
      clearTimeout(timer)
      return res.status(200).json({ allowed: true, year: parsed.year, month: parsed.month, days: cached })
    }

    const [fortune, almanac] = await Promise.all([
      fetchFortuneDays(rawInput, month as string, ac.signal),
      fetchAlmanacDays(parsed.yearBE, parsed.month, ac.signal).catch(() => [] as AlmanacDay[]),
    ])
    clearTimeout(timer)
    const days = mergeCalendarMonth(fortune, almanac)
    if (days.length > 0) fortuneCacheSet(cacheKey, days) // only cache a real result
    return res.status(200).json({
      allowed: true,
      year: parsed.year,
      month: parsed.month,
      days,
      ...(days.length === 0 ? { degraded: true } : {}),
    })
  } catch {
    clearTimeout(timer)
    // fortune upstream unreachable/timeout → graceful empty, never 5xx (UI shows its own retry state)
    return res.status(200).json({ allowed: true, year: parsed.year, month: parsed.month, days: [], degraded: true })
  }
}
