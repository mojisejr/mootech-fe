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
