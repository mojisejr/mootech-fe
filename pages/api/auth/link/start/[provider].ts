// GET /api/auth/link/start/<provider> — begin linking a second login method
// (mumate-login-identity-001 slice 3).
//
// §WHY IT LIVES UNDER /api/auth AND NOT /api/v2
// The maintenance gate allowlists `pathname.startsWith('/api/auth')`; it does NOT
// allowlist /api/v2/account/*. With MAINTENANCE_MODE=on a callback under /api/v2
// is REWRITTEN to /maintenance — and a rewrite answers HTTP 200, so the provider
// reads success while the link silently never happens. That is the identical
// failure the Omise webhook exemption exists to prevent (middleware.ts). Both
// halves of this flow therefore live here, and the registered redirect URIs on
// the provider consoles point here.
//
// §WHY IT IS A 302 AND NOT A JSON API THE CLIENT REDIRECTS FROM
// lib/auth/oauth-redirect.ts exists because `signIn()`'s client-side
// `fetch` → `location.href` is unreliable inside the LINE webview: on a cold load
// the fetch returned null and the user was sent to an error page before ever
// reaching the provider ("รหัสอ้างอิง: undefined"). A server 302 on a top-level
// navigation has none of that: the browser follows it, and the state cookie is
// set in the very same response, so there is no window where one exists without
// the other.
import type { NextApiRequest, NextApiResponse } from 'next'

import {
  clientIdFor,
  isLinkableProvider,
  linkRedirectUri,
  refusalReason,
  buildAuthorizeUrl,
  type LinkableProvider,
} from '@/lib/auth/link-providers'
import { issueLinkState, linkStateCookie, safeReturnTo } from '@/lib/auth/link-state'
import { resolveSignedSessionUserId } from '@/lib/v2/resolve-user'

const isDev = process.env.NODE_ENV !== 'production'

/** Where a refusal or failure sends the member. The linking screen renders the
 *  reason; it is never shown as a bare API error page, because this endpoint is
 *  reached by a top-level navigation and the member would otherwise see JSON. */
function back(res: NextApiResponse, returnTo: string, reason: string) {
  const url = new URL(returnTo, 'http://localhost')
  url.searchParams.set('link_error', reason)
  res.redirect(302, `${url.pathname}${url.search}`)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const raw = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider
  if (!isLinkableProvider(raw)) {
    return res.status(404).json({ ok: false, error: 'unknown provider' })
  }
  const provider = String(raw).trim().toLowerCase() as LinkableProvider
  const returnTo = safeReturnTo(
    Array.isArray(req.query.return_to) ? req.query.return_to[0] : req.query.return_to,
  )

  // Identity FIRST, before anything else is read — the house rule from
  // pages/api/v2/onboarding.ts, and here it is also the security boundary. This
  // is the STRICT resolver: no cookie-mumate-id fallback, because this flow
  // decides who can log in as whom.
  const who = await resolveSignedSessionUserId(req, res)
  if (!who.ok) return back(res, returnTo, who.status === 401 ? 'not_signed_in' : 'identity_unresolved')

  // Owner decision 7: refuse rather than escort. Google blocks OAuth inside the
  // LINE webview, and the external browser it would have to be escorted to
  // carries neither the session nor the state cookie.
  const refusal = refusalReason(provider, req.headers['user-agent'])
  if (refusal) return back(res, returnTo, refusal)

  try {
    const issued = issueLinkState({ userId: who.userId, provider, returnTo })
    const authorizeUrl = buildAuthorizeUrl({
      provider,
      clientId: clientIdFor(provider),
      redirectUri: linkRedirectUri(provider),
      state: issued.state,
      nonce: issued.nonce,
      codeChallenge: issued.codeChallenge,
    })

    // The cookie and the redirect leave in ONE response. Nothing can observe a
    // state that has been sent to the provider but not yet stored, or the reverse.
    res.setHeader('Set-Cookie', linkStateCookie(provider, issued.cookieValue, { secure: !isDev }))
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
    return res.redirect(302, authorizeUrl)
  } catch (error) {
    // A missing LINK_STATE_SECRET, client id, or NEXTAUTH_URL lands here. Those
    // are configuration faults, so they fail closed and say so in the log rather
    // than starting a flow that cannot be completed safely.
    console.error('[link/start] failed', error instanceof Error ? error.message : 'unknown error')
    return back(res, returnTo, 'link_unavailable')
  }
}
