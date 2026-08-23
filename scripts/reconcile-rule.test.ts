// #360 — the reconciler's PURE half: which rows a run may touch, and what counts as "the gateway said paid".
// Plain tsx + node:assert (this repo's tsx lane runs it from .githooks/pre-push).
//
// ANCHOR: scripts/reconcile-rule.test.ts#reconcile-selection-and-boundary
// Bug-class this owns: a reconciler that reaches beyond its own case. Two mechanisms recover unsettled
// payments (#360 by charge_id on a timer, #371 by order_id when a webhook arrives). If this rule quietly
// widened — to placeholders, to REJECTed rows, to rows a webhook is still in flight for — the two would be
// racing over the same row, and the "which one granted this?" question would have no answer in a log.
//
// 🔴 MUTANT CONTRACT (each reddens the tsx lane):
//   MR1  drop the placeholder filter        → the placeholder case fails (a row #371 owns is taken)
//   MR2  drop the PENDING filter            → the REJECT/APPROVED cases fail
//   MR3  drop the grace window              → the fresh-row case fails (racing an in-flight webhook)
//   MR4  gatewaySaysPaid accepts null       → the unknown-charge case fails (unreachable read as paid)
import assert from 'node:assert/strict'
import {
  selectReconcileCandidates,
  gatewaySaysPaid,
  isPlaceholderCharge,
  DEFAULT_WINDOW,
} from '../lib/payment/reconcile'

let pass = 0
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

const NOW = new Date('2026-08-23T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms)
const row = (over: Partial<Parameters<typeof selectReconcileCandidates>[0][number]> = {}) => ({
  id: 'p1',
  chargeId: 'chrg_1',
  orderId: 'ORD1',
  status: 'PENDING',
  createdAt: ago(60 * 60_000), // an hour old: past grace, inside the window
  ...over,
})
const pick = (rows: ReturnType<typeof row>[]) => selectReconcileCandidates(rows, NOW).map((r) => r.id)

// ── the ordinary case ──
ok('an hour-old PENDING row with a real charge id is selected', pick([row()]).length === 1)

// ── the boundary with #371 ──
ok(
  'a row still on its placeholder is NOT selected (it is #371 territory — nothing to ask the gateway)',
  pick([row({ chargeId: 'pending:p1' })]).length === 0,
)
ok('isPlaceholderCharge recognises the shape repo.placeholderChargeId writes', isPlaceholderCharge('pending:abc'))
ok('…and does not flag a real Omise id', !isPlaceholderCharge('chrg_test_123'))

// ── status ──
ok('APPROVED is not selected (already granted)', pick([row({ status: 'APPROVED' })]).length === 0)
ok(
  'REJECT with a REAL charge id is not selected (the gateway already said it will never be paid)',
  pick([row({ status: 'REJECT' })]).length === 0,
)

// ── the window ──
ok(
  'a row younger than the grace period is left alone (its webhook may still be in flight)',
  pick([row({ createdAt: ago(60_000) })]).length === 0,
)
ok(
  'a row older than the window is not chased forever',
  pick([row({ createdAt: ago(DEFAULT_WINDOW.windowMs + 60_000) })]).length === 0,
)

// ── ordering + cap ──
{
  const many = Array.from({ length: DEFAULT_WINDOW.limit + 5 }, (_, i) =>
    row({ id: `p${i}`, createdAt: ago((i + 2) * 60 * 60_000) }),
  )
  const got = selectReconcileCandidates(many, NOW)
  ok('the run is capped', got.length === DEFAULT_WINDOW.limit)
  // 🔴 oldest first: when the cap trims a run, the payment that has waited longest must not be the one
  // that gets dropped every single time — that is how one row starves forever while the count looks fine.
  ok('the OLDEST waiting payment is served first', got[0].id === `p${DEFAULT_WINDOW.limit + 4}`)
}

// ── what counts as paid (the same three facts the webhook path judges) ──
ok('paid + successful → settle', gatewaySaysPaid({ paid: true, status: 'successful' }))
ok('paid but not successful → no', !gatewaySaysPaid({ paid: true, status: 'failed' }))
ok('successful but not paid → no', !gatewaySaysPaid({ paid: false, status: 'successful' }))
ok(
  '🔴 the gateway does not know this charge (null) → NOT paid, and NOT a reason to act',
  !gatewaySaysPaid(null),
)

console.log(`\n  reconcile-selection-and-boundary: ${pass} passed`)
