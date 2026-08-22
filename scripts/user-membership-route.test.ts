// #383 — teeth for the `membership` composite that /api/user now returns. MAIN lane (pre-push gate); mocks
// ONLY the DB transport, so the route's own composition — which rows it reads, how it maps them, what it
// does when the v2 lookup fails — runs for real.
//
// WHY a route spec and not just the pure unit: the pure rule (lib/v2/subscription) already has its own
// teeth. What is NEW here is the WIRING, and every interesting failure lives in the wiring:
//   • the legacy row arrives snake_case from a raw `SELECT *`, while classifyMembership takes camelCase
//   • the v2 lookup must fail ALONE, without taking the v1 money route down with it
//   • no pre-existing key may move
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MR1  the raw member_payment row is handed to classifyMembership unmapped   → ① red (every paying
//        member of today would silently read isPaid:false / source:'none')
//   MR2  readSubRows loses its own try/catch (the v2 error joins the outer one) → ④ red (500 for v1)
//   MR3  the v2 lookup failure answers `{ isPaid: false }` instead of null      → ④ red
//   MR4  `membership` is dropped from the response, or an existing key is moved → ⑤ red
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

const h = vi.hoisted(() => {
  const state = {
    // rows returned by the 4 reads, in the order the handler issues them
    user: { user_id: 'u1', name: 'ผู้ใช้', picture_url: null, used_point: '3', total_point: '20' } as Record<string, unknown> | undefined,
    memberPayment: null as Record<string, unknown> | null,
    friendCount: 2,
    fortuneCount: 5,
    subRows: [] as Array<Record<string, unknown>>,
    subThrows: false,
  }
  return { state }
})

vi.mock('@/lib/db', () => ({
  db: {
    // The handler issues its raw reads in a fixed order: (1) user, then in ONE Promise.all
    // (2) member_payment, (3) friend count, (4) fortune count. Serving them by call order keeps the mock
    // free of SQL string-matching (which would break on any harmless formatting change).
    execute: vi.fn(async () => {
      const n = (h.state as unknown as { _n?: number })._n ?? 0
      ;(h.state as unknown as { _n?: number })._n = n + 1
      if (n === 0) return h.state.user ? [h.state.user] : []
      if (n === 1) return h.state.memberPayment ? [h.state.memberPayment] : []
      if (n === 2) return [{ n: h.state.friendCount }]
      return [{ n: h.state.fortuneCount }]
    }),
    select: () => ({
      from: () => ({
        where: async () => {
          if (h.state.subThrows) throw new Error('relation "member_subscription" does not exist')
          return h.state.subRows
        },
      }),
    }),
  },
}))

import handler from '@/pages/api/user'

const FUTURE = '2099-12-31'
const PAST = '2000-01-01'

function reset(patch: Partial<typeof h.state> = {}) {
  Object.assign(h.state, {
    user: { user_id: 'u1', name: 'ผู้ใช้', picture_url: null, used_point: '3', total_point: '20' },
    memberPayment: null,
    friendCount: 2,
    fortuneCount: 5,
    subRows: [],
    subThrows: false,
  }, patch)
  ;(h.state as unknown as { _n?: number })._n = 0
}

async function call() {
  const req = { method: 'GET', query: { user_id: 'u1' } } as unknown as NextApiRequest
  const captured: { code?: number; body?: any } = {}
  const res = {
    status(code: number) {
      captured.code = code
      return this
    },
    json(body: unknown) {
      captured.body = body
      return this
    },
  } as unknown as NextApiResponse
  await handler(req, res)
  return captured
}

const subRow = (over: Record<string, unknown> = {}) => ({
  id: 'sub-1',
  tierCode: 'PRO',
  status: 'ACTIVE',
  expireAt: FUTURE,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...over,
})

beforeEach(() => reset())

describe('#383 /api/user → membership composite', () => {
  // ① 🔴 THE CASE EVERY PAYING MEMBER IS IN TODAY. Also the MR1 detector: the row comes back snake_case
  // from `SELECT *`, so an unmapped hand-off classifies them as NO_PLAN and they read as free.
  it('🔴 ① legacy member (member_payment only) → { isPaid: true, tier: null, source: "legacy" }', async () => {
    reset({ memberPayment: { user_id: 'u1', plan_code: 'MEMBER', expire_at: FUTURE } })
    const { code, body } = await call()
    expect(code).toBe(200)
    expect(body.membership).toEqual({ isPaid: true, tier: null, source: 'legacy' })
    // and the legacy flag the whole app already gates on is still true — the two never disagree here
    expect(body.payment.is_not_expired).toBe(true)
  })

  it('② live v2 row → the NAME travels ({ isPaid: true, tier: "PRO", source: "v2" })', async () => {
    reset({
      memberPayment: { user_id: 'u1', plan_code: 'MEMBER', expire_at: FUTURE }, // the shadow row the writer always makes
      subRows: [subRow()],
    })
    const { body } = await call()
    expect(body.membership).toEqual({ isPaid: true, tier: 'PRO', source: 'v2' })
  })

  it('③ free user (no payment row, no v2 row) → { isPaid: false, tier: null, source: "none" }', async () => {
    const { body } = await call()
    expect(body.membership).toEqual({ isPaid: false, tier: null, source: 'none' })
  })

  it('③b expired member → source "legacy", isPaid false (expiry is decided at READ time)', async () => {
    reset({ memberPayment: { user_id: 'u1', plan_code: 'MEMBER', expire_at: PAST } })
    const { body } = await call()
    expect(body.membership).toEqual({ isPaid: false, tier: null, source: 'legacy' })
  })

  it('③c an EXPIRED v2 row falls back to the legacy verdict — never to free', async () => {
    reset({
      memberPayment: { user_id: 'u1', plan_code: 'MEMBER', expire_at: FUTURE },
      subRows: [subRow({ expireAt: PAST })],
    })
    const { body } = await call()
    expect(body.membership).toEqual({ isPaid: true, tier: null, source: 'legacy' })
  })

  // ④ 🔴 CONDITION ③ OF THE TICKET. The v2 table is the newest thing in this route; /api/user is what every
  // v1 page that takes real money calls. A failure there must cost the NAME, not the route.
  it('🔴 ④ the v2 lookup THROWS → 200, membership null (NOT false), every v1 key intact', async () => {
    reset({ memberPayment: { user_id: 'u1', plan_code: 'MEMBER', expire_at: FUTURE }, subThrows: true })
    const { code, body } = await call()
    expect(code).toBe(200) // ← the whole point: v1 does not 500 because a v2 table hiccuped
    expect(body.membership).toBe(null) // ← "not determined", never a guessed free
    expect(body.payment.is_not_expired).toBe(true)
    expect(body.payment.limit_friend).toBe(20)
    expect(body.user_id).toBe('u1')
  })

  // ⑤ MR4 — the promise made in the ticket: a PURE ADDITION. Same free-user response as before #383, plus
  // one key. (limit_friend 20 = FREE_FRIEND_LIMIT since #262, limit_fortune 1, counts passed through,
  // bigints coerced.)
  it('⑤ pure addition: every pre-#383 key keeps its exact value, and `membership` is the only new one', async () => {
    const { body } = await call()
    expect(body.payment).toEqual({
      total_friend: 2,
      limit_friend: 20,
      limit_fortune: 1,
      total_fortune: 5,
      is_not_expired: false,
    })
    expect(body.used_point).toBe(3) // bigint-as-string → number (TypeORM parity), untouched by #383
    expect(body.total_point).toBe(20)
    expect(Object.keys(body).sort()).toEqual(
      ['membership', 'name', 'payment', 'picture_url', 'total_point', 'used_point', 'user_id'].sort(),
    )
  })

  it('missing user still answers 400 (the guard above the composite is unchanged)', async () => {
    reset({ user: undefined })
    const { code, body } = await call()
    expect(code).toBe(400)
    expect(body.membership).toBeUndefined()
  })
})
