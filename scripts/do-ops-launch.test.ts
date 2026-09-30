// mumate-vercel-to-do-001 slice 2, step 6 — off Vercel: /launch is disarmed (owner decision C) and /ops reports the
// container's own /api/health instead of the Vercel deployment. On Vercel both behave as before.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isLaunchArmed } from '@/lib/launch/vercel'
import { fetchContainerHealth, fetchSystemHealth } from '@/lib/ops/health'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('isLaunchArmed', () => {
  const keys = { VERCEL_TOKEN: 't', LAUNCH_DEPLOY_HOOK_URL: 'https://api.vercel.com/v1/integrations/deploy/x' }
  it('Vercel path unchanged: armed when both keys are set, missing ones listed otherwise', () => {
    expect(isLaunchArmed({ VERCEL: '1', ...keys })).toEqual({ armed: true, missing: [], offVercel: false })
    expect(isLaunchArmed({ VERCEL: '1' })).toEqual({ armed: false, missing: ['VERCEL_TOKEN', 'LAUNCH_DEPLOY_HOOK_URL'], offVercel: false })
  })
  it('off Vercel: disarmed even with every key set', () => {
    expect(isLaunchArmed({ ...keys })).toEqual({ armed: false, missing: [], offVercel: true })
  })
})

describe('POST /api/launch/go off Vercel', () => {
  it('answers 409 and never calls Vercel', async () => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('LAUNCH_KEY', 'k')
    vi.stubEnv('VERCEL_TOKEN', 't')
    vi.stubEnv('LAUNCH_DEPLOY_HOOK_URL', 'https://api.vercel.com/v1/integrations/deploy/x')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('@/pages/api/launch/go')
    let code = 0
    let body: { error?: { message?: string } } = {}
    const res = { status: (c: number) => { code = c; return res }, json: (b: typeof body) => { body = b; return res } }
    await handler({ method: 'POST', cookies: { launch_access: 'k' }, query: {}, body: { confirm: true } } as never, res as never)
    expect(code).toBe(409)
    expect(body.error?.message).toContain('ไม่ได้รันบน Vercel')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('/ops FE health', () => {
  const json = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

  it('off Vercel: the container /api/health, naming env and SHA', async () => {
    const f = json(200, { db: 'ok', env: 'staging', sha: 'fd3220be01ab' })
    const h = await fetchContainerHealth({ PORT: '3000' }, f as never)
    expect(f.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/health')
    expect(h.status).toBe('ok')
    expect(h.detail).toContain('staging · fd3220b')
  })

  it('off Vercel: 503 or unreachable is bad, never green', async () => {
    expect((await fetchContainerHealth({}, json(503, { db: 'error' }) as never)).status).toBe('bad')
    const down = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    expect((await fetchContainerHealth({}, down as never)).status).toBe('bad')
  })

  it('fetchSystemHealth picks the container card off Vercel and the Vercel card on Vercel', async () => {
    const f = json(200, { db: 'ok', env: 'staging', sha: 'x' })
    vi.stubGlobal('fetch', f)
    expect((await fetchSystemHealth({})).fe.detail).toContain('healthy')
    expect((await fetchSystemHealth({ VERCEL: '1' })).fe.detail).toBe('VERCEL_TOKEN not configured')
  })
})
