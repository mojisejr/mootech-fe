// POST /api/auth/link/merge/confirm — the member's explicit yes, and the only place a
// credential actually changes hands (mumate-login-identity-001 slice 4).
//
// §WHY THIS IS A SEPARATE REQUEST AT ALL. DoD 4: the losing account is left with no
// login method, the member is told that before anything is written, and the flow
// "refuses to proceed without an explicit confirmation that is separate from pressing
// link". The link press produced an OFFER; this is the yes.
//
// §AND WHY AN EXPLICIT FIELD ON TOP OF THE POST. A POST is not proof of intent on its
// own — a link prefetch, a double submit, or a retried request can produce one. The
// body must say `confirm: "merge"`, so performing this by accident requires writing
// the word.
//
// §WHY IT RECOMPUTES EVERYTHING THE OFFER ALREADY DECIDED. The ticket proves WHICH
// subject was attested and WHICH session was offered the merge. It is not authority
// for the direction: mergeIdentity re-reads both accounts, re-resolves the paid
// verdict and re-applies owner decision 8 inside the transaction that writes. If a
// payment landed while the member was reading, the side that may lose has changed, and
// a cached verdict must never be what takes a login method from someone who paid.
//
// §THE TICKET IS SPENT ON EVERY EXIT. Success, refusal, crash. Same rule the link
// callback follows for its state cookie, and for the same reason: an offer that
// survives its own confirmation can be replayed.
import type { NextApiRequest, NextApiResponse } from 'next'

import { isLinkableProvider, type LinkableProvider } from '@/lib/auth/link-providers'
import { mergeIdentity } from '@/lib/auth/link-account'
import { postgresLinkStore } from '@/lib/auth/link-account-store'
import { clearMergeTicketCookie, mergeTicketCookieName, verifyMergeTicket } from '@/lib/auth/merge-ticket'
import { resolveSignedSessionUserId } from '@/lib/v2/resolve-user'
import { hasEverPaid, resolveSubscription } from '@/lib/v2/subscription'

const isDev = process.env.NODE_ENV !== 'production'

export type MergeConfirmBody =
  | { ok: true; merged: string; survivor: 'this-account' | 'other-account' }
  | { ok: false; error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MergeConfirmBody>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
    provider?: unknown
    confirm?: unknown
  }
  const raw = typeof body.provider === 'string' ? body.provider : undefined
  if (!isLinkableProvider(raw)) return res.status(404).json({ ok: false, error: 'unknown provider' })
  const provider = String(raw).trim().toLowerCase() as LinkableProvider

  const spend = () => {
    res.setHeader('Set-Cookie', clearMergeTicketCookie(provider, { secure: !isDev }))
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
  }

  const who = await resolveSignedSessionUserId(req, res)
  if (!who.ok) {
    // No ticket is cleared here on purpose: we have not established whose ticket it
    // would be, and an unauthenticated request must not be able to destroy a real
    // member's pending offer.
    return res.status(who.status).json({ ok: false, error: who.error })
  }

  const ticket = verifyMergeTicket(req.cookies[mergeTicketCookieName(provider)], {
    provider,
    signedInUserId: who.userId,
  })
  if (!ticket.ok) {
    spend()
    return res.status(409).json({ ok: false, error: 'no_offer' })
  }

  if (body.confirm !== 'merge') {
    // The offer survives: the member has not said no, they have sent a request that
    // does not say yes.
    res.setHeader('Cache-Control', 'no-store, must-revalidate')
    return res.status(400).json({ ok: false, error: 'confirmation_required' })
  }

  try {
    const outcome = await mergeIdentity(
      postgresLinkStore,
      { signedInUserId: who.userId, provider, subject: ticket.value.subject },
      {
        resolveStanding: async (userId) => ({
          isPaid: (await resolveSubscription(userId)).isPaid,
          everPaid: await hasEverPaid(userId),
        }),
      },
    )
    spend()

    switch (outcome.status) {
      case 'merged':
        return res.status(200).json({
          ok: true,
          merged: provider,
          survivor: outcome.toUserId === who.userId ? 'this-account' : 'other-account',
        })
      case 'refused':
        // 409, not 400, for the reason the unlink route gives: the request is well
        // formed and the member is allowed to ask — the state of their accounts is
        // what forbids it. Owner decision 9 makes support the answer.
        return res.status(409).json({ ok: false, error: 'merge_refused' })
      case 'not-a-collision':
        return res.status(409).json({ ok: false, error: 'not_a_collision' })
      case 'identity-unknown':
        return res.status(409).json({ ok: false, error: 'no_offer' })
      case 'member-missing':
        return res.status(409).json({ ok: false, error: 'member_missing' })
    }
  } catch (error) {
    console.error('[link/merge/confirm] failed', error instanceof Error ? error.message : 'unknown error')
    spend()
    return res.status(500).json({ ok: false, error: 'could not merge' })
  }
}
