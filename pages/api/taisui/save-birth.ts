// POST /api/taisui/save-birth — ปีชง 2570 (revision 0.15): a member who has no birth in their profile enters it
// on the page, and it is saved through the register form's own write (lib/chart/save-birth-chart.ts). It never
// writes over a saved birth: that one is changed only in the app's edit-birth screen.
import type { NextApiRequest, NextApiResponse } from 'next'

import { db } from '@/lib/db'
import { computeChartForBirth } from '@/lib/chart/engine-chart-server'
import { createPostgresBirthChartStore, parseBirthChartBody, saveBirthChart } from '@/lib/chart/save-birth-chart'
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { isTaisuiOpen } from '@/lib/taisui/live'
import { chartInputFrom } from '@/lib/taisui/me'
import { parseBirth, sameOrigin, savedBirth } from '@/lib/taisui/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isTaisuiOpen()) return res.status(404).json({ error: 'not_found' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' })
  res.setHeader('Cache-Control', 'no-store')
  const who = await resolveRouteMember(req, res)
  if (!who.ok) return res.status(who.status).json(who.body)
  const birth = parseBirth((req.body ?? {}).birth)
  const input = birth ? parseBirthChartBody(chartInputFrom(birth)) : null
  if (!input) return res.status(400).json({ error: 'invalid_input' })
  try {
    const saved = await savedBirth(who.userId)
    if (saved === 'none') return res.status(404).json({ error: 'no_account' })
    if (saved !== 'incomplete') return res.status(409).json({ code: 'already_saved' })
    const r = await saveBirthChart(createPostgresBirthChartStore(db as any), who.userId, input, (b) => computeChartForBirth(b), {
      onEngineError: (e) => console.error('[taisui/save-birth] engine (saved without chart)', e instanceof Error ? e.name : 'unknown'),
    })
    if (!r.ok) return res.status(404).json({ error: 'no_account' })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[taisui/save-birth] failed', e instanceof Error ? e.name : 'unknown')
    return res.status(500).json({ error: 'save_failed' })
  }
}
