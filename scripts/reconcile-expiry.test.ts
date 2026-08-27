// #455 slice 3 — the branch that moves a finished-but-unpaid row out of PENDING.
// Plain tsx + node:assert (this repo's tsx lane runs it from .githooks/pre-push).
//
// ANCHOR: scripts/reconcile-expiry.test.ts#reconcile-abandons-terminal-charges
//
// Bug-class this owns: a PromptPay charge that expires produces NO webhook at all — measured, 0 of 124
// expired charges carried any event beyond charge.create (see lib/db/schema.ts on chargeExpiresAt). The
// webhook's door (isTerminalFailure -> abandonByChargeId) is therefore never reached for an expiry, and the
// row stayed PENDING until the 7-day reconcile window dropped it, then forever. That is DoD ③ of #455.
//
// The opposite mistake is worse than the one being fixed: abandoning a row that could still be paid takes
// a paying customer's charge away. So "the gateway did not say" must never be read as "finished".
//
// 🔴 MUTANT CONTRACT (each must redden this file):
//   ME1  drop the `isRefusedCharge` guard, abandon whenever not-paid  → ③ and ④ redden (still-payable rows taken)
//   ME2  treat a null charge as terminal                              → ③ reddens
//   ME3  abandon before checking gatewaySaysPaid                      → ① reddens (a paid row is abandoned)
//   ME4  stop passing the reason through                              → ⑤ reddens (cause is lost, REJECT becomes ambiguous)
//   ME5  count abandoned even when released=false                     → ⑥ reddens (an APPROVED row would inflate the count)
import assert from 'node:assert/strict'
import { runReconcile, type ReconcileDeps } from '@/lib/payment/reconcile-run'

type Charge = { chargeId: string; paid: boolean; status: string; failureCode?: string | null } | null

const OLD = new Date('2026-08-01T00:00:00Z') // well inside the 7-day window relative to NOW below
const NOW = new Date('2026-08-01T02:00:00Z') // 2h later: past the 15-minute grace, inside the window

function deps(charges: Record<string, Charge>, released: Record<string, boolean> = {}) {
  const abandoned: Array<{ chargeId: string; reason: string | null }> = []
  const settled: string[] = []
  const d: ReconcileDeps = {
    listUnsettled: async () =>
      Object.keys(charges).map((chargeId) => ({
        id: `row_${chargeId}`,
        chargeId,
        orderId: `ord_${chargeId}`,
        status: 'PENDING',
        createdAt: OLD,
      })),
    retrieveCharge: async (chargeId) => charges[chargeId] ?? null,
    settle: async (chargeId) => {
      settled.push(chargeId)
      return { provisioned: true }
    },
    abandon: async (chargeId, reason) => {
      abandoned.push({ chargeId, reason })
      return { released: released[chargeId] ?? true }
    },
  }
  return { d, abandoned, settled }
}

async function main() {
  // ① a charge the gateway confirms paid is SETTLED, never abandoned
  {
    const { d, abandoned, settled } = deps({ c_paid: { chargeId: 'c_paid', paid: true, status: 'successful' } })
    const s = await runReconcile(d, NOW)
    assert.deepEqual(settled, ['c_paid'], '① a paid charge must be settled')
    assert.equal(abandoned.length, 0, '① a paid charge must never be abandoned')
    assert.equal(s.abandoned, 0)
  }

  // ② an EXPIRED charge is abandoned — the case that has no webhook and is the reason this branch exists
  {
    const { d, abandoned, settled } = deps({ c_exp: { chargeId: 'c_exp', paid: false, status: 'expired' } })
    const s = await runReconcile(d, NOW)
    assert.equal(settled.length, 0, '② an unpaid charge must not be settled')
    assert.equal(abandoned.length, 1, '② an expired charge must be abandoned')
    assert.equal(abandoned[0].chargeId, 'c_exp')
    assert.equal(s.abandoned, 1, '② the run must report it')
  }

  // ③ a charge that is merely PENDING at the gateway, and one the gateway does not know at all,
  //    must BOTH be left alone. Absence of a verdict is not a verdict.
  {
    const { d, abandoned } = deps({
      c_pending: { chargeId: 'c_pending', paid: false, status: 'pending' },
      c_unknown: null,
    })
    const s = await runReconcile(d, NOW)
    assert.equal(abandoned.length, 0, '③ a still-payable or unknown charge must never be abandoned')
    assert.equal(s.abandoned, 0)
  }

  // ④ a status nobody has taught us about falls on the "not finished" side, deliberately
  {
    const { d, abandoned } = deps({ c_weird: { chargeId: 'c_weird', paid: false, status: 'some_new_omise_status' } })
    await runReconcile(d, NOW)
    assert.equal(abandoned.length, 0, '④ an unrecognised status must not be treated as terminal')
  }

  // ⑤ the CAUSE travels with the abandon. Feem chose to reuse the REJECT status rather than add EXPIRED,
  //    so this column is the only thing keeping "the bank refused" separable from "the customer walked away".
  {
    const { d, abandoned } = deps({
      c_gw: { chargeId: 'c_gw', paid: false, status: 'failed', failureCode: 'insufficient_fund' },
      c_exp: { chargeId: 'c_exp', paid: false, status: 'expired' },
    })
    await runReconcile(d, NOW)
    const byId = Object.fromEntries(abandoned.map((a) => [a.chargeId, a.reason]))
    assert.equal(byId.c_gw, 'insufficient_fund', '⑤ what the gateway said must win')
    assert.equal(byId.c_exp, 'gateway_expired', '⑤ our own namespaced cause when the gateway gave none')
  }

  // ⑥ a row the repo refuses to release (already APPROVED) must not be counted as abandoned
  {
    const { d } = deps({ c_done: { chargeId: 'c_done', paid: false, status: 'expired' } }, { c_done: false })
    const s = await runReconcile(d, NOW)
    assert.equal(s.abandoned, 0, '⑥ released=false must not inflate the count')
  }

  // ⑦ an unreachable gateway is reported, and touches nothing
  {
    const { d, abandoned, settled } = deps({})
    const failing: ReconcileDeps = {
      ...d,
      listUnsettled: async () => [
        { id: 'r1', chargeId: 'c_boom', orderId: 'o1', status: 'PENDING', createdAt: OLD },
      ],
      retrieveCharge: async () => {
        throw new Error('gateway unreachable')
      },
    }
    const s = await runReconcile(failing, NOW)
    assert.equal(s.unreachable, 1, '⑦ an unreachable gateway is counted')
    assert.equal(abandoned.length, 0, '⑦ and changes nothing')
    assert.equal(settled.length, 0)
  }

  console.log('reconcile-expiry: 7 cases green')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
