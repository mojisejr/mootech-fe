// Teeth on the SHIP PATH the FE add-friend button gates on (#262 round 2, ตู๋ request-changes).
// pages/api/user.ts is what prod actually reads (constants/api/endpoint.ts: API.user.get -> localApi
// '/user'), NOT NestJS. matching/index.tsx:128 gates the button on total_friend >= payment.limit_friend,
// so if limit_friend stays 1 a free user with 1 friend can never reach the raised 20 ceiling — BE would
// accept the friend but the user never gets to the button. ตู๋ proved this line had ZERO teeth (140/140
// green with it reverted). This calls the real handler with only @/lib/db mocked, so reverting the free
// value (or FREE_FRIEND_LIMIT) turns it red. .tsx = invisible to ci.yml's tsx lane; runs via vitest include.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// db.execute is called in a fixed order: (1) user row, then Promise.all[(2) member_payment, (3) friend
// count, (4) fortune count]. We queue results in that order per test.
const q: { results: any[]; i: number } = { results: [], i: 0 }

vi.mock('@/lib/db', () => ({
  db: { execute: () => Promise.resolve(q.results[q.i++]) },
  schema: {},
}))

import handler from '@/pages/api/user'

const makeRes = () => {
  const res: any = { statusCode: 0, payload: null }
  res.status = (c: number) => ((res.statusCode = c), res)
  res.json = (b: any) => ((res.payload = b), res)
  return res
}
const run = async () => {
  q.i = 0
  const req: any = { method: 'GET', query: { user_id: 'u1' } }
  const res = makeRes()
  await handler(req, res)
  return res
}

describe('/api/user limit_friend — free ceiling raised to 20 (#262, the FE-button read-path)', () => {
  beforeEach(() => {
    q.i = 0
  })

  it('free user (no member_payment) -> payment.limit_friend === 20', async () => {
    q.results = [
      [{ user_id: 'u1', used_point: null, total_point: null }], // user
      [], // member_payment -> null -> isFree
      [{ n: 1 }], // friend count (1 friend — the exact case that was blocked at limit 1)
      [{ n: 0 }], // fortune count
    ]
    const res = await run()
    expect(res.statusCode).toBe(200)
    expect(res.payload.payment.limit_friend).toBe(20)
    // FE button: total_friend(1) >= limit_friend(20) === false -> button ENABLED (the fix)
    expect(res.payload.payment.total_friend >= res.payload.payment.limit_friend).toBe(false)
  })

  it('active member -> payment.limit_friend === 20 (member ceiling untouched)', async () => {
    q.results = [
      [{ user_id: 'u2', used_point: null, total_point: null }],
      [{ plan_code: 'MEMBER', expire_at: '2099-01-01' }], // member_payment -> not free
      [{ n: 5 }],
      [{ n: 0 }],
    ]
    const res = await run()
    expect(res.statusCode).toBe(200)
    expect(res.payload.payment.limit_friend).toBe(20)
  })
})
