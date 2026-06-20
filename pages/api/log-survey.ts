// MIGRATED from NestJS GET /log-survey (-> getLogSurveyByUser)  (Phase 4 DB-only batch)
// Pure read: surveys for a user, newest first. Parity: find({where:{user_id}, order:{createAt:DESC}}).
// Raw SQL because the introspected Drizzle schema predates the createat->"createAt" rename.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const userId = (req.query.user_id as string) ?? ''
  try {
    const rows = rowsOf(
      await db.execute(
        sql`SELECT * FROM log_survey WHERE user_id = ${userId} ORDER BY "createAt" DESC`,
      ),
    )
    return res.status(200).json(rows)
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
