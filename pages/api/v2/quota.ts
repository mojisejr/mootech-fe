// GET /api/v2/quota — the pre-click indicator's numbers for the v2 lane (mojisejr/mootech-fe#358 Phase 6).
//
// 🔴 WHY A SECOND ROUTE AND NOT AN EDIT TO pages/api/quota. That one is v1's, and #358's DoD says in as
// many words that it must keep answering exactly what it answered before: it mirrors mootech-be's
// ceilings, v1 screens read it, and a v2 change leaking into it would make the v1 indicator lie.
//
// 🔴 WHY IT COULD NOT SIMPLY BE LEFT ALONE, which was my first plan. features/v2-service/hooks/useQuota.ts
// — a v2 hook, read by the v2 compatibility screen — fetched /api/quota, so the screen printed v1's
// "เหลือ 98 ครั้ง" (100 per YEAR, free-only) while this phase makes the server refuse at 2 per MONTH.
// That is `lib/usage-core.ts:30-35`'s own warning arriving from the other direction: not a stale constant,
// but the right constant read by the wrong lane. An indicator that lies is worse than no phase.
//
// 🔴 THE SUBJECT IS THE SESSION, never the query string. /api/quota takes `?user_id=`, which is the shape
// #391 removed from the calendar route: a sender must not get to nominate whose numbers come back. Nothing
// here reads the body or the query.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { resolveSubscription } from '@/lib/v2/subscription'
import { compatibilityQuotaView } from '@/lib/v2/compat-quota'
import { checkFriendQuota } from '@/lib/usage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })

  try {
    // A membership we cannot read spends FREE — the same fail-closed reading the gate itself uses
    // (lib/matching/calculate-flow.ts). The indicator and the gate must agree even about the error case,
    // or a lookup outage shows a number the server will not honour.
    let verdict: { isPaid: boolean | null; tier: string | null } = { isPaid: false, tier: null }
    try {
      const v = await resolveSubscription(who.userId)
      verdict = { isPaid: v.isPaid, tier: v.tier }
    } catch {
      verdict = { isPaid: false, tier: null }
    }

    // `friend` is UNCHANGED and deliberately still v1's rule: #358 governs ดวงสมพงษ์ and ปฏิทินดวง only,
    // and เพิ่มเพื่อน has one lifetime ceiling for everybody (#262). Reusing the v1 reader is what keeps
    // that true rather than restating it.
    const [matching, friend] = await Promise.all([
      compatibilityQuotaView(verdict, who.userId),
      checkFriendQuota(who.userId),
    ])
    return res.status(200).json({ matching, friend })
  } catch (e: unknown) {
    console.error('[v2][quota] failed:', e)
    return res.status(500).json({ error: 'internal error' })
  }
}
