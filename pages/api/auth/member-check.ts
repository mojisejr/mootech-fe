// GET /api/auth/member-check — does this browser still hold a member identity the server accepts?
// (mumate-member-identity-hardening-001 slice 1.)
//
// Asked only by lib/auth/use-unsealed-member-check.ts, when the app has cookie-mumate-id but no NextAuth
// session. Resolution is the lenient one (session, else the #391 fallback that needs the member seal), so
// a member the server would serve gets 204 and keeps going; 401 tells the app to drop the stale cookie
// and sign in once.
//
// §WHAT IT DISCLOSES. A status code about the CALLER's own identity. Never a user_id or anything else.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  try {
    const who = await resolveSessionUserId(req, res)
    if (who.ok) return res.status(204).end()
    return res.status(who.status).json({ ok: false, error: who.error })
  } catch {
    // A fault is not "signed out": the client keeps its cookies on anything but 401.
    console.error('[auth/member-check] failed')
    return res.status(500).json({ ok: false })
  }
}
