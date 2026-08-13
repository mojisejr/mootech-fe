// Teeth on the failure-classification logic (#263): calculateCompatibility must map the status-aware
// API result to a distinct reason (quota / system / network), NOT collapse them into one blob like the
// old code did. Reverting the split (e.g. always returning 'system') turns the quota + network cases red.
// Mocks only the API module — this exercises the real classification branch. .tsx = invisible to ci.yml's
// tsx lane; runs via vitest.config.mts include.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// endpoint.ts (pulled in transitively via api-user-matching-get-detail) calls next/config's getConfig()
// at module load — undefined under vitest. Stub it so the module graph loads (same pattern as
// tier-prod-pages.test.tsx). We mock the calculate API itself, so no real endpoint URL is used.
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

vi.mock('@/constants/api/api-user-matching-calculate', () => ({
  UserMatchingCalculateWithStatusApi: vi.fn(),
}))

import { calculateCompatibility } from '@/features/v2-service/hooks/useCompatibilityResult'
import { UserMatchingCalculateWithStatusApi } from '@/constants/api/api-user-matching-calculate'

const mockCalc = vi.mocked(UserMatchingCalculateWithStatusApi)
const p1: any = { id: 'u1', name: 'A', dob: '1990-01-01', time: '12:00' }
const p2: any = { id: 'u2', name: 'B', dob: '1992-02-02', time: '08:30' }
const run = () => calculateCompatibility(p1, p2, 'LOVE' as any)

describe('calculateCompatibility — distinct failure reasons (#263)', () => {
  beforeEach(() => mockCalc.mockReset())

  it('2xx with matching_id -> ok + matchingId', async () => {
    mockCalc.mockResolvedValue({ ok: true, status: 200, data: { matching_id: 'm1' } } as any)
    expect(await run()).toEqual({ ok: true, matchingId: 'm1' })
  })

  it('410 GONE -> reason quota (the whole point: not "try again")', async () => {
    mockCalc.mockResolvedValue({ ok: false, kind: 'http', status: 410, data: { code: 404 } } as any)
    const r = await run()
    expect(r.ok).toBe(false)
    expect((r as any).reason).toBe('quota')
  })

  it('500 -> reason system', async () => {
    mockCalc.mockResolvedValue({ ok: false, kind: 'http', status: 500, data: {} } as any)
    expect((await run() as any).reason).toBe('system')
  })

  it('503 (other 5xx) -> reason system', async () => {
    mockCalc.mockResolvedValue({ ok: false, kind: 'http', status: 503, data: {} } as any)
    expect((await run() as any).reason).toBe('system')
  })

  it('no response -> reason network', async () => {
    mockCalc.mockResolvedValue({ ok: false, kind: 'network', error: new Error('Network Error') } as any)
    expect((await run() as any).reason).toBe('network')
  })

  it('2xx but no matching_id (BE contract violation) -> reason system, never ok', async () => {
    mockCalc.mockResolvedValue({ ok: true, status: 200, data: {} } as any)
    const r = await run()
    expect(r.ok).toBe(false)
    expect((r as any).reason).toBe('system')
  })

  it('missing person id -> reason system, API not even called', async () => {
    const r = await calculateCompatibility({ name: 'x' } as any, p2, 'LOVE' as any)
    expect(r.ok).toBe(false)
    expect((r as any).reason).toBe('system')
    expect(mockCalc).not.toHaveBeenCalled()
  })
})
