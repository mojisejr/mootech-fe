// GET /api/taisui/me — ปีชง 2570 (revision 0.15): visitor or member, the member's level, and how they logged in,
// so the page offers only what fits them. Nothing about the member beyond these three answers leaves the server.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { readMemberProviders } from '@/lib/auth/link-account-store'
import { resolveOptionalRouteMember } from '@/lib/v2/resolve-user'
import { resolveSubscription } from '@/lib/v2/subscription'
import { isTaisuiOpen } from '@/lib/taisui/live'
import { levelFrom, providerFrom, type TaisuiMe } from '@/lib/taisui/me'

export default async function handler(req: NextApiRequest, res: NextApiResponse<TaisuiMe | { error: string }>) {
  if (!isTaisuiOpen()) return res.status(404).json({ error: 'not_found' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  res.setHeader('Cache-Control', 'no-store')
  const memberId = await resolveOptionalRouteMember(req, res)
  if (!memberId) return res.status(200).json({ member: false })
  // each answer fails on its own: an unknown level offers nothing, an unknown provider asks nothing
  const [m, session, rows] = await Promise.all([
    resolveSubscription(memberId).catch(() => null),
    getServerSession(req, res, authOptions).catch(() => null) as Promise<{ provider?: string } | null>,
    readMemberProviders(memberId).catch(() => null),
  ])
  return res.status(200).json({
    member: true,
    level: levelFrom(m),
    provider: providerFrom(session?.provider),
    lineLinked: rows ? rows.some((r) => String(r.provider).trim().toLowerCase() === 'line') : null,
  })
}
