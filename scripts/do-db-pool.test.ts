// mumate-vercel-to-do-001 slice 2, step 5 — the FE's DB pool size comes from DB_POOL_MAX, default 1 (Vercel unchanged)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dbPoolMax, POOLER_POOL_SIZE } from '@/lib/db/pool-size'

describe('dbPoolMax', () => {
  it('Vercel path unchanged: unset → 1', () => {
    expect(dbPoolMax({})).toBe(1)
  })
  it('a container sets it within the pooler size', () => {
    expect(dbPoolMax({ DB_POOL_MAX: '5' })).toBe(5)
    expect(dbPoolMax({ DB_POOL_MAX: String(POOLER_POOL_SIZE) })).toBe(15)
  })
  it('anything outside 1..15 or not an integer falls back to 1', () => {
    for (const v of ['', '0', '-3', '16', '2.5', 'ten']) expect(dbPoolMax({ DB_POOL_MAX: v })).toBe(1)
  })
})

describe('lib/db builds its one client with that size', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.doUnmock('postgres')
    vi.doUnmock('drizzle-orm/postgres-js')
    delete (globalThis as { _pg?: unknown })._pg
  })

  it('passes dbPoolMax() as postgres.js max, keeping prepare:false and ssl:require', async () => {
    vi.stubEnv('DB_POOL_MAX', '5')
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:6543/db')
    delete (globalThis as { _pg?: unknown })._pg
    const factory = vi.fn(() => Object.assign(() => undefined, { options: {} }))
    vi.doMock('postgres', () => ({ default: factory }))
    vi.doMock('drizzle-orm/postgres-js', () => ({ drizzle: vi.fn(() => ({})) }))
    await import('@/lib/db')
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory.mock.calls[0]).toEqual([
      'postgres://u:p@localhost:6543/db',
      expect.objectContaining({ max: 5, prepare: false, ssl: 'require' }),
    ])
  })
})
