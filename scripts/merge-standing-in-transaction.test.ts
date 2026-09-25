// mumate-login-identity-001 slice 4, phase 8b-fix — the standing read may not ask for a
// second database connection.
//
// ANCHOR: scripts/merge-standing-in-transaction.test.ts#one-slot-pool
// Bug-class this owns: a read issued from inside store.transaction that goes to the
// shared client instead of the transaction's own executor. lib/db/index.ts sets max 1,
// so such a read waits for the connection the enclosing transaction is holding, forever.
// It is invisible in every other suite in this repository — the fake stores hand back a
// resolver that touches no pool, and scripts/merge-identity-db.test.ts opens its own
// client with max 8, so even a real resolver finds a spare connection there. 3,052
// assertions existed on 2026-09-25 and not one of them modelled a single-connection
// pool; the defect was found by reading pg_stat_activity on a wedged container instead.
//
// THE TWO DIRECTIONS BELOW ARE THE POINT. The first proves the merge completes when the
// standing read uses the transaction. The second proves this harness would have CAUGHT
// the old wiring: given a memberStanding that asks the same one-slot pool for a second
// slot, the merge never settles. Without that second test the first one proves nothing,
// because a harness that cannot deadlock cannot witness the absence of a deadlock.
import { describe, it, expect } from 'vitest'

import { planIdentityMerge, type LinkStore, type LinkTransaction } from '@/lib/auth/link-account'
import { resolveStandingFromRows } from '@/lib/v2/subscription'

const SIGNED_IN = 'signed-in-user'
const OTHER = 'other-user'
const SUBJECT = '104081630471234567890'

/** A pool of exactly ONE connection, which is production's shape. A second acquire
 *  while the slot is held returns a promise that resolves only on release — so code
 *  that nests one inside the other hangs here exactly as it hangs against Postgres. */
class OneSlotPool {
  private held = false
  private waiting: Array<() => void> = []
  acquires = 0

  async acquire(): Promise<void> {
    this.acquires += 1
    if (!this.held) {
      this.held = true
      return
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve))
  }

  release(): void {
    const next = this.waiting.shift()
    if (next) next()
    else this.held = false
  }
}

/** Resolves to 'timeout' if the promise has not settled by then. A merge that wedges
 *  produces no error and no rejection — it produces nothing at all — so the only way to
 *  observe it is to stop waiting. */
function within<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([p, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))])
}

function storeOnOneSlot(opts: { standingTakesASecondSlot: boolean }) {
  const pool = new OneSlotPool()
  const rows = [
    { id: 'row-line-mine', userId: SIGNED_IN, provider: 'LINE', subject: 'U'.padEnd(33, 'a') },
    { id: 'row-google-theirs', userId: OTHER, provider: 'google', subject: SUBJECT },
  ]

  const tx: LinkTransaction = {
    async lockIdentity() {},
    async findIdentityOwner(provider, subject) {
      const hit = rows.find(
        (r) => r.provider.toLowerCase() === provider.toLowerCase() && r.subject === subject,
      )
      return hit ? { id: hit.id, userId: hit.userId, provider: hit.provider } : null
    },
    async memberExists() {
      return true
    },
    async insertProviderRow() {
      throw new Error('planIdentityMerge must never write')
    },
    async listMemberProviders(userId) {
      return rows
        .filter((r) => r.userId === userId)
        .map((r) => ({ id: r.id, userId: r.userId, provider: r.provider }))
    },
    async deleteProviderRows() {
      throw new Error('planIdentityMerge must never write')
    },
    async listMemberIdentityShapes(userId) {
      return rows
        .filter((r) => r.userId === userId)
        .map((r) => ({ id: r.id, provider: r.provider, identityLength: r.subject.length }))
    },
    async moveProviderRow() {
      throw new Error('planIdentityMerge must never write')
    },
    async recordIdentityMerge() {},
    async memberCreatedAt() {
      return '2026-01-01 00:00:00'
    },
    async memberStanding(userId) {
      // The defect, reproduced on demand: the old wiring read the paid signals through
      // the shared client, which means asking the pool for a connection of its own.
      if (opts.standingTakesASecondSlot) {
        await pool.acquire()
        pool.release()
      }
      // Rows the transaction already holds, decided by the module that owns the rule —
      // which is what the adapter does with two SELECTs on `tx`.
      return resolveStandingFromRows({
        subscriptionRows:
          userId === OTHER
            ? [
                {
                  id: 'sub-1',
                  tierCode: 'PRO',
                  status: 'ACTIVE',
                  expireAt: '2099-01-01',
                  createdAt: '2026-01-01T00:00:00.000Z',
                },
              ]
            : [],
        memberPaymentRow: null,
      })
    },
  }

  const store: LinkStore = {
    async transaction(work) {
      await pool.acquire()
      try {
        return await work(tx)
      } finally {
        pool.release()
      }
    },
  }
  return { store, pool }
}

