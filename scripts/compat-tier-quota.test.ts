// mojisejr/mootech-fe#358 Phase 6 — the ดวงสมพงษ์ ceiling is the LEVEL's, and the window is the MONTH.
//
// ANCHOR: scripts/compat-tier-quota.test.ts#compatibility-quota-is-tiered-and-monthly
// Bug-class this owns: a ceiling that is right in the table and wrong at the door. Phase 6 changes TWO
// independent things at once — the number (100-free-only → 2/20/unlimited) and the window (calendar year →
// calendar month) — and either one alone is a live defect: the levels without the window give PLUS 20 for
// a whole year, and the window without the levels give a free user 100 EVERY month. Both are asserted.
//
// 🔴 THE WINDOW IS READ BACK OUT OF THE QUERY, not inferred from a count a mock returned. Same technique
// ตู๋ required on #540: only the literal bounds tell a calendar month apart from a rolling 30 days, and
// for most fixtures the two agree.
//
// 🔴 MUTANT CONTRACT — measured, listed at the bottom of this file with what actually reddened.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'

const state: { count: number; wheres: any[] } = { count: 0, wheres: [] }

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  const makeQuery = () => {
    const q: any = { _table: null }
    q.from = (t: any) => ((q._table = t), q)
    q.where = (c: any) => (state.wheres.push({ table: q._table, cond: c }), q)
    q.limit = () => Promise.resolve([])
    q.then = (resolve: any) => {
      if (q._table === schema.userMatching) return resolve([{ n: state.count }])
      return resolve([])
    }
    return q
  }
  return { db: { select: () => makeQuery() }, schema }
})

import { compatibilityCeilingFor, countCompatibilityInMonth, compatibilityQuotaView } from '@/lib/v2/compat-quota'
import { monthResetAt, monthWindow } from '@/lib/usage-core'

/** Pull the bound literals back out of the drizzle condition so the WINDOW is assertable. */
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

beforeEach(() => {
  state.count = 0
  state.wheres = []
})

describe('the ceiling belongs to the LEVEL', () => {
  it('🔴 free 2 · PLUS 20 · PRO unlimited — the numbers the shop card sells', () => {
    expect(compatibilityCeilingFor({ isPaid: false, tier: null })).toBe(2)
    expect(compatibilityCeilingFor({ isPaid: true, tier: 'PLUS' })).toBe(20)
    expect(compatibilityCeilingFor({ isPaid: true, tier: 'PRO' })).toBe(null)
  })

  it('🔴 CONTROL — the three answers really are three, so a constant-returning stub would fail here', () => {
    const answers = new Set([
      compatibilityCeilingFor({ isPaid: false, tier: null }),
      compatibilityCeilingFor({ isPaid: true, tier: 'PLUS' }),
      compatibilityCeilingFor({ isPaid: true, tier: 'PRO' }),
    ])
    expect(answers.size).toBe(3)
  })

  it('🔴 an UNDETERMINED membership spends FREE — never the larger allowance', () => {
    // isPaid null means "we could not find out". Reading it as anything but the smallest ceiling hands
    // a lookup outage a paid allowance, which is the fail-closed rule day-detail.ts:82 has always used.
    expect(compatibilityCeilingFor({ isPaid: null, tier: 'PRO' })).toBe(2)
  })

  it('a legacy member with no tier NAME still spends PRO (#358 Phase 1 decision, entitlement.ts:121)', () => {
    expect(compatibilityCeilingFor({ isPaid: true, tier: null })).toBe(null)
  })
})

describe('the window is the calendar MONTH, Asia/Bangkok', () => {
  it('🔴 binds the first and last instant of THIS month, not a year and not a rolling 30 days', async () => {
    await countCompatibilityInMonth('u1', new Date('2026-08-30T12:00:00Z'))
    const vals = boundValues(state.wheres.at(-1)?.cond)
    expect(vals).toContain('2026-08-01 00:00:00')
    expect(vals).toContain('2026-08-31 23:59:59')
    // 🔴 the two windows Phase 6 must not be confused with. A rolling 30 days would bind 2026-07-31,
    // and the year window the v1 lane still uses would bind 2026-01-01.
    expect(vals).not.toContain('2026-01-01 00:00:00')
    expect(vals).not.toContain('2026-07-31 12:00:00')
  })

  it('rolls with the month, and February is 28 days long in 2026', async () => {
    await countCompatibilityInMonth('u1', new Date('2026-02-14T12:00:00Z'))
    const vals = boundValues(state.wheres.at(-1)?.cond)
    expect(vals).toContain('2026-02-01 00:00:00')
    expect(vals).toContain('2026-02-28 23:59:59')
  })

  it('🔴 does NOT filter on matching_type — love and colleague draw on ONE allowance', async () => {
    await countCompatibilityInMonth('u1', new Date('2026-08-30T12:00:00Z'))
    const vals = boundValues(state.wheres.at(-1)?.cond)
    for (const kind of ['LOVE', 'FRIEND', 'BOSS', 'EMPLOYEE']) expect(vals).not.toContain(kind)
  })
})

// A fixed instant so `resetAt` is a value the test can name. Any moment in Bangkok's August 2026.
const AUG = new Date('2026-08-15T05:00:00Z')

