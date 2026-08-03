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
import type { NextApiRequest, NextApiResponse } from 'next'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'
import { resolveMembership } from '@/lib/usage'
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
  const { person, month, userId } = (req.body ?? {}) as { person?: FeCalcInput; month?: string; userId?: string }

  const parsed = parseMonth(month)
  if (!parsed) return res.status(400).json({ error: 'Invalid month; expected "YYYY-MM".' })
  if (!person) return res.status(400).json({ error: 'person (birth data) is required.' })
  if (!userId) return res.status(200).json({ allowed: false, year: parsed.year, month: parsed.month, days: [] })

  // ── PAID GATE (server-side): free/expired → no bazi call at all. ──
  let isFree = true
  try {
    ;({ isFree } = await resolveMembership(userId))
  } catch {
    isFree = true // can't confirm membership → treat as free (fail-closed: don't spend the paid engine)
  }
  if (isFree) return res.status(200).json({ allowed: false, year: parsed.year, month: parsed.month, days: [] })

  // ── PAID: fortune + วันพระ in PARALLEL (total ≈ max, not sum). Graceful on any miss. ──
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
  try {
    const { rawInput } = toBaziInput(person) // the true determinant of the fortune → also the cache key

    // ── cache keyed on (user, birth-signature, month): a user's month fortune is deterministic in the
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
