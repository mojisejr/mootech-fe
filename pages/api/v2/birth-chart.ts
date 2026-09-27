// POST /api/v2/birth-chart — v2 register and edit-birth save the member's birth and mint `result_code`
// (the "registered" flag home gates on), replacing mootech-be's POST /chinese-horoscope for v2
// (mumate-be-retirement-001 slice 1, plan rev 0.4 1b). The write itself is lib/chart/save-birth-chart.ts.
//
// Body: { dob: 'YYYY-MM-DD', time?: 'HH:mm' | '', gender?: 'MALE'|'FEMALE', name?, surname?,
//         picture_url?, account_name?, place_name? }   → 200 { code }
// Identity: the session (resolveSessionUserId — the same rule /api/profile's PATCH writes user.dob under),
// NEVER the body: a body `user_id` is ignored. A session that disagrees with the MEMBER_ID cookie is
// refused (409): the screen is showing the cookie's member, and writing the session's member would
// change an account the person is not looking at.
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { memberCookieMismatch, resolveSessionUserId } from '@/lib/v2/resolve-user'
import { computeChartForBirth } from '@/lib/chart/engine-chart-server'
import {
  createPostgresBirthChartStore,
  parseBirthChartBody,
  saveBirthChart,
  type BirthChartStore,
} from '@/lib/chart/save-birth-chart'
import type { ChartPayload } from '@/lib/chart/engine-chart'

type Deps = {
  resolve: typeof resolveSessionUserId
  store: () => BirthChartStore
  computeChart: (b: { dob: string; time: string; gender: string | null; place_name: string | null }) => Promise<ChartPayload>
}

const defaultDeps: Deps = {
  resolve: resolveSessionUserId,
  store: () => createPostgresBirthChartStore(db as any),
  computeChart: (b) => computeChartForBirth(b),
}

export function createBirthChartHandler(deps: Deps = defaultDeps) {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const input = parseBirthChartBody(req.body)
    if (!input) return res.status(400).json({ error: 'invalid birth' })

    let who
    try {
      who = await deps.resolve(req, res)
    } catch {
      return res.status(500).json({ error: 'identity lookup failed' })
    }
    if (!who.ok) return res.status(who.status).json({ error: who.error })
    if (memberCookieMismatch(req, who.userId)) {
      return res.status(409).json({ error: 'session and member cookie disagree — please sign in again' })
    }

    try {
      const r = await saveBirthChart(deps.store(), who.userId, input, deps.computeChart, {
        onEngineError: (e) => console.error('[birth-chart] engine (saved without chart)', e instanceof Error ? e.message : 'unknown'),
      })
      if (!r.ok) return res.status(404).json({ error: 'no account' })
      return res.status(200).json({ code: r.code })
    } catch (e) {
      console.error('[birth-chart] save failed', e instanceof Error ? e.message : 'unknown error')
      return res.status(500).json({ error: 'save failed' })
    }
  }
}

export default createBirthChartHandler()
