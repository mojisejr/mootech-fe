// mojisejr/mootech-fe#358 Phase 4 groundwork — WHAT DOES THE GATE SWITCH ACTUALLY SWITCH OFF?
//
// `CALENDAR_MONTH_GATE_OPEN` was written for one job (#177, Track B-4): let a non-member see a
// personalised month. Since #358 Phase 3 the `if (!CALENDAR_MONTH_GATE_OPEN)` block in
// pages/api/v2/calendar-month.ts also encloses the entitlement SPAN check, so flipping it to `true` now
// disables package limits on that route entirely — a FREE visitor could scroll to any month ever.
//
// Nobody decided that. The switch was written to gate one thing, a later ticket added a second thing
// inside its scope, and it silently acquired a second job. This file makes the scope a measured fact
// rather than something a reader has to reconstruct by counting braces.
//
// 🔴 WHAT THIS SPEC IS FOR. It does not argue the switch should be removed — that is a pricing decision
// and it needs ฟีม. It states, in a form that goes red when it stops being true, exactly how much a flip
// would cost. If someone later moves the span check OUT of the block, this file reddens and should be
// updated to say so, which is precisely the notification that was missing the last time this switch
// changed meaning.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ gateOpen: false, tier: 'FREE' as 'FREE' | 'PLUS' | 'PRO' }))
vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => ({ ok: true, userId: 'U-FREE' })) }))
vi.mock('@/lib/v2/clock', () => ({ currentMonthBkk: () => '2028-01' }))
vi.mock('@/lib/v2-calendar/gate', () => ({
  get CALENDAR_MONTH_GATE_OPEN() {
    return h.gateOpen
  },
}))
vi.mock('@/lib/v2/subscription', () => ({
  resolveSubscription: vi.fn(async () => ({
    isPaid: h.tier !== 'FREE',
    tier: h.tier,
    source: 'v2',
    expireAt: null,
  })),
}))
vi.mock('@/lib/v2-calendar/month', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchFortuneDays: vi.fn(async (_raw: unknown, month: string) => [
      { date: `${month}-05`, dayOfMonth: 5, dayGanzhi: '甲子', overallPercent: 70, grade: 'B+' },
    ]),
    fetchAlmanacDays: vi.fn(async () => []),
  }
})
import handler from '@/pages/api/v2/calendar-month'

const PERSON = { dob: '1990-01-01', time: '08:00', gender: 'male', isRememberTime: true }
async function call(month: string) {
  const res: { statusCode: number; body: any; status: any; json: any } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
  }
  await handler({ method: 'POST', body: { person: PERSON, month } } as never, res as never)
  return res
}

describe('#358 Phase 4 — the scope of CALENDAR_MONTH_GATE_OPEN, measured', () => {
  beforeEach(() => {
    h.gateOpen = false
    h.tier = 'FREE'
  })

  // The world as it ships. FREE reaches only the current month.
  it('gate CLOSED — a FREE caller is refused a month outside their span', async () => {
    const res = await call('2028-06')
    expect(res.body.allowed).toBe(false)
    expect(res.body.reason).toBe('out-of-span')
  })

  it('gate CLOSED — and is served the month they DO have (control: not a blanket refusal)', async () => {
    const res = await call('2028-01')
    expect(res.body.allowed).toBe(true)
  })

  // 🔴 THE MEASUREMENT. Flipping the switch today also switches the span check off, because that check
  // lives inside the same block. This asserts the CURRENT cost of a flip, so the cost cannot change
  // silently the way it did between #177 and #358 Phase 3.
  it('🔴 gate OPEN — the span check goes with it: a FREE caller gets ANY month', async () => {
    h.gateOpen = true
    const res = await call('2028-06')
    expect(res.body.allowed, 'flipping the switch disables package limits on this route').toBe(true)
    expect(res.body.reason).toBeUndefined()
  })

  // 🔴 CONTROL — the flip must not be reading as "allow everything" for a reason unrelated to the switch.
  // A PRO caller is allowed in BOTH states, so the case above only means something because this one shows
  // the fixture can still distinguish tiers.
  it('🔴 CONTROL — a PRO caller is served that month in either state, so the flip is what moved FREE', async () => {
    h.tier = 'PRO'
    h.gateOpen = false
    expect((await call('2028-06')).body.allowed).toBe(true)
    h.gateOpen = true
    expect((await call('2028-06')).body.allowed).toBe(true)
  })
})
