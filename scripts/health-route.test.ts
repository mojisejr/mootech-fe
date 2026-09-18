// mumate-infra-move-001 slice 1 — GET /api/health must prove the database, not return a constant.
//
// ANCHOR: scripts/health-route.test.ts#health-is-a-real-round-trip
// Bug-class this owns: a "health" endpoint that is green while the app cannot serve a single request. The
// route is what a container HEALTHCHECK / Caddy / compose will poll, so a constant here would let a broken
// container keep receiving production traffic during the DigitalOcean move. Both branches are asserted
// through the repo's single DB client (lib/db), mocked at the module boundary.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: { fail: boolean; calls: number } = { fail: false, calls: 0 }

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/lib/db', () => ({
  db: {
    execute: () => {
      state.calls += 1
      return state.fail ? Promise.reject(new Error('ECONNREFUSED')) : Promise.resolve([{ '?column?': 1 }])
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
  state.fail = false
  state.calls = 0
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
    state.fail = true
    const res = await run()
    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({ status: 'degraded', db: 'error' })
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
