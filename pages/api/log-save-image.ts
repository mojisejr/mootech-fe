// MIGRATED from NestJS POST /log-save-image  (Phase 1 DB-CRUD batch, #mootech-fullstack-supabase-fold)
// Pure insert -> Supabase via Drizzle. Parity target: LogSaveImageService.insertLogActivity.
// NestJS set only user_id + createAt (page defaults to 'PROFILE') then returned the saved entity.
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { logSaveImage } from '@/lib/db/schema'

// NestJS used MomentService 'YYYY-MM-DD HH:mm:ss' (Asia/Bangkok server). Match the format + TZ.
function nowBangkok(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const p: Record<string, string> = {}
  for (const part of parts) p[part.type] = part.value
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const userId = (req.body?.user_id as string) ?? ''
    const createAt = nowBangkok()

    const [row] = await db
      .insert(logSaveImage)
      .values({ userId, createat: createAt, page: 'PROFILE' })
      .returning()

    // NestJS returned the TypeORM entity: { id, user_id, createAt, page }. bigserial id -> coerce.
    return res.status(200).json({
      id: Number(row.id),
      user_id: row.userId,
      createAt: row.createat,
      page: row.page,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
