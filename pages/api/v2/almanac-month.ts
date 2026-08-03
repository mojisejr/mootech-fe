// BFF — v2 ปฏิทินดวง วันพระ overlay. UNGATED (free + paid): วันพระ is not personalised and not "expensive
// per-user" — it is the bazi almanac computed from the real Thai lunar calendar, deterministic per month
// and cached across all viewers. This is the SINGLE วันพระ source (ฟีม's answer C = bazi-computed); both
// the free calendar and the paid calendar-month overlay from here, so the two tiers never disagree.
//
// WHY here and not chinese-calendar/month.ts: that route is the legacy Supabase flag source (a DIFFERENT
// dataset). Using it for free + bazi almanac for paid would fork วันพระ into two sources — the drift we
// set out to avoid. We do NOT touch chinese-calendar/month.ts.
import type { NextApiRequest, NextApiResponse } from 'next'
import { almanacWanPhraDays, fetchAlmanacDays, parseMonth } from '@/lib/v2-calendar/month'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const parsed = parseMonth(req.query.month)
  if (!parsed) return res.status(400).json({ error: 'Invalid month; expected "YYYY-MM".' })

  try {
    const almanac = await fetchAlmanacDays(parsed.yearBE, parsed.month)
    return res.status(200).json({ year: parsed.year, month: parsed.month, days: almanacWanPhraDays(almanac) })
  } catch {
    // almanac unreachable → empty overlay (calendar still renders, just no วันพระ rings) — never a 5xx.
    return res.status(200).json({ year: parsed.year, month: parsed.month, days: [], degraded: true })
  }
}
