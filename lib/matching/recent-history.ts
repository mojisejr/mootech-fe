// The colleague-aware history query (mootech-fe#585).
//
// 🔴 IT LIVES HERE, NOT INSIDE THE ROUTE, FOR ONE REASON: scripts/work-history-union-db.test.ts runs THIS
// function against a real database. A test that re-typed the SQL would be a second copy that stays green
// while the route drifts — the exact shape of "a checker with no original".
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export type RecentHistoryRow = {
  id: string
  lane: 'pair' | 'work'
  type: string | null
  create_at: string | null
  user_name: string | null
  user_surname: string | null
  user_picture_url: string | null
  friend_name: string | null
  friend_surname: string | null
  friend_picture_url: string | null
}

const rowsOf = (r: unknown): RecentHistoryRow[] =>
  Array.isArray(r) ? (r as RecentHistoryRow[]) : ((r as { rows?: RecentHistoryRow[] })?.rows ?? [])

export async function listRecentHistory(userId: string): Promise<RecentHistoryRow[]> {
    // TWO LANES, UNIONed. 🔴 THEY DO NOT SHARE THE DEDUPE RULE, and that is the whole point.
    //
    // pair lane — unchanged. be kept only the LATEST run per (user, friend, matching_type) via a
    // MAX(create_at) self-join (matching.service.ts:229-250); DISTINCT ON expresses the same rule
    // directly. ⚠️ ONE deliberate difference: when two runs of the same pair+type share an identical
    // create_at string, be's equality join emitted BOTH rows (the same card twice); DISTINCT ON emits
    // one. A duplicate card was never the contract — create_at has second resolution, so this is
    // reachable.
    //
    // work lane — 🔴 NO DISTINCT ON. Its rows key on (friend_id, matching_type) too, but a colleague run
    // stores ONE inert representative friend in `user_matching.friend_id` (slot 0) and every run carries
    // the same `matching_type`. Inheriting the pair rule would therefore collapse two different
    // comparisons that happen to start with the same person into one card, and the older one would
    // vanish from the only place the user can reach it — after they paid a quota unit for it. ตู๋ caught
    // this shape in review before any of it was written (mootech-fe#585).
  const result = await db.execute(sql`
      SELECT * FROM (
        SELECT DISTINCT ON (um.friend_id, um.matching_type)
               'pair'::text         AS lane,
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
         WHERE lm.user_id = ${userId}
         ORDER BY um.friend_id, um.matching_type, um.create_at DESC
      ) latest

      UNION ALL

      SELECT 'work'::text        AS lane,
             wc.matching_id      AS id,
             um.matching_type    AS type,
             wc.create_at        AS create_at,
             u.name              AS user_name,
             u.surname           AS user_surname,
             u.picture_url       AS user_picture_url,
             f.name              AS friend_name,
             f.surname           AS friend_surname,
             f.picture_url       AS friend_picture_url
        FROM work_comparison wc
        JOIN user_matching um  ON um.id = wc.matching_id
        LEFT JOIN "user" u     ON u.user_id = wc.user_id
        LEFT JOIN work_comparison_candidate wcc
               ON wcc.matching_id = wc.matching_id AND wcc.slot = 0
        LEFT JOIN member_with_friend f ON f.id = wcc.friend_id
       WHERE wc.user_id = ${userId}

      ORDER BY create_at DESC
    `)

  return rowsOf(result)
}
