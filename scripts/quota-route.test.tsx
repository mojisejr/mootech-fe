// Teeth on the /api/quota route + the checkMatchingQuota/checkFriendQuota wiring (#264). Mocks only
// @/lib/db (by which TABLE is queried, so a swapped table/limit is caught), exercising the real
// quotaRemaining + membership logic. The year-WINDOW format itself is pinned separately in
// usage-core.test.ts (yearWindow). .tsx = invisible to ci.yml's tsx lane; runs via vitest include.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// membership row (member_payment) + per-table counts the mock db returns.
const state: { membership: any[]; matchingCount: number; friendCount: number } = {
  membership: [],
  matchingCount: 0,
  friendCount: 0,
}

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  const makeQuery = () => {
    const q: any = { _table: null }
    q.from = (t: any) => ((q._table = t), q)
    q.where = () => q
    // resolveMembership ends its chain in .limit(1) -> member_payment row(s)
    q.limit = () => Promise.resolve(state.membership)
    // count path: select({n}).from().where() is awaited directly -> resolve by table
    q.then = (resolve: any) => {
      if (q._table === schema.userMatching) return resolve([{ n: state.matchingCount }])
      if (q._table === schema.memberWithFriend) return resolve([{ n: state.friendCount }])
      return resolve([])
    }
    return q
  }
  return { db: { select: () => makeQuery() }, schema }
})

import handler from '@/pages/api/quota/index'

const makeRes = () => {
  const res: any = { statusCode: 0, payload: null }
  res.status = (c: number) => ((res.statusCode = c), res)
  res.json = (b: any) => ((res.payload = b), res)
  return res
}
const run = async (query: any = { user_id: 'u1' }, method = 'GET') => {
  const res = makeRes()
  await handler({ method, query } as any, res)
  return res
}

describe('/api/quota — both quotas remaining (#264)', () => {
  beforeEach(() => {
    state.membership = []
    state.matchingCount = 0
    state.friendCount = 0
  })

  it('free user -> matching capped(100)/friend capped(20), remaining computed per table', async () => {
    state.membership = [] // no member_payment -> free
    state.matchingCount = 3
    state.friendCount = 19
    const res = await run()
    expect(res.statusCode).toBe(200)
    expect(res.payload.matching).toEqual({ unlimited: false, limit: 100, used: 3, remaining: 97 })
    expect(res.payload.friend).toEqual({ unlimited: false, limit: 20, used: 19, remaining: 1 })
  })

  it('member -> matching UNLIMITED, friend still capped(20)', async () => {
    state.membership = [{ planCode: 'MEMBER', expireAt: '2099-01-01' }]
    state.matchingCount = 500
    state.friendCount = 5
    const res = await run()
    expect(res.payload.matching).toEqual({ unlimited: true, used: 500 })
    expect(res.payload.friend).toEqual({ unlimited: false, limit: 20, used: 5, remaining: 15 })
  })

  it('free user who used everything -> remaining 0, never negative', async () => {
    state.matchingCount = 130 // over the old ceiling
    state.friendCount = 20
    const res = await run()
    expect(res.payload.matching.remaining).toBe(0)
    expect(res.payload.friend.remaining).toBe(0)
  })

  it('missing user_id -> 400', async () => {
    const res = await run({})
    expect(res.statusCode).toBe(400)
  })

  it('non-GET -> 405', async () => {
    const res = await run({ user_id: 'u1' }, 'POST')
    expect(res.statusCode).toBe(405)
  })
})
