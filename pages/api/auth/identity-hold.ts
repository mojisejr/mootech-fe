// POST /api/auth/identity-hold — hold the signed session's identity before the member
// proves the other provider (mumate-login-identity-001 slice 5, owner decision 23).
//
// Only an UNOWNED identity is held: that is the only identity the question page asks
// about, and holding an owned one would let this route become a way to move someone's
// credential. The identity comes from the session NextAuth signed — nothing from the
// request body is read. See lib/auth/held-identity.ts for why this is as strong a proof
// as the link flow's.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { resolveSignedSessionUserId } from '@/lib/v2/resolve-user'
import { asAskableProvider } from '@/lib/auth/ask-before-create'
import { heldIdentityCookie, isSameOriginPost, issueHeldIdentity } from '@/lib/auth/held-identity'

const isDev = process.env.NODE_ENV !== 'production'

interface SessionShape {
  provider?: string
  providerId?: string
  lineProfile?: { sub?: string }
  user?: { name?: string | null; email?: string | null; image?: string | null }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  if (!isSameOriginPost(req)) return res.status(403).json({ ok: false, error: 'cross_origin' })

  try {
    const session = (await getServerSession(req, res, authOptions)) as SessionShape | null
    const provider = asAskableProvider(session?.provider ?? null)
    const subject = (session?.providerId ?? '').trim()
    if (!session || !provider || !subject) return res.status(401).json({ ok: false, error: 'not_signed_in' })
    // [...nextauth] sets providerId from the account and lineProfile from the id_token;
    // register-login-fe refuses a session where they disagree, and so does this.
    if (provider === 'line' && (session.lineProfile?.sub ?? '').trim() !== subject) {
      return res.status(401).json({ ok: false, error: 'not_signed_in' })
    }

    const who = await resolveSignedSessionUserId(req, res)
    if (who.ok) return res.status(409).json({ ok: false, error: 'identity_owned' })
    if (who.status !== 404) return res.status(409).json({ ok: false, error: 'identity_unresolved' })

    const value = issueHeldIdentity({
      provider,
      subject,
      name: session.user?.name ?? '',
      email: session.user?.email ?? '',
      pictureUrl: session.user?.image ?? '',
    })
    res.setHeader('Set-Cookie', heldIdentityCookie(value, { secure: !isDev }))
    return res.status(200).json({ ok: true, provider })
  } catch {
    // The client falls back to the link flow's own round trip on any failure.
    console.error('[auth/identity-hold] failed')
    return res.status(500).json({ ok: false, error: 'hold_failed' })
  }
}
