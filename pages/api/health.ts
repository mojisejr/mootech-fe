// GET /api/health — the container's liveness/readiness surface (mumate-infra-move-001 slice 1).
//
// middleware.ts has allow-listed this path through the maintenance gate since #605, but until now nothing
// answered here. A health route that only returns a constant would let an orchestrator route traffic to a
// container whose database is unreachable; this one runs a real `select 1` through the same client every
// API route uses (lib/db) and answers 503 when it fails. Nothing about the connection is echoed. The SHA is
// the build-time argument (Dockerfile), so every running container names the revision it was built from.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export type HealthBody = {
  status: 'ok' | 'degraded'
  service: 'mootech-fe'
  db: 'ok' | 'error'
  dbLatencyMs: number
  sha: string | null
  uptimeSec: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<HealthBody | { error: string }>) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).json({ error: 'method not allowed' })
  }
  const startedAt = Date.now()
  let dbStatus: HealthBody['db'] = 'ok'
  try {
    await db.execute(sql`select 1`)
  } catch {
    dbStatus = 'error'
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(dbStatus === 'ok' ? 200 : 503).json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    service: 'mootech-fe',
    db: dbStatus,
    dbLatencyMs: Date.now() - startedAt,
    sha: process.env.APP_GIT_SHA ?? null,
    uptimeSec: Math.round(process.uptime()),
  })
}