describe('the indicator and the gate cannot disagree', () => {
  it('🔴 the remaining number comes from the SAME ceiling and the SAME count', async () => {
    state.count = 1
    expect(await compatibilityQuotaView({ isPaid: false, tier: null }, 'u1', AUG)).toEqual({
      unlimited: false, limit: 2, used: 1, remaining: 1, resetAt: '2026-09-01', tier: 'FREE',
    })
  })

  it('a user already past the ceiling shows 0 left, never a negative', async () => {
    state.count = 7
    expect(await compatibilityQuotaView({ isPaid: false, tier: null }, 'u1', AUG)).toEqual({
      unlimited: false, limit: 2, used: 7, remaining: 0, resetAt: '2026-09-01', tier: 'FREE',
    })
  })

  it('PRO has no number to show', async () => {
    state.count = 999
    expect(await compatibilityQuotaView({ isPaid: true, tier: 'PRO' }, 'u1', AUG)).toEqual({
      unlimited: true, used: 999, resetAt: '2026-09-01', tier: 'PRO',
    })
  })
})

// #557 — the screen may now say WHEN the allowance returns, so the date has to come from the same window
// the counter uses. These assert the derivation, not a restatement of it.
describe('#557 the reset day is the window\'s, not a second opinion', () => {
  it('🔴 resetAt is the day AFTER the window the count runs in — one definition, not two', async () => {
    state.count = 0
    const view = await compatibilityQuotaView({ isPaid: false, tier: null }, 'u1', AUG)
    const { end } = monthWindow(AUG) // last instant that still counts against this month
    // Stated as a RELATION to the window, not as a literal: move the window and both sides of this move
    // together, which is the whole reason resetAt is derived instead of computed a second time.
    const nextDay = (ymd: string) => {
      const d = new Date(`${ymd}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      return d.toISOString().slice(0, 10)
    }
    expect(view.resetAt).toBe(nextDay(end.slice(0, 10)))
  })

  it('December rolls the YEAR, not just the month', () => {
    expect(monthResetAt(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01') // 31 Dec 23:00 Bangkok
  })

  it('🔴 CONTROL — a different month gives a different day (so the value is not a constant)', () => {
    expect(monthResetAt(new Date('2026-01-10T05:00:00Z'))).toBe('2026-02-01')
    expect(monthResetAt(AUG)).toBe('2026-09-01')
  })

  it('tier travels too — the screen could not say WHY the number was 2 before this', async () => {
    state.count = 0
    expect((await compatibilityQuotaView({ isPaid: true, tier: 'PLUS' }, 'u1', AUG)).tier).toBe('PLUS')
    expect((await compatibilityQuotaView({ isPaid: false, tier: null }, 'u1', AUG)).tier).toBe('FREE')
  })
})

describe('DoD — the seam holds', () => {
  // 🔴 #358's closing criterion (ตู๋ ④): adding a feature must touch the entitlement table and NOTHING
  // else. Asserted by grep rather than by promise: every ceiling literal must live in that one file.
  it('🔴 no ceiling number for compatibility is written anywhere but lib/v2/entitlement.ts', () => {
    const hits = execSync(
      "git grep -lE \"compatibility: *\\{|'compatibility'\" -- lib pages features || true",
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean)
      .filter((f) => f !== 'lib/v2/entitlement.ts')
    // Files may NAME the feature (that is how they ask); what none of them may do is carry its numbers.
    for (const f of hits) {
      const src = execSync(`cat ${f}`, { encoding: 'utf8' })
      expect(src, `${f} restates a ceiling`).not.toMatch(/FREE: *2\b|PLUS: *20\b/)
    }
  })

  // 🔴 The v1 mirror must stay a MIRROR. lib/usage.ts still holds checkMatchingUsage/countMatchingInYear —
  // mootech-be's own ceiling and window, kept for the v1 indicator and for #247 to merge at launch. Since
  // Phase 6 nothing calls them, and this is the assertion that says so out loud: wiring either back into a
  // route would silently restore the 100-per-year rule on a lane that now sells 2 per month.
  it('🔴 the v1 matching gate has no caller in lib/ or pages/ — it is a mirror, not a door', () => {
    const callers = execSync(
      "git grep -lE 'checkMatchingUsage|countMatchingInYear' -- lib pages || true",
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean)
      .filter((f) => f !== 'lib/usage.ts')
    expect(callers).toEqual([])
  })
})

// 🔴 MUTANT CONTRACT — measured 2026-08-30, each one run and its count copied from the run:
//   MQ1  monthWindow → yearWindow in compat-quota.ts   → 6 of 12 red
//   MQ2  FREE: 2 → 20 in entitlement.ts                → 5 of 12 red
//   MQ3  the count filtered by matching_type           → 1 of 12 red (the one-allowance case)
//   MQ4  `isPaid !== true` → `isPaid === false`        → 1 of 12 red (the UNDETERMINED case)
// Every mutant asserts its target string exists before editing, so a no-op edit can never be read as a
// surviving mutant — that near-miss happened earlier tonight on the Phase 4 spec and the all-green result
// was indistinguishable from a real one.
