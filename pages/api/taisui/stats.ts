// GET /api/taisui/stats — how many members have a saved birth date (a count only, cached for an hour).
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { isTaisuiOpen } from '@/lib/taisui/live'

let cache: { at: number; members: number } | null = null
const TTL_MS = 60 * 60 * 1000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isTaisuiOpen()) return res.status(404).json({ error: 'not_found' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const r = (await db.execute(sql`SELECT count(*)::int AS n FROM "user" WHERE dob IS NOT NULL AND dob <> ''`)) as unknown
      const rows = Array.isArray(r) ? r : ((r as { rows?: Array<{ n?: number }> }).rows ?? [])
      cache = { at: Date.now(), members: Number(rows[0]?.n ?? 0) }
    }
    res.setHeader('Cache-Control', 'public, max-age=600')
    return res.status(200).json({ members: cache.members, asOf: new Date(cache.at).toISOString() })
  } catch (e) {
    console.error('[taisui/stats] failed', e instanceof Error ? e.name : 'unknown')
    return res.status(502).json({ error: 'upstream' })
  }
}
