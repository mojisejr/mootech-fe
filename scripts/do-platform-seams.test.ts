// mumate-vercel-to-do-001 slice 2, step 4 — FE seams that Vercel used to cover:
//   · QStash's /api/v2/push/fire passes the maintenance gate and guardV2 (exact path only)
//   · /api/health names the platform, the environment and the SHA
//   · the what-if proxy follows BAZI_BASE_URL instead of a hard-coded Vercel host
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({ db: { execute: vi.fn(async () => [{ '?column?': 1 }]) } }))

import { middleware } from '../middleware'
import { platformOf } from '@/pages/api/health'
import healthHandler from '@/pages/api/health'
import { whatIfUpstreamUrl } from '@/pages/api/what-if/generate'

const req = (path: string) => new NextRequest(new URL('http://localhost' + path))
const passes = (res: Response) => res.headers.get('x-middleware-rewrite') == null && res.headers.get('location') == null && res.status < 400
const toMaintenance = (res: Response) => (res.headers.get('x-middleware-rewrite') || '').includes('/maintenance')

afterEach(() => vi.unstubAllEnvs())

describe('/api/v2/push/fire through the gates', () => {
  it('maintenance on: the exact path passes, look-alikes stay gated', () => {
    vi.stubEnv('MAINTENANCE_MODE', 'on')
    vi.stubEnv('MAINTENANCE_BYPASS_KEY', 'k')
    expect(passes(middleware(req('/api/v2/push/fire')) as Response)).toBe(true)
    expect(toMaintenance(middleware(req('/api/v2/push/fire/x')) as Response)).toBe(true)
    expect(toMaintenance(middleware(req('/api/v2/push/firex')) as Response)).toBe(true)
    expect(toMaintenance(middleware(req('/api/v2/push/subscribe')) as Response)).toBe(true)
  })

  it('preview gate on: the exact path passes without the v2 cookie, others still 401', () => {
    vi.stubEnv('MAINTENANCE_MODE', 'off')
    vi.stubEnv('V2_PREVIEW_KEY', 'preview')
    expect(passes(middleware(req('/api/v2/push/fire')) as Response)).toBe(true)
    expect((middleware(req('/api/v2/push/subscribe')) as Response).status).toBe(401)
  })
})

describe('/api/health names where it runs', () => {
  it('on Vercel: platform vercel, env vercel-<VERCEL_ENV>, Vercel commit SHA', () => {
    expect(platformOf({ VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'abc' })).toEqual({
      platform: 'vercel', env: 'vercel-production', sha: 'abc',
    })
  })

  it('in a container: platform container, MUMATE_ENV, the build-arg SHA', () => {
    expect(platformOf({ MUMATE_ENV: 'staging', APP_GIT_SHA: 'fd3220b' })).toEqual({
      platform: 'container', env: 'staging', sha: 'fd3220b',
    })
    expect(platformOf({})).toEqual({ platform: 'container', env: null, sha: null })
  })

  it('the response carries the marker as headers and body fields', async () => {
    vi.stubEnv('MUMATE_ENV', 'staging')
    vi.stubEnv('APP_GIT_SHA', 'fd3220b')
    const headers: Record<string, string> = {}
    let body: Record<string, unknown> = {}
    const res = {
      setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v },
      status: () => res,
      json: (b: Record<string, unknown>) => { body = b; return res },
    }
    await healthHandler({ method: 'GET' } as never, res as never)
    expect(headers['x-mumate-platform']).toBe('container')
    expect(headers['x-mumate-env']).toBe('staging')
    expect(body).toMatchObject({ status: 'ok', platform: 'container', env: 'staging', sha: 'fd3220b' })
  })
})

describe('what-if upstream', () => {
  it('follows BAZI_BASE_URL (container: http://bazi:3000)', () => {
    expect(whatIfUpstreamUrl({ BAZI_BASE_URL: 'http://bazi:3000/' })).toBe('http://bazi:3000/api/what-if/generate')
  })
  it('Vercel path unchanged: BAZI_BASE_URL there is the Vercel engine host, BAZI_WHATIF_URL still wins', () => {
    expect(whatIfUpstreamUrl({ BAZI_BASE_URL: 'https://bazi-sft-dataset.vercel.app' })).toBe(
      'https://bazi-sft-dataset.vercel.app/api/what-if/generate',
    )
    expect(whatIfUpstreamUrl({ BAZI_WHATIF_URL: 'https://x.test/w', BAZI_BASE_URL: 'http://bazi:3000' })).toBe('https://x.test/w')
    expect(whatIfUpstreamUrl({})).toBe('https://bazi-sft-dataset.vercel.app/api/what-if/generate')
  })
})
