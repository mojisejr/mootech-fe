// GET /api/auth/identity-status — does the signed-in identity have an owner yet?
// (mumate-login-identity-001 slice 5.) Read-only: one SELECT through
// resolveSignedSessionUserId, no lock, no write.
//
// §WHAT IT DISCLOSES, and to whom. Only whether the CALLER's own signed identity has an
// owner — never a user_id, a name, or anything about another identity. That is the
// same fact the self-heal learns anyway when register-login answers is_user_new.
//
// Strict resolution (no MEMBER_ID cookie fallback): the question is about the signed
// identity, and a forgeable cookie must not be able to answer "known" for it.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { resolveSignedSessionUserId } from '@/lib/v2/resolve-user'
import { decideIdentityStatus, isAskBeforeCreateEnabled } from '@/lib/auth/ask-before-create'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  try {
    const session = (await getServerSession(req, res, authOptions)) as { provider?: string } | null
    const enabled = isAskBeforeCreateEnabled(process.env.LOGIN_ASK_BEFORE_CREATE)
    const resolved = session ? await resolveSignedSessionUserId(req, res) : null
    return res.status(200).json(decideIdentityStatus({ provider: session?.provider ?? null, resolved, enabled }))
  } catch {
    // Never let this route block a sign-in: the client treats any failure as "do not ask".
    console.error('[auth/identity-status] failed')
    return res.status(500).json({ ok: false, ask: false })
  }
}
