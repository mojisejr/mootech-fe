// #605 G1 — the QI repair pass: a purchase whose MONEY settled but whose GOODS never left.
//
// WHY THIS FILE EXISTS. settleAndProvision writes status='APPROVED' inside its transaction and calls the
// engine AFTER it. Before this ticket, a failed engine call wrote two console.error lines and returned,
// and the reconciler only ever scanned status='PENDING' — so the row was never looked at again by
// anything. Money in, QI not credited, recoverable only by a human reading logs.
//
// 🔴 WHAT THIS FILE PROVES AND WHAT IT DOES NOT.
//   PROVES  the loop's ORDER (grant before record), that each failure mode leaves the row retryable
//           rather than marked done, that one bad row does not stop the rest, and that the counts
//           separate "the customer has their QI" from "we merely failed to write it down".
//   DOES NOT that the engine is actually idempotent on `ref = charge_id`. That is an assumption this
//           whole pass rests on and it lives in another repository (bazi-sft-dataset). If it were ever
//           false, every test here would still pass while production double-credited. The honest place
//           to catch that is slice 4's real QI purchase, which checks the buyer's BALANCE, not the row.
//
// MUTANTS RUN, not imagined (both restored after):
//   1. mark the row granted BEFORE calling the engine (swap the two lines in runQiGrantRetry)
//      → 4 failed | 4 passed. That mutant IS the original bug, and four different assertions catch it.
//   2. count a thrown markGranted as `repaired` instead of `unrecorded`
//      → 1 failed | 7 passed, and the one that died is "a failed write is reported as unrecorded,
//        never as a repair" — it died for exactly the reason it claims to guard.
import { describe, it, expect, vi } from 'vitest'
import { runQiGrantRetry, type QiRetryDeps } from '@/lib/payment/reconcile-qi'
import type { QiPurchaseRef } from '@/lib/qi/grant'

const ref = (n: string): QiPurchaseRef => ({
  userId: `user-${n}`,
  packageCode: 'QI_60',
  chargeId: `chrg_test_${n}`,
})

function deps(over: Partial<QiRetryDeps> = {}): QiRetryDeps {
  return {
    listUngranted: async () => [ref('1')],
    grant: async () => true,
    markGranted: async () => true,
    ...over,
  }
}

describe('#605 G1 · QI repair pass', () => {
  it('repairs a row the engine confirms, and records it', async () => {
    const markGranted = vi.fn(async () => true)
    const out = await runQiGrantRetry(deps({ markGranted }))
    expect(out).toEqual({ considered: 1, repaired: 1, unrecorded: 0, stillMissing: 0 })
    expect(markGranted).toHaveBeenCalledWith('chrg_test_1')
  })

  // 🔴 THE LOAD-BEARING ORDER. Recording first would mark a row repaired that the engine never accepted,
  // and nothing would look at it again — the exact failure this pass exists to end, one line earlier.
  it('records only AFTER the engine confirms, never before', async () => {
    const calls: string[] = []
    await runQiGrantRetry(
      deps({
        grant: async () => {
          calls.push('grant')
          return true
        },
        markGranted: async () => {
          calls.push('mark')
          return true
        },
      }),
    )
    expect(calls).toEqual(['grant', 'mark'])
  })

  it('leaves a row the engine refuses unmarked, so the next run tries again', async () => {
    const markGranted = vi.fn(async () => true)
    const out = await runQiGrantRetry(deps({ grant: async () => false, markGranted }))
    expect(out).toEqual({ considered: 1, repaired: 0, unrecorded: 0, stillMissing: 1 })
    // The row must NOT be marked: marking it here would hide a customer who paid and got nothing.
    expect(markGranted).not.toHaveBeenCalled()
  })

  it('treats an engine that throws as "still missing", not as a repair and not as a refusal to retry', async () => {
    const markGranted = vi.fn(async () => true)
    const out = await runQiGrantRetry(
      deps({
        grant: async () => {
          throw new Error('ECONNRESET')
        },
        markGranted,
      }),
    )
    expect(out).toEqual({ considered: 1, repaired: 0, unrecorded: 0, stillMissing: 1 })
    expect(markGranted).not.toHaveBeenCalled()
  })

  // The customer HAS their QI; only our note is missing. Counting it as `repaired` would let a database
  // that is refusing writes hide inside a success number, and the row would look repaired in the logs
  // while still being selected by every future run.
  it('a failed write is reported as unrecorded, never as a repair', async () => {
    const out = await runQiGrantRetry(
      deps({
        markGranted: async () => {
          throw new Error('write failed')
        },
      }),
    )
    expect(out).toEqual({ considered: 1, repaired: 0, unrecorded: 1, stillMissing: 0 })
  })

  it('one bad row does not stop the others from being repaired', async () => {
    const rows = [ref('1'), ref('2'), ref('3')]
    const out = await runQiGrantRetry(
      deps({
        listUngranted: async () => rows,
        grant: async (r) => {
          if (r.chargeId === 'chrg_test_2') throw new Error('boom')
          return true
        },
      }),
    )
    expect(out).toEqual({ considered: 3, repaired: 2, unrecorded: 0, stillMissing: 1 })
  })

  it('does nothing, and calls nothing, when there is nothing to repair', async () => {
    const grant = vi.fn(async () => true)
    const markGranted = vi.fn(async () => true)
    const out = await runQiGrantRetry(deps({ listUngranted: async () => [], grant, markGranted }))
    expect(out).toEqual({ considered: 0, repaired: 0, unrecorded: 0, stillMissing: 0 })
    expect(grant).not.toHaveBeenCalled()
    expect(markGranted).not.toHaveBeenCalled()
  })

  // markGranted returning false means someone else already recorded it (a concurrent run, or the
  // settle path winning the race). That is a repair, not a failure — the customer has their QI and the
  // note exists. Treating it as a failure would make two parallel cron runs report false alarms.
  it('a row someone else already recorded still counts as repaired', async () => {
    const out = await runQiGrantRetry(deps({ markGranted: async () => false }))
    expect(out).toEqual({ considered: 1, repaired: 1, unrecorded: 0, stillMissing: 0 })
  })
})
