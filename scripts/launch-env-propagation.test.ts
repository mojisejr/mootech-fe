// 2026-09-20 — teeth on the goLive() race fix: env write must be CONFIRMED (readEnvState polling)
// before the deploy hook fires. Live incident (เอ็ม): a real go-live press produced a "Ready" +
// "Production" Vercel deployment that still baked MAINTENANCE_MODE=on, because redeploy() fired
// immediately after the env PATCH before Vercel's build pipeline actually saw the new value.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ENV_LIST_URL = 'https://api.vercel.com/v9/projects/prj_test123/env'
const DEPLOY_HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_test123/hook123'

function envListResponse(maintenanceValue: string | undefined) {
  const envs = [
    { id: 'env_maint', key: 'MAINTENANCE_MODE', value: maintenanceValue, target: ['production'] },
    { id: 'env_v2', key: 'V2_PREVIEW_KEY', value: 'secret', target: ['production'] },
  ]
  return new Response(JSON.stringify({ envs }), { status: 200 })
}

describe('lib/launch/vercel — goLive() waits for env propagation before redeploying', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    process.env.VERCEL_TOKEN = 'test-token'
    process.env.LAUNCH_DEPLOY_HOOK_URL = DEPLOY_HOOK
    process.env.VERCEL_PROJECT_ID = 'prj_test123'
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  it('polls readEnvState until MAINTENANCE_MODE=off is confirmed, THEN fires the deploy hook (not before)', async () => {
    const calls: string[] = []
    let envReadCount = 0

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url === ENV_LIST_URL && method === 'GET') {
        envReadCount += 1
        calls.push(`GET env #${envReadCount}`)
        // Simulate the real race: the first 2 reads still see the OLD value ("on"), only the 3rd
        // read reflects the write that already happened (upsertEnv's PATCH resolved before this).
        return envListResponse(envReadCount < 3 ? 'on' : 'off')
      }
      if (url.startsWith('https://api.vercel.com/v9/projects/prj_test123/env/env_maint') && method === 'PATCH') {
        calls.push('PATCH maintenance')
        return new Response(JSON.stringify({ id: 'env_maint' }), { status: 200 })
      }
      if (url.startsWith('https://api.vercel.com/v9/projects/prj_test123/env/env_v2') && method === 'DELETE') {
        calls.push('DELETE v2key')
        return new Response(null, { status: 200 })
      }
      if (url === DEPLOY_HOOK && method === 'POST') {
        calls.push('POST deployHook')
        return new Response(null, { status: 200 })
      }
      throw new Error(`unexpected fetch: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { goLive } = await import('@/lib/launch/vercel')
    const promise = goLive()
    // Drain the sleep()-based retry loop (5 attempts × 800ms default) under fake timers.
    await vi.advanceTimersByTimeAsync(5 * 800)
    await promise

    const deployIndex = calls.indexOf('POST deployHook')
    const thirdEnvReadIndex = calls.indexOf('GET env #3')
    expect(deployIndex).toBeGreaterThan(-1)
    expect(thirdEnvReadIndex).toBeGreaterThan(-1)
    // The deploy hook must fire AFTER the read that actually confirms "off" — this is the fix.
    expect(deployIndex).toBeGreaterThan(thirdEnvReadIndex)
    // And it must have polled more than once (not fired on the very first, still-stale read).
    expect(envReadCount).toBeGreaterThanOrEqual(3)
  })

  it('is best-effort: still fires the deploy hook even if propagation never confirms within the retry budget', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'
      if (url === ENV_LIST_URL && method === 'GET') {
        calls.push('GET env (stale forever)')
        return envListResponse('on') // never confirms — simulates a genuinely slow/stuck propagation
      }
      if (url.includes('/env/env_maint') && method === 'PATCH') return new Response('{}', { status: 200 })
      if (url.includes('/env/env_v2') && method === 'DELETE') return new Response(null, { status: 200 })
      if (url === DEPLOY_HOOK && method === 'POST') {
        calls.push('POST deployHook')
        return new Response(null, { status: 200 })
      }
      throw new Error(`unexpected fetch: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { goLive } = await import('@/lib/launch/vercel')
    const promise = goLive()
    await vi.advanceTimersByTimeAsync(5 * 800)
    await expect(promise).resolves.toBeUndefined()
    expect(calls).toContain('POST deployHook')
  })
})
