// GET /api/v2/matching — the caller's ดวงสมพงษ์ history (#357). Replaces v1 GET /user-matching.
//
// 🔴 be took user_id from the QUERY STRING (matching.controller.ts:29), so any caller could list any
// account's history. Here the list is always the session's own; there is no user_id parameter to pass.
//
// Shape is v1's, because the screen already parses it — features/v2-service/compatibility-recent.ts:39
// expects a bare ARRAY of { id, type, user:{picture}, friend:{name, picture} } and treats anything else
// as a failure. So this route answers with the array itself, not an envelope.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'

type Row = {
  id: string
  type: string | null
  create_at: string | null
  user_name: string | null
  user_surname: string | null
  user_picture_url: string | null
  friend_name: string | null
  friend_surname: string | null
  friend_picture_url: string | null
}

const rowsOf = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] })?.rows ?? []))

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  try {
    // be kept only the LATEST run per (user, friend, matching_type) via a MAX(create_at) self-join
    // (matching.service.ts:229-250). DISTINCT ON expresses the same rule directly.
    // ⚠️ ONE deliberate difference: when two runs of the same pair+type share an identical create_at
    // string, be's equality join emitted BOTH rows (the same card twice); DISTINCT ON emits one. A
    // duplicate card was never the contract — create_at has second resolution, so this is reachable.
    const result = await db.execute(sql`
      SELECT * FROM (
        SELECT DISTINCT ON (um.friend_id, um.matching_type)
               um.id                AS id,
               um.matching_type     AS type,
               um.create_at         AS create_at,
               u.name               AS user_name,
               u.surname            AS user_surname,
               u.picture_url        AS user_picture_url,
               f.name               AS friend_name,
               f.surname            AS friend_surname,
               f.picture_url        AS friend_picture_url
          FROM log_matching lm
          JOIN user_matching um   ON lm.matching_id = um.id
          LEFT JOIN "user" u      ON lm.user_id = u.user_id
          LEFT JOIN member_with_friend f ON um.friend_id = f.id
         WHERE lm.user_id = ${who.userId}
         ORDER BY um.friend_id, um.matching_type, um.create_at DESC
      ) latest
      ORDER BY latest.create_at DESC
    `)

    // DISTINCT ON must ORDER BY its own dedupe key first, which is not the order the list is read in.
    // be's list came back create_at DESC (matching.service.ts:268), so the deduped set is wrapped and
    // re-sorted by create_at in SQL above — not by id, which is a uuid and carries no time.
    const rows = rowsOf(result)
    return res.status(200).json(
      rows.map((r) => ({
        id: r.id,
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
