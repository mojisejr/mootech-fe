// #363 — teeth for "the screen reports on MY charge, and never claims success early". MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  pickCharge returns rows[0] instead of matching chargeId   → "two charges" test reddens
//   MU2  statusOf treats PENDING as APPROVED                       → "waiting is not success" reddens
//   MU3  statusOf treats a missing row as APPROVED                 → "unknown is not success" reddens
//   MU4  add `.limit(...)` to listUserPayments                     → the no-limit test reddens
//
// 🔑 MU1 IS THE ONE WITH THE BAD FAILURE PROFILE. `payments[0]` is the newest row, which IS our charge almost
// every time — so a mutant that takes it passes any test written with a single payment in the fixture. The
// case below therefore puts SOMEBODY ELSE'S newer row in front of ours on purpose: that is the shape the bug
// actually has (a second tab, or a retry after a refused card), and it is the only shape that can tell the
// two implementations apart.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { pickCharge, statusOf, type PaymentRow } from '@/features/v2-shop/useChargeStatus'

const row = (chargeId: string | null, status = 'PENDING'): PaymentRow => ({ chargeId, status })

describe('#363 which row is mine', () => {
  it('🔴 finds MY charge even when a newer one is in front of it', () => {
    // newest-first, exactly as repo.ts orders it. Ours is second.
    const rows = [row('chrg_someone_else'), row('chrg_mine'), row('chrg_older')]
    expect(pickCharge(rows, 'chrg_mine')?.chargeId).toBe('chrg_mine')
  })

  it('answers null rather than guessing when my charge is not in the list yet', () => {
    expect(pickCharge([row('chrg_other')], 'chrg_mine')).toBeNull()
    expect(pickCharge([], 'chrg_mine')).toBeNull()
  })

  it('a null chargeId in the list never matches a real one', () => {
    // rows exist with chargeId null between insert and attachChargeId (repo.ts:79 → attachChargeId).
    expect(pickCharge([row(null)], 'chrg_mine')).toBeNull()
  })
})

describe('#363 what the screen may say', () => {
  it('waiting is not success — PENDING stays PENDING', () => {
    expect(statusOf(row('chrg_mine', 'PENDING'))).toBe('PENDING')
  })

  it('unknown is not success — a row we cannot see is still a wait', () => {
    expect(statusOf(null)).toBe('UNKNOWN')
  })

  it('only a settled APPROVED is success, and no other string is', () => {
    expect(statusOf(row('c', 'APPROVED'))).toBe('APPROVED')
    // Anything the DB might grow later must not read as success just because it is not PENDING.
    for (const s of ['FAILED', 'EXPIRED', 'REVERSED', 'approved', '']) {
      expect(statusOf(row('c', s)), `"${s}" must not read as success`).toBe('PENDING')
    }
  })
})

