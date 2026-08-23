// The reconciler's SELECTION RULE (#360) — pure, DB-free, so the rule can be argued with in a unit test
// instead of only observed through a cron run.
//
// ── WHERE THE LINE BETWEEN #360 AND #371 IS ─────────────────────────────────────────────────────────
// Two mechanisms recover an unsettled payment. They must never both own the same row, or they race to
// grant the same membership. The line is drawn by TRIGGER and by KEY, not by which one runs first:
//
//   #371   trigger = a webhook arrived   · problem = the row cannot be matched by charge_id
//          key     = order_id (written before any money moved, echoed back in Omise metadata)
//   #360   trigger = time (this cron)    · problem = no webhook ever arrived to trigger anything
//          key     = charge_id (already on the row, so the gateway can be asked about it directly)
//
// A row still holding its `pending:<id>` placeholder is therefore OUT of this cron's scope on purpose:
// with no real charge_id there is nothing to ask the gateway about. That row belongs to #371 if a webhook
// ever shows up — and to nobody if one never does. That gap is real, it is narrower (it needs BOTH the
// attach to fail AND every webhook delivery to be lost), and closing it needs a different mechanism
// (list charges by time window, match on metadata) which is its own ticket, not a second branch here.
//
// 🔑 The two cannot double-grant even if the line were crossed: settleAndProvision is one transaction with
// `status <> 'APPROVED'` in its predicate, so whichever arrives second changes 0 rows. The line is about
// keeping each mechanism's REASONING honest, not about repairing a missing lock.

/** The columns the rule needs. Anything wider would drag the DB shape into a pure module. */
export type ReconcileCandidate = {
  id: string
  chargeId: string
  orderId: string
  status: string
  createdAt: Date
}

export type ReconcileWindow = {
  /** how long to leave a fresh payment alone — a webhook in flight must be allowed to win normally. */
  graceMs: number
  /** how far back to look at all; older than this is a human's problem, not a cron's. */
  windowMs: number
  /** hard cap per run, so one bad day cannot turn into an unbounded run against the gateway. */
  limit: number
}

/** The default window. 15 minutes of grace is well past a normal webhook round-trip; 7 days is the
 *  horizon where "nobody noticed" stops being a cron's job and becomes an operator's. */
export const DEFAULT_WINDOW: ReconcileWindow = { graceMs: 15 * 60_000, windowMs: 7 * 24 * 3_600_000, limit: 50 }

/** A charge id the payment flow made up before Omise issued a real one (repo.placeholderChargeId). */
export function isPlaceholderCharge(chargeId: string): boolean {
  return chargeId.startsWith('pending:')
}

/**
 * PURE: of the rows handed in, which ones should this run ASK THE GATEWAY about?
 *
 * 🔴 Only `PENDING`. Not APPROVED (already granted, and settleAndProvision would no-op anyway) and not
 * REJECT — a REJECT row carrying a REAL charge id got there from a terminal-failure webhook, which is the
 * gateway telling us it will never be paid. Re-asking about it every 15 minutes for a week would turn a
 * settled fact into recurring gateway traffic.
 * (A REJECT row on a PLACEHOLDER is the #371 case — money may have moved, but there is no charge id to ask
 * about, so it is excluded by the placeholder rule below, not by the status rule.)
 */
export function selectReconcileCandidates(
  rows: ReconcileCandidate[],
  now: Date,
  w: ReconcileWindow = DEFAULT_WINDOW,
): ReconcileCandidate[] {
  const youngest = now.getTime() - w.graceMs
  const oldest = now.getTime() - w.windowMs
  return rows
    .filter((r) => r.status === 'PENDING')
    .filter((r) => !isPlaceholderCharge(r.chargeId)) // nothing to ask the gateway about — see the header
    .filter((r) => {
      const t = r.createdAt.getTime()
      return t <= youngest && t >= oldest
    })
    // oldest first: if the cap trims the run, the payment that has been waiting longest is served first.
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, w.limit)
}

/**
 * PURE: given what the gateway said about a charge, may this run settle it?
 * 🔑 The SAME three facts the webhook path judges (`isSettleable`), on purpose — one rule, two triggers.
 * `null` (gateway does not know the charge) is NOT a reason to settle and NOT a reason to reject: the row
 * stays PENDING and the next run asks again.
 */
export function gatewaySaysPaid(charge: { paid: boolean; status: string } | null): boolean {
  return charge !== null && charge.paid === true && charge.status === 'successful'
}
