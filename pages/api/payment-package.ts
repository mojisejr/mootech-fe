// MIGRATED from NestJS GET /payment-package (-> getPaymentPackage)  (Phase 4 DB-only batch)
// Pure read: findOne payment_package by package_code. Returns the row or null.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const code = (req.query.code as string) ?? ''
  try {
    const row = rowsOf(
      await db.execute(sql`SELECT * FROM payment_package WHERE package_code = ${code} LIMIT 1`),
    )[0]
    if (row) {
      // bigint cols come back as strings via postgres.js -> coerce (TypeORM parity)
      for (const k of ['id', 'buffer_day', 'max_user']) {
        if (row[k] != null) row[k] = Number(row[k])
      }
    }
    return res.status(200).json(row ?? null)
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
