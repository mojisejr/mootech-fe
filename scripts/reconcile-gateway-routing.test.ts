// Beam Checkout lane slice 1 — the reconciler asks the provider that HOLDS each charge (0027 `gateway` on
// the row), never whichever gateway this deploy charges through. Pure: runReconcile with injected deps.
//
// Why it matters: before 0027 the cron asked one hard-wired adapter about every PENDING row. Ask Omise
// about a Beam id and Omise honestly answers null ("I do not know this charge") — which reconcile-run
// correctly treats as "not paid YET" and leaves the row PENDING… forever, until the 7-day window drops it.
//
// 🔴 MUTANT CONTRACT (each reddens this spec):
//   MR1  reconcile-run stops passing row.gateway to retrieveCharge     → 'routing' case fails
//   MR2  a throw from the gateway lookup is treated as "not paid"      → 'unreachable' case fails
//        (the row would be abandoned/left on the strength of a provider we could not ask)
//   MR3  listUnsettledPayments stops selecting `gateway`               → covered by reconcile-cron-db (real pg)
import { describe, it, expect } from 'vitest'
import { runReconcile, type ReconcileDeps } from '../lib/payment/reconcile-run'
import { gatewayFor, gatewayNameFrom } from '../lib/payment/select-gateway'

const NOW = new Date('2026-09-13T12:00:00Z')
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000)

function deps(rows: Array<{ chargeId: string; gateway?: string }>, retrieve: ReconcileDeps['retrieveCharge']) {
  const settled: string[] = []
  const abandoned: Array<[string, string | null]> = []
  const d: ReconcileDeps = {
    listUnsettled: async () =>
      rows.map((r, i) => ({ id: `p${i}`, chargeId: r.chargeId, orderId: `o${i}`, status: 'PENDING', createdAt: ago(30), gateway: r.gateway })),
    retrieveCharge: retrieve,
    settle: async (chargeId) => {
      settled.push(chargeId)
      return { provisioned: true }
    },
    abandon: async (chargeId, reason) => {
      abandoned.push([chargeId, reason])
      return { released: true }
    },
  }
  return { d, settled, abandoned }
}

describe('runReconcile passes the row gateway to retrieveCharge', () => {
  it('routing: each row is asked about at ITS provider', async () => {
    const asked: Array<[string, string | undefined]> = []
    const { d, settled } = deps(
      [
        { chargeId: 'chrg_omise_1', gateway: 'omise' },
        { chargeId: 'ch_beam_1', gateway: 'beam' },
        { chargeId: 'chrg_legacy_no_column' }, // a fixture that predates 0027 ⇒ undefined ⇒ Omise
      ],
      async (chargeId, gateway) => {
        asked.push([chargeId, gateway])
        return { chargeId, paid: true, status: 'successful' }
      },
    )
    const summary = await runReconcile(d, NOW)
    expect(asked).toEqual([
      ['chrg_omise_1', 'omise'],
      ['ch_beam_1', 'beam'],
      ['chrg_legacy_no_column', undefined],
    ])
    expect(settled).toEqual(['chrg_omise_1', 'ch_beam_1', 'chrg_legacy_no_column'])
    expect(summary).toMatchObject({ considered: 3, confirmedPaid: 3, provisioned: 3, unreachable: 0 })
  })

  it('🔴 unreachable: the cron wiring throws for a provider it cannot ask — the row is LEFT ALONE, not abandoned, not settled', async () => {
    // The exact expression pages/api/cron/reconcile-payment.ts uses. In slice 1 the Beam adapter is not
    // installed, so gatewayFor('beam') throws; an unknown row value throws from gatewayNameFrom.
    const cronRetrieve: ReconcileDeps['retrieveCharge'] = (chargeId, gateway) =>
      gatewayFor(gatewayNameFrom(gateway)).retrieveCharge(chargeId)
    const { d, settled, abandoned } = deps(
      [
        { chargeId: 'ch_beam_1', gateway: 'beam' },
        { chargeId: 'x_1', gateway: 'stripe' },
      ],
      cronRetrieve,
    )
    const summary = await runReconcile(d, NOW)
    expect(summary).toMatchObject({ considered: 2, confirmedPaid: 0, provisioned: 0, unreachable: 2, abandoned: 0 })
    expect(settled).toEqual([])
    expect(abandoned).toEqual([])
  })

  it('control: a dep written before 0027 that ignores the second argument still works unchanged', async () => {
    const { d, settled } = deps([{ chargeId: 'chrg_1', gateway: 'omise' }], async (chargeId) => ({ chargeId, paid: true, status: 'successful' }))
    await runReconcile(d, NOW)
    expect(settled).toEqual(['chrg_1'])
  })
})
