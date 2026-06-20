// MIGRATED from NestJS GET /survey/share-type (-> survey getResult)  (Phase 4 DB-only batch)
// Pure read: log_survey by code, return its parsed result. Parity: { data: JSON.parse(result.result) }.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const code = (req.query.code as string) ?? ''
  try {
    const row = rowsOf(
      await db.execute(sql`SELECT result FROM log_survey WHERE code = ${code} LIMIT 1`),
    )[0]
    if (!row) return res.status(200).json({ data: null })
    return res.status(200).json({ data: JSON.parse(row.result) })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
