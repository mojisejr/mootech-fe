// #360 — the reconciler's orchestration: pick rows, ask the gateway, settle the ones it confirms.
// Transport- and DB-agnostic (deps injected) so the whole loop is testable with a fake gateway — no live
// charge is ever created or read in a test.
//
// 🔴 WHY THERE IS NO SEPARATE "CLAIM" PHASE, although the ticket asked for the push-reminders shape.
// push-reminders marks `sent_at` BEFORE sending because its side effect leaves the system and cannot be
// recalled: a push already delivered cannot be un-delivered, so it accepts "miss" to prevent "double".
// Here the side effect is a DB write, and settleAndProvision is ONE transaction whose predicate is
// `charge_id = ? AND status <> 'APPROVED'`. The claim and the act are the same statement. Adding a claim
// phase would introduce the exact failure the push design knowingly accepts — marked, then crashed, and
// nobody comes back for it — except here that means A CUSTOMER WHO PAID NEVER GETS THEIR MEMBERSHIP.
// For money the trade runs the other way: a duplicate is already impossible (the DB arbitrates), so the
// only thing a claim phase could add is a permanent miss.
// ⇒ Two runs in parallel: both read, both call settle, exactly one UPDATE matches. Proven in the db suite.
import { gatewaySaysPaid, selectReconcileCandidates, DEFAULT_WINDOW, type ReconcileWindow } from './reconcile'
import { isRefusedCharge } from './gateway'

export type ReconcileDeps = {
  listUnsettled: (since: Date) => Promise<
    Array<{ id: string; chargeId: string; orderId: string; status: string; createdAt: Date }>
  >
  // 🔴 #455 slice 3 widened this by ONE optional field. The real adapter (omise-gateway.ts readOutcome)
  // has always returned failureCode; this type simply did not ask for it, because #360 only needed to know
  // "paid or not". It stays OPTIONAL so a fake gateway in a test may omit it, and so that absent reads as
  // "the gateway did not say" — never as a verdict. Same rule the other three optional fields on
  // ChargeResult carry (gateway.ts).
  retrieveCharge: (
    chargeId: string,
  ) => Promise<{ chargeId: string; paid: boolean; status: string; failureCode?: string | null } | null>
  /**
   * 🔴 TAKES ONLY THE charge_id — deliberately. #371 added an order_id recovery path to settleAndProvision,
   * and this cron does not use it: every row it selects already HAS a real charge id (that is the selection
   * rule), so there is nothing for order_id to rescue here. Keeping it out means this ticket does not
   * depend on #371 landing, and — more importantly — the boundary in reconcile.ts stays true in the code
   * and not only in a comment: #360 recovers by charge_id, #371 by order_id.
   */
  settle: (chargeId: string) => Promise<{ provisioned: boolean }>
  /**
   * 🔴 #455 slice 3 — the row is finished and nobody paid. Same function the webhook already calls
   * (`abandonByChargeId`, repo.ts:150): it refuses to touch an APPROVED row and it releases the
   * discount hold. This is a THIRD door onto one existing path, not a second implementation.
   */
  abandon: (chargeId: string, reason: string | null) => Promise<{ released: boolean }>
}

export type ReconcileSummary = {
  /** #455 — rows the gateway called terminal, moved out of PENDING by this run */
  abandoned?: number
  /** rows the window + rule selected */
  considered: number
  /** the gateway confirmed these were paid */
  confirmedPaid: number
  /** memberships granted by THIS run (a parallel run winning the race shows up as 0 here, not as an error) */
  provisioned: number
  /** the gateway could not be asked (transport error) — the row is left alone for the next run */
  unreachable: number
}

/**
 * One reconciliation pass. Never throws for a single bad row: one unreachable charge must not stop the
 * other 49 from being recovered, and the count of unreachable ones is reported instead of swallowed.
 * 🔴 Logs COUNTS only — never a user id, a charge id, or an amount (the ticket's rule, and the same one
 * the push cron follows).
 */
export async function runReconcile(
  deps: ReconcileDeps,
  now: Date = new Date(),
  w: ReconcileWindow = DEFAULT_WINDOW,
): Promise<ReconcileSummary> {
  const rows = await deps.listUnsettled(new Date(now.getTime() - w.windowMs))
  const candidates = selectReconcileCandidates(rows, now, w)
  const summary: ReconcileSummary = { considered: candidates.length, confirmedPaid: 0, provisioned: 0, unreachable: 0, abandoned: 0 }

  for (const row of candidates) {
    let charge: Awaited<ReturnType<ReconcileDeps['retrieveCharge']>>
    try {
      charge = await deps.retrieveCharge(row.chargeId)
    } catch {
      // 🔴 "cannot ask" is NOT "not paid" — leave the row exactly as it is and try again next run.
      summary.unreachable += 1
      continue
    }
    if (!gatewaySaysPaid(charge)) {
      // 🔴 #455 slice 3 — WHY THIS BRANCH EXISTS AT ALL.
      // A PromptPay charge that expires produces NO webhook: measured 0 of 124 expired charges carried
      // any event beyond charge.create (see schema.ts on chargeExpiresAt). So the door the webhook uses
      // (isTerminalFailure → abandonByChargeId, webhook.ts:67-72) is never reached for an expiry, and the
      // row sat at PENDING until the 7-day window dropped it — then forever. That is DoD ③ of #455.
      //
      // `isRefusedCharge` is the SAME predicate the create path uses (gateway.ts:118) and it shares
      // TERMINAL_FAILURE_STATUSES with the webhook path. Three doors, one definition of "finished" —
      // scripts/terminal-failure-agreement.test.ts is what stops them drifting apart.
      // A charge with no status is NOT terminal: an unanswered gateway is "not finished", never "refused".
      if (charge !== null && isRefusedCharge(charge)) {
        // Prefer what the gateway actually said. Fall back to a namespaced code of our own so that
        // "the bank refused" and "the customer walked away" stay separable in SQL — Feem chose to reuse
        // the REJECT status rather than add EXPIRED, and this column is what keeps that reversible.
        // `charge.status` is always truthy here: isRefusedCharge is only true when status is in
        // TERMINAL_FAILURE_STATUSES (gateway.ts:105), so there is no "gateway said nothing" case to
        // fall back for. The fallback that used to sit here was therefore unreachable — too proved it by
        // swapping the literal for MUTANT_DEAD_BRANCH and watching every test stay green, and repo.ts was
        // meanwhile telling Feem to query that value FIRST.
        // The full set this can produce is exactly: gateway_expired, gateway_failed, gateway_reversed —
        // or whatever Omise itself said, which always wins. Anyone matching on these should match in full.
        const reason = charge.failureCode ?? `gateway_${charge.status}`
        const out = await deps.abandon(row.chargeId, reason)
        if (out.released) summary.abandoned = (summary.abandoned ?? 0) + 1
      }
      continue // includes the null case: the gateway does not know it (yet)
    }
    summary.confirmedPaid += 1
    const res = await deps.settle(row.chargeId)
    if (res.provisioned) summary.provisioned += 1
  }
  return summary
}
