// POST /api/auth/identity-attach — attach the held identity to the account the member
// has just proven (mumate-login-identity-001 slice 5, owner decision 23).
//
// Every rule of the link flow applies, because this IS linkProvider: the identity's
// owner is re-read under the advisory lock, an identity owned by someone else is
// refused (and, unlike the link callback, no merge is offered from a hold — the member
// never asked for one here), and owner decision 22 refuses a second live identity of
// one provider. The held cookie is cleared on every exit, so it is spent once.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSignedSessionUserId } from '@/lib/v2/resolve-user'
import { linkProvider } from '@/lib/auth/link-account'
import { postgresLinkStore } from '@/lib/auth/link-account-store'
import { asAskableProvider } from '@/lib/auth/ask-before-create'
import {
  HELD_IDENTITY_COOKIE,
  clearHeldIdentityCookie,
  isSameOriginPost,
  verifyHeldIdentity,
} from '@/lib/auth/held-identity'

const isDev = process.env.NODE_ENV !== 'production'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  if (!isSameOriginPost(req)) return res.status(403).json({ ok: false, error: 'cross_origin' })

  // Spent on every path from here on, success or not.
  res.setHeader('Set-Cookie', clearHeldIdentityCookie({ secure: !isDev }))

  try {
    const held = verifyHeldIdentity(req.cookies?.[HELD_IDENTITY_COOKIE])
    const provider = held.ok ? asAskableProvider(held.value.provider) : null
    if (!held.ok || !provider) return res.status(409).json({ ok: false, error: 'no_hold' })

    const who = await resolveSignedSessionUserId(req, res)
    if (!who.ok) {
      return res.status(who.status === 401 ? 401 : 409).json({
        ok: false,
        error: who.status === 401 ? 'not_signed_in' : 'identity_unresolved',
      })
    }

    const outcome = await linkProvider(postgresLinkStore, {
      userId: who.userId,
      provider,
      subject: held.value.subject,
      email: held.value.email,
      name: held.value.name,
      pictureUrl: held.value.pictureUrl,
    })
    switch (outcome.status) {
      case 'linked':
        return res.status(200).json({ ok: true, linked: provider })
      case 'already-linked':
        return res.status(200).json({ ok: true, linked: provider, already: true })
      case 'owned-by-another':
        return res.status(409).json({ ok: false, error: 'owned_by_another' })
      case 'provider-already-held':
        return res.status(409).json({ ok: false, error: 'provider_already_held' })
      case 'member-missing':
        return res.status(409).json({ ok: false, error: 'member_missing' })
    }
  } catch {
    console.error('[auth/identity-attach] failed')
    return res.status(500).json({ ok: false, error: 'link_failed' })
  }
}
