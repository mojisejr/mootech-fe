// DELETE /api/auth/link/unlink/<provider> — remove a login method (slice 3).
//
// §STRICT IDENTITY, like the start route and for the same reason. This removes a
// credential, so it must not accept the client-settable cookie-mumate-id fallback.
//
// §THE REFUSAL IS THE POINT. Removing a member's only remaining provider locks
// them out permanently: this workstream refuses to join accounts by email, so
// there is no recovery path short of a hand-written production DELETE. The rule
// lives in lib/auth/link-account.ts and is enforced inside the transaction, not
// here, so a race between two tabs cannot slip past a check made before the read.
//
// §AND THE SECOND REFUSAL. Removing the method this session is signed in THROUGH
// strands the member's own session: recoverable by signing in the other way, so it
// is not the lockout above, but it is a hole the member digs while looking at a
// screen we put in front of them. The session's provider comes from the session
// here — never from the query or the body — and the rule is applied beside the
// last-method rule on the same rows.
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

import { isLinkableProvider, type LinkableProvider } from '@/lib/auth/link-providers'
import { unlinkProvider } from '@/lib/auth/link-account'
import { postgresLinkStore } from '@/lib/auth/link-account-store'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { resolveSignedSessionUserId } from '@/lib/v2/resolve-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const raw = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider
  if (!isLinkableProvider(raw)) return res.status(404).json({ ok: false, error: 'unknown provider' })
  const provider = String(raw).trim().toLowerCase() as LinkableProvider

  const who = await resolveSignedSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  try {
    const session = (await getServerSession(req, res, authOptions)) as { provider?: string } | null
    const outcome = await unlinkProvider(postgresLinkStore, {
      userId: who.userId,
      provider,
      sessionProvider: session?.provider ?? null,
    })
    switch (outcome.status) {
      case 'unlinked':
        return res.status(200).json({ ok: true, unlinked: provider, removed: outcome.removed })
      case 'not-linked':
        return res.status(404).json({ ok: false, error: 'not_linked' })
      case 'last-method':
        // 409, not 400: the request is well formed and the member is allowed to
        // ask — the state of their account is what forbids it.
        return res.status(409).json({ ok: false, error: 'last_method' })
      case 'current-method':
        // Same 409 for the same reason, and a DIFFERENT code: this one has a way
        // out and the screen has to be able to say what it is.
        return res.status(409).json({ ok: false, error: 'current_method' })
    }
  } catch (error) {
    console.error('[link/unlink] failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'could not unlink' })
  }
}
