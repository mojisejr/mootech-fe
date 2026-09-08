// MuMate v2 · Vercel cron — the payment RECONCILER (#360). A deliberately thin shell, exactly like
// push-reminders: prove the caller is Vercel's scheduler, then hand off to lib/payment.
//
// WHAT IT IS FOR: a charge that succeeded and whose webhook never arrived. Three ways that happens for
// real — a Vercel timeout/cold start while Omise was delivering; a deploy killing the instance mid-flight;
// or us answering 2xx from somewhere that was not the webhook (the /maintenance case in #355 R1), after
// which Omise stops retrying and BOTH sides believe it is done. Nothing else in the system notices, which
// is why this endpoint exists at all.
//
// 🔴 THE SECRET GATE IS THE WHOLE SECURITY BOUNDARY — the production URL is public the moment it deploys,
// and this endpoint grants memberships. isAuthorized fails closed: no CRON_SECRET configured ⇒ deny
// everything, so a fresh deploy is never open while ฟีม is still setting the variable.
// (Reused from lib/push/authorize — one implementation of "is this really the scheduler", not two.)
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { isAuthorized } from '@/lib/push/authorize'
import { omiseGateway } from '@/lib/payment/omise-gateway'
import {
  listUnsettledPayments,
  settleAndProvision,
  abandonByChargeId,
  listUngrantedQiPurchases,
  markQiGranted,
} from '@/lib/payment/repo'
import { runReconcile } from '@/lib/payment/reconcile-run'
import { runQiGrantRetry } from '@/lib/payment/reconcile-qi'
import { grantQiPurchase } from '@/lib/qi/grant'
import { isReconcileEnabled } from '@/lib/payment/reconcile-flag'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  if (!isAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    // 🔴 A REFUSED CALLER AND A SWITCHED-OFF JOB ARE DIFFERENT EVENTS AND MUST NOT SHARE A LINE (#409).
    // One means somebody is knocking on a public endpoint that grants memberships; the other means we
    // turned it off on purpose. Logged the same, the first hides inside the second on the day it matters.
    console.warn('[cron/reconcile-payment] refused a caller (bad or missing CRON_SECRET)')
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  // #409 — the kill switch, AFTER the secret gate on purpose: an unauthorized caller must not be able to
  // learn whether the job is currently enabled. It answers 200 rather than an error, because being off is
  // not a failure — Vercel would retry an error, and there is nothing to retry.
  if (!isReconcileEnabled(process.env.RECONCILE_ENABLED)) {
    console.warn(
      '[cron/reconcile-payment] SKIPPED — RECONCILE_ENABLED is set to off. Payments whose webhook was ' +
        'lost are NOT being recovered while this stands. Unset the variable (or set it to on) and redeploy.',
    )
    return res
      .status(200)
      .json({ ok: true, skipped: 'disabled', considered: 0, confirmedPaid: 0, provisioned: 0, unreachable: 0, qi: { considered: 0, repaired: 0, unrecorded: 0, stillMissing: 0 } })
  }

  const summary = await runReconcile({
    listUnsettled: (since) => listUnsettledPayments(since, db),
    retrieveCharge: (chargeId) => omiseGateway.retrieveCharge(chargeId),
    settle: (chargeId) => settleAndProvision(chargeId),
    // #455 slice 3 — the same abandon path the webhook uses, reached from the cron for the expiry case
    // that never produces a webhook at all.
    abandon: (chargeId, reason) => abandonByChargeId(chargeId, reason, db),
  })

  // 🔴 #605 G1 — THE SECOND PASS: money settled, goods never left. Runs AFTER the PENDING pass on
  // purpose. The pass above can turn a PENDING QI row into an APPROVED one and fire its first grant;
  // running the repair first would look at the table before that row existed and leave a fresh failure
  // waiting a whole cron period for no reason.
  //
  // It shares the kill switch above with the PENDING pass, deliberately: both are the same kind of
  // thing — a repair job for a customer who already paid — and the reason RECONCILE_ENABLED defaults to
  // ON (reconcile-flag.ts) is exactly the reason this must not be separately switchable and forgotten.
  //
  // A throw here must not cost the PENDING pass its result: that pass may have just granted memberships,
  // and its counts are the only place those are reported.
  let qi = { considered: 0, repaired: 0, unrecorded: 0, stillMissing: 0 }
  try {
    qi = await runQiGrantRetry({
      listUngranted: () => listUngrantedQiPurchases(db),
      // The SAME function settleAndProvision calls (repo.ts) — one implementation of "credit this
      // purchase", so the retry cannot drift from the original.
      grant: (ref) => grantQiPurchase(ref),
      markGranted: (chargeId) => markQiGranted(chargeId, db),
    })
  } catch (error: unknown) {
    console.error(
      '[cron/reconcile-payment] QI repair pass failed to run — paid QI purchases may still be uncredited:',
      error instanceof Error ? error.message : error,
    )
  }

  // Counts only — no user id, no charge id, no amount (the ticket's rule; the push cron follows the same).
  // #455 slice 3: `abandoned` joins both the condition and the message. A run that moved 20 rows out of
  // PENDING but provisioned nothing used to be completely silent — the count reached only the JSON
  // response, and nobody reads a cron's response body. (too, round 1.)
  if (summary.provisioned > 0 || summary.unreachable > 0 || (summary.abandoned ?? 0) > 0) {
    console.warn(
      `[cron/reconcile-payment] considered=${summary.considered} confirmedPaid=${summary.confirmedPaid} ` +
        `provisioned=${summary.provisioned} abandoned=${summary.abandoned ?? 0} unreachable=${summary.unreachable}`,
    )
  }
  // 🔴 stillMissing is the line that matters and it gets its own condition: every row it counts is a
  // customer who paid for QI and does not have it. `considered > 0` alone would let a fully repaired run
  // and a fully failing run print the same shape of message.
  if (qi.stillMissing > 0 || qi.unrecorded > 0) {
    console.error(
      `[cron/reconcile-payment] QI REPAIR INCOMPLETE considered=${qi.considered} repaired=${qi.repaired} ` +
        `unrecorded=${qi.unrecorded} stillMissing=${qi.stillMissing} — stillMissing rows are paid customers ` +
        `whose QI is not credited`,
    )
  } else if (qi.repaired > 0) {
    console.warn(`[cron/reconcile-payment] QI repaired=${qi.repaired} of considered=${qi.considered}`)
  }
  return res.status(200).json({ ok: true, ...summary, qi })
}
