// Teeth on the REAL free friend limit (#262): checkMemberWithFriendUsage must let a free user reach
// 20 friends before OUT_OF_LIMIT. usage-core.test.ts only proves evaluateUsage mechanics with the
// value re-typed inline — reverting lib/usage.ts:limitFree 20→1 would NOT fail it. This spec imports
// the real wrapper (@/lib/usage) and mocks only the DB row that resolveMembership reads, so a revert
// of the constant turns "free at 19 -> SUCCESS" red. .tsx extension keeps it out of ci.yml's tsx
// lane (globs *.test.ts); it runs in the vitest lane via vitest.config.mts include.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mutable row that the mocked db.select().from().where().limit() resolves to.
// [] = no member_payment row = free user; [{planCode:'MEMBER',...}] = active member.
const dbRow: { value: any[] } = { value: [] }

vi.mock('@/lib/db', () => {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(dbRow.value),
  }
  return { db: chain, schema: {} }
})

import { checkMemberWithFriendUsage, AI_CODE, AI_MSG } from '@/lib/usage'

describe('checkMemberWithFriendUsage — free friend limit raised to 20 (#262)', () => {
  beforeEach(() => {
    dbRow.value = [] // default: free user (no member_payment row)
  })

  it('free user with 0 friends -> SUCCESS', async () => {
    const r = await checkMemberWithFriendUsage('u-free', 0)
    expect(r.code).toBe(AI_CODE.SUCCESS)
    expect(r.is_free).toBe(true)
  })

  // The mutant guard: with the old limitFree=1, count 19 would already be OUT_OF_LIMIT.
  it('free user with 19 friends -> can still add (SUCCESS)', async () => {
    const r = await checkMemberWithFriendUsage('u-free', 19)
    expect(r.code).toBe(AI_CODE.SUCCESS)
    expect(r.is_free).toBe(true)
  })

  it('free user with 20 friends -> ตัน (OUT_OF_LIMIT, _ALL message)', async () => {
    const r = await checkMemberWithFriendUsage('u-free', 20)
    expect(r.code).toBe(AI_CODE.OUT_OF_LIMIT)
    expect(r.message).toBe(AI_MSG.OUT_OF_LIMIT_ALL)
    expect(r.is_free).toBe(true)
  })

  it('active member is unchanged — 19 SUCCESS, 20 OUT_OF_LIMIT (member ceiling untouched)', async () => {
    dbRow.value = [{ planCode: 'MEMBER', expireAt: '2099-01-01' }]
    const under = await checkMemberWithFriendUsage('u-member', 19)
    expect(under.code).toBe(AI_CODE.SUCCESS)
    expect(under.is_free).toBe(false)
    const at = await checkMemberWithFriendUsage('u-member', 20)
    expect(at.code).toBe(AI_CODE.OUT_OF_LIMIT)
    expect(at.is_free).toBe(false)
  })
})
