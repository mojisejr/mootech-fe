// MIGRATED from NestJS GET /log-activity (-> getLogsByUserId)  (Phase 4 DB-only batch)
// Pure read: a user's point activity joined to activity names, newest first.
// Parity: queryBuilder leftJoin Activity, orderBy createAt DESC,
//   select [createAt AS create_at, activity.description AS activity_name, point].
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const userId = (req.query.user_id as string) ?? ''
  try {
    const rows = rowsOf(
      await db.execute(sql`
        SELECT la."createAt" AS create_at,
               a.description AS activity_name,
               la.point AS point
        FROM log_activity la
        LEFT JOIN activity a ON la.activity_id = a.id
        WHERE la.user_id = ${userId}
        ORDER BY la."createAt" DESC
      `),
    )
    // point is bigint -> string via postgres.js; NestJS getRawMany returns it numeric
    const out = rows.map((r) => ({ ...r, point: r.point == null ? r.point : Number(r.point) }))
    return res.status(200).json(out)
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
