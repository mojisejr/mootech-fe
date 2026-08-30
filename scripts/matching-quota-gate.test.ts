// Teeth on the ดวงสมพงษ์ quota gate moved off mootech-be (#357).
// Mocks only @/lib/db, so the real membership classification, the real evaluateUsage decision and the
// real window construction all run. Three things are pinned, each of which be gets right and a careless
// port gets wrong:
//   1. the WINDOW is the calendar YEAR — matching.service.ts:71-84 uses startOf('year')/endOf('year').
//      A month window would let a free user run 100 EVERY MONTH. The bound parameters are read back out
//      of the query, so swapping yearWindow → monthWindow turns this red.
//      🔑 THIS FILE, not the DB run in the PR's parity comment, is what excludes a ROLLING 365-DAY
//      window (ตู๋, review of #540). Measured from 2026-08-30 a rolling window gives the same two
//      answers as the calendar year for those fixtures — fillers at 2025-06-15 fall outside it either
//      way. Only the literal bounds asserted below tell them apart: a rolling window binds
//      '2025-08-30 …' and turns the assertion red.
//   2. only FREE users are limited — matching.service.ts:85 counts against the ceiling `if (isFree)`.
//      A member past the ceiling must still pass.
//   3. the refusal message is the _ALL variant (matching.service.ts:86), not the per-day one.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: { membership: any[]; count: number; wheres: any[] } = { membership: [], count: 0, wheres: [] }

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  const makeQuery = () => {
    const q: any = { _table: null }
    q.from = (t: any) => ((q._table = t), q)
    q.where = (c: any) => (state.wheres.push({ table: q._table, cond: c }), q)
    q.limit = () => Promise.resolve(state.membership)
    q.then = (resolve: any) => {
      if (q._table === schema.userMatching) return resolve([{ n: state.count }])
      return resolve([])
    }
    return q
  }
  return { db: { select: () => makeQuery() }, schema }
})

import { userMatching } from '@/lib/db/schema'
import { AI_CODE, AI_MSG, FREE_MATCHING_LIMIT, checkMatchingUsage, countMatchingInYear } from '@/lib/usage'

// Pull the bound literals back out of the drizzle condition so the WINDOW itself is assertable, not
// merely the count that came back from a mock.
function boundValues(cond: any): (string | number)[] {
  const out: (string | number)[] = []
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return
    if ('value' in n && (typeof n.value === 'string' || typeof n.value === 'number')) out.push(n.value)
    const chunks = n.queryChunks ?? n.chunks
    if (Array.isArray(chunks)) chunks.forEach(walk)
    if (Array.isArray(n)) n.forEach(walk)
  }
  walk(cond)
  return out
}

const MEMBER = [{ planCode: 'MEMBER', expireAt: '2099-12-31' }]

beforeEach(() => {
  state.membership = []
  state.count = 0
  state.wheres = []
})

describe('countMatchingInYear', () => {
  it('counts user_matching inside the CALENDAR-YEAR window, not the month', async () => {
    await countMatchingInYear('u1', new Date('2026-08-30T12:00:00Z'))
    const w = state.wheres.find((x) => x.table === userMatching)
    expect(w, 'the count must query user_matching').toBeTruthy()
    expect(boundValues(w.cond)).toEqual(['u1', '2026-01-01 00:00:00', '2026-12-31 23:59:59'])
  })

  it('follows the Bangkok year, not the UTC one, at the boundary', async () => {
    // 2026-12-31 18:00Z is already 2027-01-01 01:00 in Bangkok → the 2027 window.
    await countMatchingInYear('u1', new Date('2026-12-31T18:00:00Z'))
    const w = state.wheres.find((x) => x.table === userMatching)
    expect(boundValues(w.cond)).toEqual(['u1', '2027-01-01 00:00:00', '2027-12-31 23:59:59'])
  })
})

describe('checkMatchingUsage', () => {
  it('lets a free user through below the ceiling', async () => {
    const r = await checkMatchingUsage('u1', FREE_MATCHING_LIMIT - 1)
    expect(r.code).toBe(AI_CODE.SUCCESS)
    expect(r.is_free).toBe(true)
  })

  it('refuses a free user AT the ceiling, with the _ALL message', async () => {
    const r = await checkMatchingUsage('u1', FREE_MATCHING_LIMIT)
    expect(r.code).toBe(AI_CODE.OUT_OF_LIMIT)
    expect(r.message).toBe(AI_MSG.OUT_OF_LIMIT_ALL)
  })

  it('never blocks a paid member, even far past the free ceiling', async () => {
    state.membership = MEMBER
    const r = await checkMatchingUsage('u1', FREE_MATCHING_LIMIT * 10)
    expect(r.code).toBe(AI_CODE.SUCCESS)
    expect(r.is_free).toBe(false)
  })

  it('does not surface NO_PLAN/EXPIRED as a refusal — be leaves those codes commented out', async () => {
    state.membership = [{ planCode: 'MEMBER', expireAt: '2000-01-01' }] // expired → free
    const r = await checkMatchingUsage('u1', 0)
    expect(r.code).toBe(AI_CODE.SUCCESS)
    expect(r.is_free).toBe(true)
  })
})
