// GET /api/v2/matching — the caller's ดวงสมพงษ์ history (#357, colleague lane added by #585).
//
// 🔴 be took user_id from the QUERY STRING (matching.controller.ts:29), so any caller could list any
// account's history. Here the list is always the session's own; there is no user_id parameter to pass.
//
// Shape is v1's, because the screen already parses it — features/v2-service/compatibility-recent.ts:39
// expects a bare ARRAY of { id, type, user:{picture}, friend:{name, picture} } and treats anything else
// as a failure. So this route answers with the array itself, not an envelope. #585 adds ONE field,
// `lane`, which is additive: a client that ignores it behaves exactly as before.
//
// The query itself lives in lib/matching/recent-history.ts so the database-level spec can run the real
// thing instead of a re-typed copy.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { listRecentHistory } from '@/lib/matching/recent-history'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  try {
    const rows = await listRecentHistory(who.userId)
    return res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        // which lane this card came from ⇒ which route the card must open. The pair reader
        // (pages/api/v2/matching/[id].ts:54) is driven by log_matching and 404s for every work row, so a
        // card that guesses is a card that dead-ends. features/v2-service/compatibility-recent.ts owns
        // the mapping (recentHrefFor); the screen must never build the href itself.
        lane: r.lane === 'work' ? 'work' : 'pair',
        user: { name: r.user_name, user_surname: r.user_surname, picture: r.user_picture_url },
        friend: { name: r.friend_name, user_surname: r.friend_surname, picture: r.friend_picture_url },
        type: r.type,
      })),
    )
  } catch (e) {
    console.error('[v2][matching] list failed:', e)
    return res.status(500).json({ ok: false, error: 'internal error' })
  }
}
