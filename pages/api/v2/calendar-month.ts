// BFF — v2 ปฏิทินดวง PAID month grid. Browser → this route (same-origin) → bazi man-vs-day (personalised
// per-day fortune) + almanac (วันพระ), in PARALLEL. WHY a proxy (same as home-fortune): BAZI_BASE_URL is
// a SERVER env, birth data must not leave to a 3rd origin, no browser→bazi CORS.
//
// SCOPE (ฟีม 2026-08-03): personalised month fortune is PAID only. resolveMembership gates server-side —
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
// back. It did not fire only because CALENDAR_MONTH_GATE_OPEN is true and the gate is skipped entirely —
// safe by a switch, not by design. The switch is scheduled to be flipped (mootech-fe#293), so the day
// someone makes this app SAFER is the day the hole opens. Hence: fix the subject first (#391), flip later.
// The same session id also keys the server-side fortune cache below — one identity in this file, not two.
import type { NextApiRequest, NextApiResponse } from 'next'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'
import { resolveMembership } from '@/lib/usage'
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
  // The switch now lives in lib/v2-calendar/gate.ts so a test can close it; mootech-fe#293 still flips
  // exactly one boolean. The subject below is the SESSION's user, so closing the gate can no longer be
  // turned into a way to be someone else.
  if (!CALENDAR_MONTH_GATE_OPEN) {
    let isFree = true
    try {
      ;({ isFree } = await resolveMembership(userId))
    } catch {
      isFree = true // can't confirm membership → treat as free (fail-closed)
    }
    if (isFree) return res.status(200).json({ allowed: false, year: parsed.year, month: parsed.month, days: [] })
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
