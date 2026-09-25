// GET /api/auth/link/callback/<provider> — the provider sends the member back here
// (mumate-login-identity-001 slice 3). This is the URI registered on the Google
// and LINE consoles, so its path is fixed and must not move.
//
// §IT LIVES UNDER /api/auth FOR A REASON THAT IS EASY TO UNDO BY ACCIDENT.
// The maintenance gate allowlists `/api/auth`; it does not allowlist
// `/api/v2/account/*`. Under MAINTENANCE_MODE=on a callback there is REWRITTEN to
// /maintenance — and a rewrite answers HTTP 200, so the provider records a
// successful redirect while the link never happened, with nothing in any log
// saying so. Same failure the Omise webhook exemption exists to prevent.
//
// §EVERY EXIT CLEARS THE STATE COOKIE. Success, refusal, provider error, crash.
// A state that survives its own callback can be replayed, and the cheapest way to
// guarantee it cannot is to make expiry unconditional rather than a step on the
// happy path.
//
// §NOTHING HERE READS AN IDENTITY FROM THE REQUEST. The member was captured from
// the SIGNED session when the flow started and travelled inside the HMAC. The
// browser that returns is not asked who it is, which is what makes the flow safe
// against a callback arriving in a different session — it simply fails.
import type { NextApiRequest, NextApiResponse } from 'next'

import {
  isLinkableProvider,
  linkRedirectUri,
  type LinkableProvider,
} from '@/lib/auth/link-providers'
import { linkProvider, planIdentityMerge } from '@/lib/auth/link-account'
import { postgresLinkStore } from '@/lib/auth/link-account-store'
import { issueMergeTicket, mergeTicketCookie } from '@/lib/auth/merge-ticket'
import { hasEverPaid, resolveSubscription } from '@/lib/v2/subscription'
import {
  clearLinkStateCookie,
  linkStateCookieName,
  safeReturnTo,
  verifyLinkState,
} from '@/lib/auth/link-state'
import { exchangeAndVerify } from '@/lib/auth/link-verify'

const isDev = process.env.NODE_ENV !== 'production'

const FALLBACK_RETURN = '/v2/settings/connected'

function finish(
  res: NextApiResponse,
  provider: string,
  returnTo: string,
  params: Record<string, string>,
  extraCookies: string[] = [],
) {
  // 🔴 ONE setHeader CALL WITH AN ARRAY, never two calls. res.setHeader REPLACES the
  // header, so setting the merge ticket in a second call would silently drop the
  // clear-state cookie and leave a spent state replayable — the exact guarantee the
  // header comment above promises is unconditional.
  res.setHeader('Set-Cookie', [clearLinkStateCookie(provider, { secure: !isDev }), ...extraCookies])
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const url = new URL(safeReturnTo(returnTo, FALLBACK_RETURN), 'http://localhost')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  res.redirect(302, `${url.pathname}${url.search}`)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const raw = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider
  if (!isLinkableProvider(raw)) return res.status(404).json({ ok: false, error: 'unknown provider' })
  const provider = String(raw).trim().toLowerCase() as LinkableProvider

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const cookie = req.cookies?.[linkStateCookieName(provider)]

  // The state is verified BEFORE the provider's own error is reported, so that a
  // caller who never started a flow cannot use this endpoint as an oracle for
  // whether a given state is live.
  const state = verifyLinkState(cookie, { state: one(req.query.state), provider })
  if (!state.ok) return finish(res, provider, FALLBACK_RETURN, { link_error: `state_${state.reason}` })

  const returnTo = state.value.returnTo

  // The member declined at the provider's consent screen, or the provider refused.
  // Not an error worth alarming anyone about; send them back quietly.
  const providerError = one(req.query.error)
  if (providerError) return finish(res, provider, returnTo, { link_error: 'cancelled' })

  const code = one(req.query.code)
  if (!code) return finish(res, provider, returnTo, { link_error: 'no_code' })

  try {
    const verified = await exchangeAndVerify(provider, {
      code,
      codeVerifier: state.value.codeVerifier,
      redirectUri: linkRedirectUri(provider),
      nonce: state.value.nonce,
    })
    if (!verified.ok) return finish(res, provider, returnTo, { link_error: verified.reason })

    const outcome = await linkProvider(postgresLinkStore, {
      userId: state.value.userId,
      provider,
      subject: verified.value.subject,
      email: verified.value.email,
      name: verified.value.name,
      pictureUrl: verified.value.pictureUrl,
    })

    switch (outcome.status) {
      case 'linked':
        return finish(res, provider, returnTo, { linked: provider })
      case 'already-linked':
        return finish(res, provider, returnTo, { linked: provider, already: '1' })
      case 'owned-by-another': {
        // Case 3 of the identity contract, and as of slice 4 the case this feature
        // exists for rather than a dead end. Nothing has been written yet.
        //
        // §THE DISCLOSURE SLICE 3 REFUSED TO MAKE, MADE HERE ON PURPOSE. Slice 3
        // answers neutrally because naming the other account would reveal that a
        // given provider identity belongs to a member of this service — an
        // enumeration oracle. Offering a merge necessarily reveals it. That is safe
        // HERE and only here, because reaching this line means the same person, in
        // the same session, has both a signed session for one account AND a fresh
        // provider attestation for the other. Owner decision 9: that is stronger
        // proof of ownership than a support ticket. An offer made any earlier — or
        // to anyone who has not completed the second authorization — would be the
        // oracle, so this must never move ahead of the exchange above.
        const plan = await planIdentityMerge(
          postgresLinkStore,
          { signedInUserId: state.value.userId, provider, subject: verified.value.subject },
          // The paid verdict comes from the one module that owns that rule. A second
          // copy of it here is the defect #369 B2 closed.
          {
            resolveStanding: async (userId) => ({
              isPaid: (await resolveSubscription(userId)).isPaid,
              everPaid: await hasEverPaid(userId),
            }),
          },
        )

        if (plan.status !== 'planned') {
          // Refusals keep slice 3's neutral wording. `merge_refused` is a separate
          // code from `owned_by_another` so the screen can say "this needs a person"
          // instead of "this cannot be linked", and owner decision 9 makes support
          // the answer for everything this flow declines.
          const code = plan.status === 'refused' ? 'merge_refused' : 'owned_by_another'
          return finish(res, provider, returnTo, { link_error: code })
        }

        // The offer travels in an HttpOnly cookie and NOT in the query string: a
        // subject in a URL lands in browser history, in any access log in front of
        // this app, and in a Referer header.
        const ticket = issueMergeTicket({
          signedInUserId: state.value.userId,
          provider,
          subject: verified.value.subject,
          survivorUserId: plan.survivorUserId,
          loserUserId: plan.loserUserId,
        })
        return finish(res, provider, returnTo, { merge_offer: provider }, [
          mergeTicketCookie(provider, ticket, { secure: !isDev }),
        ])
      }
      case 'member-missing':
        return finish(res, provider, returnTo, { link_error: 'member_missing' })
    }
  } catch (error) {
    console.error('[link/callback] failed', error instanceof Error ? error.message : 'unknown error')
    return finish(res, provider, returnTo, { link_error: 'link_failed' })
  }
}