describe('#363 the dependency this hook has on someone else\'s query', () => {
  it('🔴 listUserPayments must stay UNBOUNDED — a .limit() breaks polling SILENTLY', () => {
    // The hook can only find a charge that is actually in the response. If this query ever gains a limit, a
    // user with enough older payments stops finding their new one and the screen waits forever with no error.
    // This is a tooth on a file this feature does not own, and it is here on purpose: the DEPENDENCY is ours.
    const src = readFileSync(join(process.cwd(), 'lib/payment/repo.ts'), 'utf8')
    const fn = src.slice(src.indexOf('export async function listUserPayments'))
    const body = fn.slice(0, fn.indexOf('\n}\n') + 1)
    expect(body).toContain('orderBy(desc(v2Payment.createdAt))') // newest first is what the comment assumes
    expect(body).not.toMatch(/\.limit\s*\(/)
    // Surface check: if the slice above ever stops finding the function, the assertions would pass over an
    // empty string. Assert we actually read something first.
    expect(body.length).toBeGreaterThan(120)
  })
})

// ── the deadline behaviour (#363 criteria ①) ────────────────────────────────────────────────────────
// 🔴 MUTANT CONTRACT (cont.):
//   MU11 after the deadline, report APPROVED / "expired" instead of `stale`   → "claims nothing" reddens
//   MU12 a fetch error ends the wait                                          → "an error is not an answer" reddens
//   MU13 keep polling forever past the deadline                               → "stops asking" reddens
import { renderHook, waitFor, act } from '@testing-library/react'
import { useChargeStatus } from '@/features/v2-shop/useChargeStatus'
import { vi as vitest, beforeEach, afterEach as afterEachHook } from 'vitest'

const mockStatus = (payments: unknown, ok = true) => {
  vitest.stubGlobal('fetch', vitest.fn(async () => ({ ok, json: async () => ({ payments }) })))
}

beforeEach(() => vitest.unstubAllGlobals())
afterEachHook(() => vitest.unstubAllGlobals())

describe('#363 how long we keep asking, and what we refuse to say', () => {
  it('settles on APPROVED and stops asking', async () => {
    mockStatus([{ chargeId: 'c1', status: 'APPROVED' }])
    const { result } = renderHook(() => useChargeStatus('c1', { pollMs: 5 }))
    await waitFor(() => expect(result.current.status).toBe('APPROVED'))
    expect(result.current.polling).toBe(false)
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    await new Promise((r) => setTimeout(r, 40))
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls)
  })

  it('🔴 past the deadline it CLAIMS NOTHING — not success, not failure', async () => {
    mockStatus([{ chargeId: 'c1', status: 'PENDING' }])
    let t = 0
    const { result } = renderHook(() => useChargeStatus('c1', { pollMs: 1, pollUntilMs: 10, horizonMs: 10, now: () => (t += 6) }))
    await waitFor(() => expect(result.current.stale).toBe(true))
    // The things it must not have become.
    expect(result.current.status).not.toBe('APPROVED')
    expect(result.current.error).toBe(false) // "we stopped promising" is not "something went wrong"
    // 🔴 CHANGED BY #424: `polling` stays TRUE here. It used to flip false at the horizon, which encoded the
    // belief that nothing more could arrive — the belief this whole review overturned. We keep asking.
    expect(result.current.polling).toBe(true)
  })

  it('🔴 #424: it KEEPS asking once stale — stale means "no longer promised", not "no longer watched"', async () => {
    // 🔴 THIS TEST ASSERTED THE OPPOSITE UNTIL ตู๋'S REVIEW OF #424, and the case that flipped it is worth
    // keeping: a cron run that cannot reach the gateway counts itself `unreachable` and leaves the row for
    // the next run (reconcile-run.ts:60-64), which can settle it an hour later. The old behaviour — return
    // at the horizon — meant that settle could never reach a screen the user still had open, and the screen
    // would sit there showing "อาจหมดอายุ" over a paid membership.
    mockStatus([{ chargeId: 'c1', status: 'PENDING' }])
    let t = 0
    const { result } = renderHook(() =>
      useChargeStatus('c1', { pollMs: 1, slowPollMs: 1, pollUntilMs: 10, horizonMs: 10, now: () => (t += 6) }),
    )
    await waitFor(() => expect(result.current.stale).toBe(true))
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    await waitFor(() =>
      expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(calls),
    )
  })

  it('🔴 #424: a settle that lands AFTER the horizon still reaches the screen', async () => {
    // The whole point of not returning early — proven end to end rather than by counting fetches.
    mockStatus([{ chargeId: 'c1', status: 'PENDING' }])
    let t = 0
    const { result } = renderHook(() =>
      useChargeStatus('c1', { pollMs: 1, slowPollMs: 1, pollUntilMs: 10, horizonMs: 10, now: () => (t += 6) }),
    )
    await waitFor(() => expect(result.current.stale).toBe(true))
    mockStatus([{ chargeId: 'c1', status: 'APPROVED' }]) // the cron got through on a later run
    await waitFor(() => expect(result.current.status).toBe('APPROVED')) // …with nobody pressing anything
  })

  it('check() asks again after the deadline — a user who paid late can still find out', async () => {
    mockStatus([{ chargeId: 'c1', status: 'PENDING' }])
    let t = 0
    const { result } = renderHook(() => useChargeStatus('c1', { pollMs: 1, pollUntilMs: 10, horizonMs: 10, now: () => (t += 6) }))
    await waitFor(() => expect(result.current.stale).toBe(true))
    mockStatus([{ chargeId: 'c1', status: 'APPROVED' }])
    act(() => result.current.check())
    await waitFor(() => expect(result.current.status).toBe('APPROVED'))
  })

  it('a fetch error is not an answer — it ASKS AGAIN', async () => {
    // 🔴 THE FIRST VERSION OF THIS TEST DID NOT BITE, and the reason is worth keeping. It asserted
    // `result.current.polling === true` — but `polling` is DERIVED from state (`chargeId && !approved &&
    // !stale`), so it stays true whether or not another request is ever scheduled. A mutant that returned
    // early after `setError(true)` — killing the retry loop outright — left that flag untouched and the test
    // green (MU18 survived, caught by the mutant runner rather than by review).
    // The fix is to measure the behaviour the sentence claims: another request actually goes out.
    vitest.stubGlobal('fetch', vitest.fn(async () => { throw new Error('offline') }))
    const { result } = renderHook(() => useChargeStatus('c1', { pollMs: 2 }))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.status).not.toBe('APPROVED')
    const calls = () => (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    const first = calls()
    await waitFor(() => expect(calls()).toBeGreaterThan(first))
  })
})
