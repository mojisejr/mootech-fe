// MIGRATED from NestJS GET /log-survey (-> getLogSurveyByUser)  (Phase 4 DB-only batch)
// Pure read: surveys for a user, newest first. Parity: find({where:{user_id}, order:{createAt:DESC}}).
// Raw SQL because the introspected Drizzle schema predates the createat->"createAt" rename.
//
// NestJS does NOT return raw rows — it JSON.parses each `result` and projects to
// { url, code, emoji, title, description, create_at } (bare array). The consumer
// (pages/profile reads item.url/title/emoji/description/create_at). The migration
// had returned raw DB rows -> missing fields in the UI. Restored the projection.
// (#mootech-fold-parity-audit)
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
    // Mirror NestJS getLogSurveyByUser: unpack JSON `result`, project the 6 keys,
    // emit `create_at` (BE reads row.createAt). Guard JSON.parse (BE throws on bad
    // data -> 500; we degrade to empty fields instead — safer, happy path identical).
    const out = rows.map((r) => {
      let json: any = {}
      try {
        json = JSON.parse(r.result)
      } catch {
        json = {}
      }
      return {
        url: json.url,
        code: r.code,
        emoji: json.emoji,
        title: json.title,
        description: json.description,
        create_at: r.createAt,
      }
    })
    return res.status(200).json(out)
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
