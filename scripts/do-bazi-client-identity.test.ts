// mumate-vercel-to-do-001 slice 2 (owner D) — FE ส่ง IP ผู้ใช้ + secret ไปให้ bazi เพื่อ rate limit รายผู้ใช้
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { baziClientHeaders } from '@/lib/bazi/client-identity'

const SECRET = 's'.repeat(43)

describe('baziClientHeaders', () => {
  it('Vercel path unchanged: no secret → sends nothing', () => {
    expect(baziClientHeaders({ headers: { 'x-forwarded-for': '203.0.113.9' } }, {})).toEqual({})
  })

  it('secret set → the first x-forwarded-for entry and the secret', () => {
    expect(
      baziClientHeaders({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.2' } }, { BAZI_CLIENT_ID_SECRET: SECRET }),
    ).toEqual({ 'x-mumate-client-ip': '203.0.113.9', 'x-mumate-client-secret': SECRET })
  })

  it('no client address known → sends nothing rather than "unknown"', () => {
    expect(baziClientHeaders({ headers: {} }, { BAZI_CLIENT_ID_SECRET: SECRET })).toEqual({})
  })
})

describe('the BFF that proxies to a rate-limited engine route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('POST /api/fortune/divine forwards the identity headers to the engine', async () => {
    vi.stubEnv('BAZI_CLIENT_ID_SECRET', SECRET)
    vi.stubEnv('BAZI_BASE_URL', 'http://bazi:3000')
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    // identity is not what this test is about (hardening slice 1 moved it onto the signed session)
    vi.doMock('@/lib/v2/resolve-user', () => ({
      resolveRouteMember: async () => ({ ok: true, userId: '11111111-2222-3333-4444-555555555555' }),
    }))
    const { default: handler } = await import('@/pages/api/fortune/divine')
    const res = { status: vi.fn(() => res), json: vi.fn(() => res) }
    await handler(
      {
        method: 'POST',
        cookies: { 'cookie-mumate-id': '11111111-2222-3333-4444-555555555555' },
        headers: { 'x-forwarded-for': '198.51.100.7' },
        body: {},
      } as never,
      res as never,
    )
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.headers).toMatchObject({ 'x-mumate-client-ip': '198.51.100.7', 'x-mumate-client-secret': SECRET })
  })

  it('every page that calls a rate-limited engine route sends the identity', () => {
    // engine routes behind guardServerLlm / checkRateLimit (bazi-sft-dataset, pdf-dev)
    const limited = [
      '/api/bazi/narrate', '/api/bazi/pair/rephrase', '/api/divine-cards/predict', '/api/fortune-sage/predict',
      '/api/honeycomb/narrate', '/api/manifest/insights', '/api/oracle-cards/predict', '/api/reading/topic',
      '/api/tarot/predict', '/api/what-if/generate', '/api/louise-hay/chat', '/api/louise-hay/tts',
    ]
    const callers = execFileSync('git', ['grep', '-l', '-E', limited.map((r) => r.replace(/\//g, '\\/')).join('|'), '--', 'pages/api', 'lib'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((f) => f && !f.endsWith('.sql') && readFileSync(f, 'utf8').includes('fetch('))
    expect(callers.length).toBeGreaterThan(0)
    expect(callers.filter((f) => !readFileSync(f, 'utf8').includes('baziClientHeaders(req)'))).toEqual([])
  })
})
