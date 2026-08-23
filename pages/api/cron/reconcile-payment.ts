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
import { listUnsettledPayments, settleAndProvision } from '@/lib/payment/repo'
import { runReconcile } from '@/lib/payment/reconcile-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  if (!isAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const summary = await runReconcile({
    listUnsettled: (since) => listUnsettledPayments(since, db),
    retrieveCharge: (chargeId) => omiseGateway.retrieveCharge(chargeId),
    settle: (chargeId) => settleAndProvision(chargeId),
  })

  // Counts only — no user id, no charge id, no amount (the ticket's rule; the push cron follows the same).
  if (summary.provisioned > 0 || summary.unreachable > 0) {
    console.warn(
      `[cron/reconcile-payment] considered=${summary.considered} confirmedPaid=${summary.confirmedPaid} ` +
        `provisioned=${summary.provisioned} unreachable=${summary.unreachable}`,
    )
  }
  return res.status(200).json({ ok: true, ...summary })
}
