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
// subject first (#391), flip after (#293, done 2026-08-23), retire the switch entirely (#358 Phase 4).
// The same session id also keys the server-side fortune cache below — one identity in this file, not two.
import type { NextApiRequest, NextApiResponse } from 'next'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'
import { resolveSubscription } from '@/lib/v2/subscription'
import { calendarMonthReachable } from '@/lib/v2/entitlement'
import { currentMonthBkk } from '@/lib/v2/clock'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
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
    // Not signed in / no account yet / ambiguous identity → the same 200 + allowed:false the old `!userId`
    // branch gave. Fail closed, never a 4xx the UI must learn.
    // #530: `reason` names WHICH refusal this is. The sibling exit further down is 'out-of-span', and the
    // screen's answer to the two is opposite — sign in again vs buy a bigger package.
    return res.status(200).json({ allowed: false, reason: 'no-identity', year: parsed.year, month: parsed.month, days: [] })
  }
  const userId = who.userId

  // ── MEMBERSHIP, then THE SPAN. No switch stands in front of either (#358 Phase 4) ─────────────────
  //
  // 🔴 THE SWITCH THAT USED TO BE HERE, and why its history outlived its file. `CALENDAR_MONTH_GATE_OPEN`
  // (lib/v2-calendar/gate.ts, deleted by Phase 4) wrapped everything from here down to the span refusal.
  // It shipped `false`, so this code is byte-for-byte the path that was already running; retiring it
  // removes a branch that could not be taken, not a behaviour.
  //
  // Three things about it are worth carrying, because each one cost us something:
  //   1. It was opened 2026-08-05 (PR #177, Track B-4) as a DELIBERATE temporary debt, announced in the PR
  //      title, the PR body, three lines of comment and the variable's own name — and it still sat wrong
  //      for 18 days, because that PR closed no issue and nothing carried the debt. Announcing a debt is
  //      not the same as someone holding it. It surfaced only when ตู๋ checked a citation on an unrelated
  //      ticket (#293, closed 2026-08-23).
  //   2. It silently grew a SECOND job. Written to gate one thing (may a non-member see a personalised
  //      month), it later enclosed the entitlement span check added by Phase 3, so `true` would have meant
  //      "nobody's package limit is enforced on this route at all". Nobody decided that; the scope changed
  //      because a later ticket wrote inside its braces.
  //   3. Reopening it would be a PRICING decision, not a technical one. There is now no switch to flip:
  //      what a level may reach is answered in one place, lib/v2/entitlement.ts, per tier.
  //
  // The subject below is the SESSION's user (#391), which is why closing the gate could never be turned
  // into a way to be someone else.
  // The membership verdict is read ONCE and used by both gates below — hoisted here by Phase 3 because the
  // span gate needs it too.
  let verdict: { isPaid: boolean | null; tier: string | null } = { isPaid: false, tier: null }
  try {
    const v = await resolveSubscription(userId)
    verdict = { isPaid: v.isPaid, tier: v.tier }
  } catch {
    verdict = { isPaid: false, tier: null } // cannot confirm membership → treat as free (fail-closed)
  }

  // 🔴 #358 Phase 2 — ONE resolver for both calendar gates. This used to call `resolveMembership`
  // (lib/usage.ts:27), which reads member_payment and nothing else, while pages/api/v2/day-detail.ts:82 has always
  // called `resolveSubscription` (lib/v2/subscription.ts:220), which reads member_subscription first and
  // only then falls back to that same member_payment read. Two gates on ONE feature, two stores.
  //
  // 🔴 THE DISAGREEMENT RUNS BOTH WAYS. `resolveSubscription` is a superset over the STORES it reads but
  // NOT over the VERDICTS: `isFree` is a boolean while `isPaid` is boolean | null.
  // Measured through both real handlers, and photographed on the real screen:
  //
  //   live v2 row, no valid member_payment row     before: month FREE, day PAID   after: both PAID
  //   valid member_payment PLUS a live v2 row
  //   whose tier_code cannot be mapped             before: month PAID, day FREE   after: both REFUSE
  //   valid member_payment PLUS a live FREE row    before: month PAID, day FREE   after: both PAID
  //
  // Row 2 LOSES this calendar; it fails closed on purpose (an unmappable code means we know nothing).
  // Two earlier drafts of this comment said "the user sees nothing change"; both were false, and neither
  // was caught by re-reading.
  //
  // ⚠️ ROW 3 SAYS `after: both PAID`, AND THAT IS THE THIRD CORRECTION TO THIS BLOCK. It read
  // `both REFUSE` until mojisejr/mootech-fe#525 shipped (20c0b09): a live KNOWN-not-paid row no longer
  // answers alone — it falls through to the legacy verdict, because refusing a member who has paid was
  // the defect. The sentence one line up that used to say "the legacy branch is never consulted" is gone
  // for the same reason; it is still true for an UNMAPPABLE code and no longer true for `FREE`.
  // 🔑 #525's own diff could not show this line becoming false. Nothing points from lib/v2/subscription.ts
  // to this file; it was found by grepping the CLASS of claim afterwards, which is the only thing that
  // has ever caught this family.
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
  //          sell it. scripts/payment-catalog.test.ts:30 pins this with an isActive:true row, and the pin
  //          has teeth. lib/payment/repo.ts:729 is the ONLY insert outside tests.
  //          ⇒ the row can arrive by hand or by ops, not by anyone buying anything.
  //          ⚠️ ? unknown whether prod holds any member_subscription row with tier_code = 'FREE'.
  //
  // Row 3 is NOT introduced here: pages/api/v2/day-detail.ts:82 has always used this resolver, so that user is already
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
  // pages/api/v2/day-detail.ts:82 uses, so the two gates now agree about the undetermined case too.
  //
  // 🔴 #358 Phase 3 — THE PAID-ONLY REFUSAL IS GONE FROM HERE, and that is the point of the phase, not a
  // side effect. It read `if (verdict.isPaid !== true) return allowed:false`, so a non-paying visitor got
  // no month at all. The shop card has always sold FREE a personalised month of its own
  // (features/v2-shop/packages.ts), so the route and the price list disagreed and the route won.
  // ⚠️ That bullet's WORDING changed after this comment was written — it now reads "เดือนปัจจุบัน
  // (ดูสรุปรายวัน)", because the old "(1 เดือน)" sounded like a full month's reading while a free day is
  // trimmed at pages/api/v2/day-detail.ts. Quoted loosely here on purpose: a comment that copies a string
  // verbatim goes stale the next time that string is edited, and this one already did.
  // ฟีมเคาะ 2026-08-29 ทาง A: honour the card. The SPAN below is now the only gate, and for FREE it
  // admits exactly the current month — which is the same refusal for every other month, reached by the
  // rule that was sold rather than by a boolean.
  // ⚠️ THE COST IS REAL AND WAS ACCEPTED, not overlooked: every non-paying visitor may now trigger one
  // upstream bazi call per month, and a first view of a new month costs about 6.8s (lines 10-11 above).
  // An UNDETERMINED verdict (isPaid null) spends FREE, so a membership-lookup error now serves the
  // current month instead of nothing — the same reading pages/api/v2/day-detail.ts uses for that state.
  //
  // ── THE SPAN. How far this level may scroll ─────────────────────────────────────────────────────
  //
  // 🔴 UNCONDITIONAL, and that is the entire product of Phase 4. While the switch existed this check sat
  // inside it, so one flag answered two unrelated questions — "is this feature paid-only right now" and
  // "what did the package sell" — and flipping the first silently disabled the second. Phase 3 wrote the
  // coupling down rather than paper over it; Phase 4 removes the thing that coupled them.
  // scripts/calendar-month-span-unconditional.test.tsx holds the result: reintroduce ANY flag in front of
  // this comparison and it goes red.
  //
  // 🔴 The comparison itself is NOT restated here — lib/v2/entitlement.ts calendarMonthReachable is the
  // one copy, and pages/api/v2/day-detail.ts calls the same function with the same arguments. Phase 2's
  // lesson applied one level up: two routes asking one question, never two.
  //
  // Refusal shape is ADDITIVE to the existing one (200 + allowed:false + empty days) — a screen that
  // reads neither field behaves exactly as before — and no upstream fortune call is paid for a month we
  // are not going to return.
  //
  // 🔴 #530 — `reason` is the whole point of this branch existing separately. The refusal at :59 says
  // "we do not know who you are"; this one says "your package stops here". They used to answer a
  // byte-identical object, so the screen could not tell an expired session from a sales moment, and the
  // arrow ฟีม described pressing comes from THIS route. ฟีมเคาะ 2026-08-24: that press should INVITE AN
  // UPGRADE, and nothing indistinguishable from "please sign in again" can invite anything.
  //
  // ⚠️ The two literals below are the ONLY two `allowed: false` exits in this file — checked, not
  // assumed. Verify by running, from the repo root:
  //     grep -cE '^ *(return .*)?allowed: false' pages/api/v2/calendar-month.ts     → 2
  // and read both. If a third refusal is ever added it MUST name itself, or this field silently goes
  // back to being unable to tell the two apart.
  //
  // 🔑 NO LINE NUMBERS, AND THE PATTERN IS ANCHORED AT `return`. Four versions of this one sentence were
  // wrong before this one, each in a way the previous fix created:
  //   1. named :59 — ตู๋ measured the exits at :61 and :169
  //   2. corrected to :61 and :169 — and writing that two-line correction moved the second exit to :171,
  //      so it was false the moment it was saved. A citation above the lines it cites moves them by
  //      existing.
  //   3. numbers replaced with `grep -c "allowed: false"`, claimed → 2. Measured 4: the prose in THIS
  //      comment matches, so the check counted itself.
  //   4. narrowed to `json({ allowed: false`. Still 4, for the same reason, one clause later.
  //   5. anchored at `^ *return`, which fixed the self-counting — but saw ONLY the one-line form. ตู๋
  //      pointed at the multi-line `return res.status(200).json({` further down THIS file (the allowed
  //      exit) as the shape it would miss. Measured by rewriting one refusal into that form: the old
  //      pattern found 1 of 2, the current one finds 2 of 2.
  // ⇒ `^ *` plus an OPTIONAL `return` is what keeps it both self-exclusive and shape-agnostic: a comment
  //   line starts with `//`, so it is still never counted, while `allowed: false` on its own line is.
  const wantedMonth = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`
  if (!calendarMonthReachable(verdict, wantedMonth, currentMonthBkk())) {
    return res.status(200).json({ allowed: false, reason: 'out-of-span', year: parsed.year, month: parsed.month, days: [] })
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
