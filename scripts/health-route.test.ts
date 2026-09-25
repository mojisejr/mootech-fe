// mumate-infra-move-001 slice 1 — GET /api/health must prove the database, not return a constant.
//
// ANCHOR: scripts/health-route.test.ts#health-is-a-real-round-trip
// Bug-class this owns: a "health" endpoint that is green while the app cannot serve a single request. The
// route is what a container HEALTHCHECK / Caddy / compose will poll, so a constant here would let a broken
// container keep receiving production traffic during the DigitalOcean move. Both branches are asserted
// through the repo's single DB client (lib/db), mocked at the module boundary.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 🔴 'hang' IS WHY THIS FILE WAS REWRITTEN. The original faked failure only as
// Promise.reject(ECONNREFUSED) — it proved the one path the real fault never took. The bug class above
// says "green while the app cannot serve a single request", and the fault that actually happened on the
// shadow was not green and not red: the route hung with the request, because the probe had no bound. A
// rejection test passes against code that can hang forever, which is exactly how the defect survived.
const state: { mode: 'ok' | 'reject' | 'hang'; calls: number } = { mode: 'ok', calls: 0 }

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/lib/db', () => ({
  db: {
    execute: () => {
      state.calls += 1
      if (state.mode === 'reject') return Promise.reject(new Error('ECONNREFUSED'))
      // never settles — no resolve, no reject, no timer. The queued-query fault, exactly.
      if (state.mode === 'hang') return new Promise(() => {})
      return Promise.resolve([{ '?column?': 1 }])
    },
  },
}))

import handler from '@/pages/api/health'

function run(method = 'GET') {
  const res: any = { headers: {} as Record<string, string>, statusCode: 0, body: undefined }
  res.setHeader = (k: string, v: string) => ((res.headers[k] = v), res)
  res.status = (c: number) => ((res.statusCode = c), res)
  res.json = (b: unknown) => ((res.body = b), res)
  return handler({ method } as any, res).then(() => res)
}

beforeEach(() => {
  state.mode = 'ok'
  state.calls = 0
  process.env.HEALTH_DB_TIMEOUT_MS = '120'
})

describe('GET /api/health', () => {
  it('answers 200 ok only after a real select 1 through lib/db', async () => {
    const res = await run()
    expect(state.calls).toBe(1)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', service: 'mootech-fe', db: 'ok' })
    expect(res.headers['Cache-Control']).toBe('no-store')
  })

  it('answers 503 degraded when the database is unreachable — never a constant green', async () => {
    state.mode = 'reject'
    const res = await run()
    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({ status: 'degraded', db: 'error' })
    expect(JSON.stringify(res.body)).not.toMatch(/postgres(ql)?:\/\/|DATABASE_URL/i)
  })

  // 🔴 THE TEST THE ROUTE WAS MISSING. It fails against the pre-2026-09-24 handler, which awaited the probe
  // with no bound: there the handler never settles, so this assertion never runs and the spec times out
  // instead of failing cleanly. That is the point — a hang must become an ANSWER, and a 503 is the only
  // honest one a container can give about a database it cannot reach.
  it('answers 503 when the database HANGS rather than rejecting — and answers within the budget', async () => {
    state.mode = 'hang'
    const startedAt = Date.now()
    const res = await run()
    const elapsed = Date.now() - startedAt
    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({ status: 'degraded', db: 'error' })
    // bounded by the route's own deadline, not by the caller giving up
    expect(elapsed).toBeLessThan(2000)
    expect(JSON.stringify(res.body)).not.toMatch(/postgres(ql)?:\/\/|DATABASE_URL/i)
  })

  it('reports the build SHA the image was built with, and refuses non-GET', async () => {
    const prev = process.env.APP_GIT_SHA
    process.env.APP_GIT_SHA = 'abc1234'
    try {
      expect((await run()).body.sha).toBe('abc1234')
    } finally {
      if (prev === undefined) delete process.env.APP_GIT_SHA
      else process.env.APP_GIT_SHA = prev
    }
    const res = await run('POST')
    expect(res.statusCode).toBe(405)
    expect(state.calls).toBe(1) // the POST never touched the database
  })
})