describe('the merge plans without asking for a second connection', () => {
  it('completes against a pool of exactly one connection', async () => {
    const { store, pool } = storeOnOneSlot({ standingTakesASecondSlot: false })

    const plan = await within(
      planIdentityMerge(store, { signedInUserId: SIGNED_IN, provider: 'google', subject: SUBJECT }),
      500,
    )

    expect(plan).not.toBe('timeout')
    expect(plan).toMatchObject({ status: 'planned', survivorUserId: OTHER, loserUserId: SIGNED_IN })
    // One acquire for the transaction and nothing else. A second would mean some read
    // went around `tx`, which is the whole defect whether or not it happened to finish.
    expect(pool.acquires).toBe(1)
  })

  it('would hang if the standing read asked the pool for a slot of its own', async () => {
    // This is the 2026-09-25 shadow incident in miniature: no error, no rejection, no
    // log — the transaction simply never returns, and every other request queues behind
    // the connection it is still holding.
    const { store } = storeOnOneSlot({ standingTakesASecondSlot: true })

    const plan = await within(
      planIdentityMerge(store, { signedInUserId: SIGNED_IN, provider: 'google', subject: SUBJECT }),
      200,
    )

    expect(plan).toBe('timeout')
  })
})

describe('resolveStandingFromRows answers the two questions the merge asks', () => {
  const live = (tierCode: string) => ({
    id: 'sub-live',
    tierCode,
    status: 'ACTIVE',
    expireAt: '2099-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
  })

  it('a live PRO row is paid now and has paid ever', () => {
    expect(resolveStandingFromRows({ subscriptionRows: [live('PRO')], memberPaymentRow: null }))
      .toEqual({ isPaid: true, everPaid: true })
  })

  it('an EXPIRED PRO row is not paid now but is protected as a payer — owner decision 11', () => {
    // The case the owner asked for by name: having once subscribed means having once
    // paid, so this account must never be the side that loses its login method.
    expect(
      resolveStandingFromRows({
        subscriptionRows: [{ ...live('PRO'), status: 'EXPIRED', expireAt: '2020-01-01' }],
        memberPaymentRow: null,
      }),
    ).toEqual({ isPaid: false, everPaid: true })
  })

  it('a live FREE row does not shadow a valid legacy member — #525', () => {
    expect(
      resolveStandingFromRows({
        subscriptionRows: [live('FREE')],
        memberPaymentRow: { planCode: 'MEMBER', expireAt: '2099-01-01' },
      }),
    ).toEqual({ isPaid: true, everPaid: true })
  })

  it('a live FREE row with no legacy row is known-not-paid and has never paid', () => {
    expect(resolveStandingFromRows({ subscriptionRows: [live('FREE')], memberPaymentRow: null }))
      .toEqual({ isPaid: false, everPaid: false })
  })

  it('an UNKNOWN tier_code is undeterminable, and undeterminable may not lose', () => {
    // isPaid null is the fail-closed verdict, and everPaid true keeps such a side out of
    // the loser position entirely. decideSurvivor refuses rather than guessing.
    expect(resolveStandingFromRows({ subscriptionRows: [live('GOLD')], memberPaymentRow: null }))
      .toEqual({ isPaid: null, everPaid: true })
  })

  it('an expired legacy row counts as ever-paid even though it is not paid now', () => {
    expect(
      resolveStandingFromRows({
        subscriptionRows: [],
        memberPaymentRow: { planCode: 'MEMBER', expireAt: '2020-01-01' },
      }),
    ).toEqual({ isPaid: false, everPaid: true })
  })

  it('no rows at all is known-not-paid', () => {
    expect(resolveStandingFromRows({ subscriptionRows: [], memberPaymentRow: null }))
      .toEqual({ isPaid: false, everPaid: false })
  })
})
