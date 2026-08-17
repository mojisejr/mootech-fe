// Teeth on the SERVER-SIDE ownership/identity gates of the two reminder handlers (goo · #287, added for
// ตู๋ #291 B1). The pure logic (time/plan/adapter/ambiguity) already had teeth; the GATES had none — 7
// mutants that gut a gate at the CALL SITE all passed CI. This spec imports both real handlers and mocks
// ONLY the transport (getServerSession + db + the drizzle operators), so the handler's own identity/
// membership/scope branching runs for real and each of those mutants goes RED.
//
// Mutants this file must kill (ตู๋'s set; anchors in the PR comment):
//   M1 reminders POST takes user_id from BODY instead of session   → insert must use the SESSION user
//   M2 reminders drops the 403 membership gate                     → a free user must get 403
//   M3 reminders DELETE loses its user_id scope                    → DELETE must be scoped by user_id
//   M4 reminders GET loses its user_id scope                       → GET must be scoped by user_id
//   M5 subscribe DELETE loses its user_id scope                    → DELETE must be scoped by user_id
//   M6 subscribe POST takes user_id from BODY instead of session   → insert must use the SESSION user
//   M7 resolve-user drops the 401 "not signed in" guard            → no session must get 401
// (M9 onConflictDoNothing is NOT covered here — ตู๋ proved the DB unique index enforces it; C1/C2/M8 are
//  covered by reminder-logic.test.tsx.)
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared, inspectable state + capture buckets — declared via vi.hoisted so the (hoisted) vi.mock
// factories below can close over them.
const h = vi.hoisted(() => {
  const state = {
    session: null as null | { providerId?: string; provider?: string },
    providerRows: [] as Array<{ user_id: string }>,
    isFree: false,
  }
  const captured = {
    insertValues: [] as any[], // every insert(...).values(arg)
    selectWhere: [] as any[], //  every select(...).where(cond) — GET + read-back
    deleteWhere: [] as any[], //  every delete(...).where(cond)
  }
  const thenable = (val: any) => ({ then: (res: (v: any) => any) => res(val) })
  const selectBuilder = (): any => {
    const q: any = {}
    q.from = () => q
    q.where = (cond: any) => (captured.selectWhere.push(cond), q)
    q.then = (res: (v: any) => any) => res([]) // resolves to zero rows; we assert on scope, not content
    return q
  }
  const insertBuilder = () => ({
    values: (v: any) => (
      captured.insertValues.push(v),
      {
        onConflictDoNothing: () => thenable(undefined),
        onConflictDoUpdate: () => thenable(undefined),
      }
    ),
  })
  const deleteBuilder = () => ({
    where: (cond: any) => (captured.deleteWhere.push(cond), thenable(undefined)),
  })
  const db: any = {
    execute: async () => state.providerRows, // resolve-user's raw user_provider lookup
    select: () => selectBuilder(),
    insert: () => insertBuilder(),
    delete: () => deleteBuilder(),
    transaction: async (fn: (tx: any) => any) => fn(db),
  }
  const getServerSession = vi.fn(async () => state.session)
  const resolveMembership = vi.fn(async () => ({
    isFree: state.isFree,
    reason: state.isFree ? 'NO_PLAN' : 'MEMBER',
    memberPayment: null,
  }))
  return { state, captured, db, getServerSession, resolveMembership }
})

vi.mock('next-auth/next', () => ({ getServerSession: h.getServerSession }))
// [...nextauth] pulls in every OAuth provider; getServerSession is mocked, so authOptions is inert here.
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {}, default: () => undefined }))
vi.mock('@/lib/db', () => ({ db: h.db }))
vi.mock('@/lib/usage', () => ({ resolveMembership: h.resolveMembership }))
// Make the drizzle operators inspectable so a where-clause's user_id scope is observable. sql (used by
// resolve-user's db.execute) and everything else stay real.
vi.mock('drizzle-orm', async (orig) => {
  const actual = await orig<any>()
  return {
    ...actual,
    eq: (col: any, val: any) => ({ __op: 'eq', col, val }),
    and: (...conds: any[]) => ({ __op: 'and', conds }),
    inArray: (col: any, vals: any) => ({ __op: 'in', col, vals }),
  }
})

import remindersHandler from '@/pages/api/v2/reminders'
import subscribeHandler from '@/pages/api/v2/push/subscribe'

