// GET /api/auth/link/merge/preview?provider=<provider> — what the merge would do
// (mumate-login-identity-001 slice 4).
//
// §WHY THE SCREEN CANNOT WORK THIS OUT ITSELF. DoD 4 requires the member to be told,
// before anything is written, which account survives and what the other one is left
// with. Every input to that answer is server-side: the paid verdict from
// lib/v2/subscription.ts, the provider rows of BOTH accounts, and the survivor rule.
// A screen that guessed any of it would eventually tell a member something untrue —
// which is the defect summariseConnections was written to end for the linked/unlinked
// badges, and the same rule applies here.
//
// §IT NAMES NOBODY. The response says whether THIS account or the OTHER one survives
// and nothing else: no user_id, no email, no provider subject. The member already
// knows both accounts are theirs; anyone else presenting a stolen ticket must learn
// nothing, and a value in a JSON body still reaches logs and error reporters.
//
// §IT RECOMPUTES RATHER THAN READING THE TICKET'S VERDICT. The ticket carries the
// verdict the callback reached, and it is used for nothing here. A payment landing
// between the offer and this call changes who is allowed to lose, and the member must
// be shown what would happen NOW.
//
// §IT SPENDS NOTHING. The ticket is left in place, because the member has not decided
// yet and may reload the screen. Only confirm clears it.
import type { NextApiRequest, NextApiResponse } from 'next'

import { isLinkableProvider } from '@/lib/auth/link-providers'
import { planIdentityMerge } from '@/lib/auth/link-account'
import { postgresLinkStore } from '@/lib/auth/link-account-store'
import { mergeTicketCookieName, verifyMergeTicket } from '@/lib/auth/merge-ticket'
import { resolveSignedSessionUserId } from '@/lib/v2/resolve-user'
import { hasEverPaid, resolveSubscription } from '@/lib/v2/subscription'

export type MergePreviewBody =
  | {
      ok: true
      provider: string
      /** whose account remains usable: the one this session is signed into, or the
       *  other one. Deliberately not a user_id. */
      survivor: 'this-account' | 'other-account'
      /** true when the account that loses is left with no way to sign in. The
       *  survivor rule only offers a merge in that case, so this is always true
       *  today; it is reported rather than assumed so the copy stays honest if the
       *  rule ever widens. */
      loserKeepsNothing: boolean
    }
  | { ok: false; error: string }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MergePreviewBody>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const raw = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider
  if (!isLinkableProvider(raw)) return res.status(404).json({ ok: false, error: 'unknown provider' })
  const provider = String(raw).trim().toLowerCase()

  // §STRICT IDENTITY, as in the start, unlink and callback routes. The
  // cookie-mumate-id fallback in resolveUser is client-settable; accepting it
  // anywhere near a credential move is an account-takeover primitive.
  const who = await resolveSignedSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  const ticket = verifyMergeTicket(req.cookies[mergeTicketCookieName(provider)], {
    provider,
    signedInUserId: who.userId,
  })
  if (!ticket.ok) {
    // One shape for every failure. Telling a caller WHICH check failed turns this into
    // an oracle for shaping a forgery, and the member's remedy is the same in all of
    // them: start the link again.
    return res.status(409).json({ ok: false, error: 'no_offer' })
  }

  res.setHeader('Cache-Control', 'no-store, must-revalidate')

  try {
    const plan = await planIdentityMerge(
      postgresLinkStore,
      { signedInUserId: who.userId, provider: provider as 'google' | 'line', subject: ticket.value.subject },
      {
        resolveStanding: async (userId) => ({
          isPaid: (await resolveSubscription(userId)).isPaid,
          everPaid: await hasEverPaid(userId),
        }),
      },
    )
    if (plan.status !== 'planned') {
      return res.status(409).json({ ok: false, error: plan.status === 'refused' ? 'merge_refused' : plan.status })
    }

    return res.status(200).json({
      ok: true,
      provider,
      survivor: plan.survivorUserId === who.userId ? 'this-account' : 'other-account',
      loserKeepsNothing: plan.loserLiveIdentities <= 1,
    })
  } catch (error) {
    console.error('[link/merge/preview] failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'could not describe the merge' })
  }
}
