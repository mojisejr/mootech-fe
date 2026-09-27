// GET /api/chinese-horoscope — the signed-in member's chart, live from the bazi engine
// (mumate-be-retirement-001 slice 1, plan rev 0.4 option C1).
//
// Until slice 1 this route proxied mootech-be's STORED chart (`log_calculate.result` by result_code) and
// overlaid engine reading text on it for v1 /my-destiny. v2 reads only the year animal, the day stem's
// element + yin/yang, the element_cycle row and the birth, so the route now derives exactly those from
// the engine's public-calc on the member's CURRENT birth (lib/chart/engine-chart-server.ts). No backend
// call, no stored chart. The response keeps the envelope and the legacy paths v2 consumes:
//   { data: { dob, time, gender, detail: { yearBelow, dayAbove }, summary, yearOfZodiac, elementCycle } }
// so toComputeSource (home, first-run) and cycleFromChart (first-run) read it unchanged.
//
// Identity: from the session (resolveSessionUserId, the read rule the calendar uses), never from the
// query. The `userId` / `code` query parameters the old wrapper sends are ignored. v1 /my-destiny, which
// needs the full legacy chart, no longer gets it; v1 is retired by slice 2 (plan R1).
//
// Answers: 200 { data } · 200 { data: null } (no birth yet — BE's own "no chart" answer) ·
// 401/404/409 (identity, incl. session ≠ member cookie) · 502 (engine unreachable: home falls back to the default mascot, first-run to
// "unavailable", exactly as when BE was down).
import type { NextApiRequest, NextApiResponse } from 'next'
import { memberCookieMismatch, resolveSessionUserId } from '@/lib/v2/resolve-user'
import { computeMemberChart } from '@/lib/chart/engine-chart-server'
import { EngineChartError } from '@/lib/chart/engine-chart'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  let who
  try {
    who = await resolveSessionUserId(req, res)
  } catch {
    return res.status(500).json({ error: 'identity lookup failed' })
  }
  if (!who.ok) return res.status(who.status).json({ error: who.error })
  // Two accounts at once (stale MEMBER_ID cookie): the screen shows the cookie's member, so a chart for
  // the session's member would be someone else's mascot. Refuse; the screen falls back to the default.
  if (memberCookieMismatch(req, who.userId)) return res.status(409).json({ error: 'session and member cookie disagree' })

  try {
    const r = await computeMemberChart(who.userId)
    if (!r.ok) {
      if (r.reason === 'no-user') return res.status(404).json({ error: 'no account' })
      return res.status(200).json({ data: null })
    }
    return res.status(200).json({ data: r.chart })
  } catch (e) {
    if (e instanceof EngineChartError) {
      console.error('[chinese-horoscope] engine', e.message)
      return res.status(502).json({ error: 'chart engine unreachable' })
    }
    console.error('[chinese-horoscope] failed', e instanceof Error ? e.message : 'unknown error')
    return res.status(500).json({ error: 'chart failed' })
  }
}