// Does a (possibly nested) where-condition tree contain eq(<column named colName>, val)?
function condHasEq(cond: any, colName: string, val?: any): boolean {
  if (!cond || typeof cond !== 'object') return false
  if (cond.__op === 'eq') return cond.col?.name === colName && (val === undefined || cond.val === val)
  if (cond.__op === 'and') return Array.isArray(cond.conds) && cond.conds.some((c) => condHasEq(c, colName, val))
  return false
}

const makeRes = () => {
  const res: any = { statusCode: 0, payload: null, headers: {} as Record<string, string> }
  res.status = (c: number) => ((res.statusCode = c), res)
  res.json = (b: any) => ((res.payload = b), res)
  res.setHeader = (k: string, v: string) => ((res.headers[k] = v), res)
  return res
}
const run = async (handler: any, req: any) => {
  const res = makeRes()
  await handler({ query: {}, body: {}, ...req }, res)
  return res
}

const SESSION = { providerId: 'pid-A', provider: 'dev' } // resolves (via providerRows) to user 'A'
const signedInAsA = () => {
  h.state.session = SESSION
  h.state.providerRows = [{ user_id: 'A' }]
  h.state.isFree = false
}

beforeEach(() => {
  h.state.session = null
  h.state.providerRows = []
  h.state.isFree = false
  h.captured.insertValues.length = 0
  h.captured.selectWhere.length = 0
  h.captured.deleteWhere.length = 0
  vi.clearAllMocks()
})

describe('#287 gates — identity is the session, never the request (M1/M6/M7)', () => {
  it('M7: no session → 401 on BOTH handlers (not 404/anything else)', async () => {
    h.state.session = null
    const r = await run(remindersHandler, { method: 'GET' })
    expect(r.statusCode).toBe(401)
    const s = await run(subscribeHandler, { method: 'DELETE', query: { endpoint: 'e' } })
    expect(s.statusCode).toBe(401)
  })

  it('M1: reminders POST binds the row to the SESSION user, ignoring body.user_id', async () => {
    signedInAsA()
    await run(remindersHandler, {
      method: 'POST',
      body: {
        user_id: 'EVIL', // forged — must be ignored
        date: '2030-06-15',
        yams: [{ yamId: 'y1', yamLabel: 'ยาม', window: '06:00-07:00' }],
        destinations: ['push'],
      },
    })
    const rows = h.captured.insertValues.flat()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row: any) => row.userId === 'A')).toBe(true)
    expect(rows.some((row: any) => row.userId === 'EVIL')).toBe(false)
  })

  it('M6: subscribe POST binds the subscription to the SESSION user, ignoring body.user_id', async () => {
    signedInAsA()
    await run(subscribeHandler, {
      method: 'POST',
      body: { user_id: 'EVIL', endpoint: 'https://fcm/EP', keys: { p256dh: 'k', auth: 'a' } },
    })
    const values = h.captured.insertValues.flat()
    expect(values.length).toBeGreaterThan(0)
    expect(values.every((v: any) => v.userId === 'A')).toBe(true)
  })
})

describe('#287 gates — a free user is refused at the server (M2)', () => {
  it('M2: free member → 403 on reminders GET', async () => {
    signedInAsA()
    h.state.isFree = true
    const r = await run(remindersHandler, { method: 'GET' })
    expect(r.statusCode).toBe(403)
  })
})

describe('#287 gates — every read/write is scoped by the session user_id (M3/M4/M5)', () => {
  it('M4: reminders GET is scoped by user_id', async () => {
    signedInAsA()
    await run(remindersHandler, { method: 'GET' })
    expect(h.captured.selectWhere.some((c) => condHasEq(c, 'user_id', 'A'))).toBe(true)
  })

  it('M3: reminders DELETE is scoped by user_id (not id alone)', async () => {
    signedInAsA()
    await run(remindersHandler, { method: 'DELETE', query: { id: 'r1' } })
    expect(h.captured.deleteWhere.length).toBeGreaterThan(0)
    expect(h.captured.deleteWhere.some((c) => condHasEq(c, 'user_id', 'A'))).toBe(true)
  })

  it('M5: subscribe DELETE is scoped by user_id (not endpoint alone)', async () => {
    signedInAsA()
    await run(subscribeHandler, { method: 'DELETE', query: { endpoint: 'https://fcm/EP' } })
    expect(h.captured.deleteWhere.length).toBeGreaterThan(0)
    expect(h.captured.deleteWhere.some((c) => condHasEq(c, 'user_id', 'A'))).toBe(true)
  })
})
