// GET /api/auth/member-check — does this browser still hold a member identity the server accepts?
// (mumate-member-identity-hardening-001 slice 1.)
//
// Asked once per app load by lib/auth/use-unsealed-member-check.ts whenever the app holds cookie-mumate-id.
// Resolution is the one every member route uses (resolveRouteMember: session, else the #391 fallback that
// needs the member seal; a cookie naming someone else is 409 reason:'identity'). 204 = the server serves
// this member, carry on. 401 = drop the stale cookie and sign in once. 409 identity = the cookie is left
// over from another account; drop it and the self-heal mints the session's own member.
//
// §WHAT IT DISCLOSES. A status code about the CALLER's own identity. Never a user_id or anything else.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveRouteMember } from '@/lib/v2/resolve-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  try {
    const who = await resolveRouteMember(req, res)
    if (who.ok) return res.status(204).end()
    return res.status(who.status).json({ ok: false, ...who.body })
  } catch {
    // A fault is not "signed out": the client keeps its cookies on anything but 401.
    console.error('[auth/member-check] failed')
    return res.status(500).json({ ok: false })
  }
}
