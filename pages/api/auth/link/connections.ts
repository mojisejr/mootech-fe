// GET /api/auth/link/connections — which login methods this member actually holds
// (mumate-login-identity-001 slice 3).
//
// Nothing in this codebase served this before. ConnectedScreen decided "connected"
// by comparing each row's key against the provider the session happens to be
// signed in with, so a second linked provider always rendered as not linked, and
// /api/profile returns profile and quota but no provider rows. The screen could
// not be made truthful without an endpoint, so here it is.
//
// Read-only, so it uses the ordinary resolver — the strict one is for writes that
// grant access. Worst case for a forged cookie here is seeing which providers
// some member has linked, which is what that member sees on their own screen;
// nothing is changed and no identifier is returned.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { summariseConnections } from '@/lib/auth/link-account'
import { readMemberProviders } from '@/lib/auth/link-account-store'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  try {
    const session = (await getServerSession(req, res, authOptions)) as { provider?: string } | null
    const rows = await readMemberProviders(who.userId)
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
    // No row ids, no subjects, no emails — the screen needs to know WHICH methods
    // exist, never their credentials.
    return res.status(200).json({ ok: true, connections: summariseConnections(rows, session?.provider) })
  } catch (error) {
    console.error('[link/connections] failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'could not read connections' })
  }
}
