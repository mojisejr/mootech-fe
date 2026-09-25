// GET /api/health — the container's liveness/readiness surface (mumate-infra-move-001 slice 1).
//
// middleware.ts has allow-listed this path through the maintenance gate since #605, but until now nothing
// answered here. A health route that only returns a constant would let an orchestrator route traffic to a
// container whose database is unreachable; this one runs a real `select 1` through the same client every
// API route uses (lib/db) and answers 503 when it fails. Nothing about the connection is echoed. The SHA is
// the build-time argument (Dockerfile), so every running container names the revision it was built from.
//
// 🔴 THE PROBE IS BOUNDED, AND THE BOUND IS THE WHOLE POINT (added 2026-09-24 after the shadow fault).
// This route used to `await db.execute(...)` inside a bare try/catch. A REJECTION reached the 503 below;
// a HANG did not — it hung with the request, and the orchestrator saw neither 200 nor 503, only a timeout
// it could not attribute. A hang is not a hypothetical here: it is the only database failure this stack
// has actually produced. On the shadow, pages answered in 17 ms while every database route waited on a
// queue that was never dispatched and never rejected. So the route now races the probe against a deadline
// and treats "did not answer in time" as exactly what it is — a database this container cannot serve from.
//
// The race is local on purpose. A server-side statement_timeout would be the tidier instrument, but it
// travels as a startup parameter and Supabase's transaction pooler may reject those; that is unverified,
// and a health route must not depend on an unverified mechanism to report that something is wrong.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

// Generous against a slow pooler, far below any sensible orchestrator or probe timeout, so the answer is
// ours rather than the caller's. Read PER REQUEST, not once at module scope: a module-scope constant is
// fixed at import time, so setting the variable later does nothing and does so SILENTLY — the same shape
// of quiet trap this whole repair exists to remove. Caught by the hang test, which measured 5005 ms
// against its own 120 ms budget while the value looked correct in the source.
const dbProbeTimeoutMs = () => Number(process.env.HEALTH_DB_TIMEOUT_MS ?? 5000)

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
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('db probe timed out')), dbProbeTimeoutMs())
      }),
    ])
  } catch {
    dbStatus = 'error'
  } finally {
    // the losing branch of a race is not cancelled; without this the timer keeps the event loop alive
    if (timer) clearTimeout(timer)
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
