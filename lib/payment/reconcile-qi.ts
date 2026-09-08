// #605 G1 — the QI half of the reconciler: repair a purchase whose money settled but whose QI never
// reached the engine. Transport- and DB-agnostic (deps injected) so the whole loop is testable in the
// MAIN `npm test` lane — the money-gate rule from webhook-verify.ts:2 applies here for the same reason:
// a repair path that only reddens in the DB suite is a repair path nothing in the normal loop protects.
//
// 🔴 WHY A SECOND PASS AND NOT A BRANCH INSIDE runReconcile. The two passes answer different questions
// over disjoint row sets:
//     runReconcile      status='PENDING'   "did the money arrive?"      → may CREATE an entitlement
//     runQiGrantRetry   status='APPROVED'  "did the goods leave?"       → may only RE-SEND one
// Folding them together would put a money-granting path and a goods-resending path behind one predicate,
// and the next person to widen that predicate would be widening both at once.
//
// 🔴 WHY RETRYING IS SAFE AT ALL. The engine's grant is idempotent on `ref = charge_id`
// (lib/qi/grant.ts:3-4): it checks its own ledger before adding, so a repeat credits nothing twice.
// THAT is the load-bearing fact. If the engine ever drops that guarantee, this file becomes a
// double-credit machine and must be deleted in the same change — a comment cannot be the only thing
// holding that together, so scripts/reconcile-qi.test.ts states it as a test.
import type { QiPurchaseRef } from '@/lib/qi/grant'

export type QiRetryDeps = {
  /** APPROVED + tier QI + qi_granted_at IS NULL. No time window — see repo.ts listUngrantedQiPurchases. */
  listUngranted: () => Promise<QiPurchaseRef[]>
  /** The SAME function settleAndProvision calls. One implementation of "credit this purchase", not two. */
  grant: (ref: QiPurchaseRef) => Promise<boolean>
  /** Records the confirmation. Returns whether this call was the one that wrote it. */
  markGranted: (chargeId: string) => Promise<boolean>
}

export type QiRetrySummary = {
  /** rows found unrepaired at the start of this run */
  considered: number
  /** rows the engine confirmed on this run AND that we then recorded */
  repaired: number
  /** rows the engine confirmed but whose note we could not write — safe, and retried next run */
  unrecorded: number
  /** rows the engine still would not confirm — the customer still does not have their QI */
  stillMissing: number
}

/**
 * One QI repair pass. Never throws for a single bad row: one unreachable engine call must not stop the
 * other rows from being repaired, and the count that failed is reported instead of swallowed.
 *
 * 🔴 Logs are the CALLER's job and counts only — no user id, no charge id, no amount (the rule
 * reconcile-run.ts follows, and the reason its own summary carries numbers rather than rows).
 *
 * 🔴 ORDER INSIDE THE LOOP IS THE WHOLE THING: grant FIRST, record SECOND, and never the reverse.
 * Recording first would mark a row repaired that the engine had not accepted, and nothing would ever
 * look at it again — which is precisely the failure this pass exists to end, reintroduced one line up.
 */
export async function runQiGrantRetry(deps: QiRetryDeps): Promise<QiRetrySummary> {
  const rows = await deps.listUngranted()
  const summary: QiRetrySummary = {
    considered: rows.length,
    repaired: 0,
    unrecorded: 0,
    stillMissing: 0,
  }

  for (const ref of rows) {
    let granted = false
    try {
      granted = await deps.grant(ref)
    } catch {
      // 🔴 "could not ask" is NOT "the customer has their QI" and it is NOT "the grant failed forever".
      // Leave the row exactly as it is — still NULL, still selected next run.
      summary.stillMissing += 1
      continue
    }
    if (!granted) {
      summary.stillMissing += 1
      continue
    }
    try {
      await deps.markGranted(ref.chargeId)
      summary.repaired += 1
    } catch {
      // The QI IS credited; only our note is missing. The row stays selected, the next run re-grants,
      // the engine dedups, and the note gets written then. Counted apart from `repaired` so a database
      // that is refusing writes cannot hide inside a success number.
      summary.unrecorded += 1
    }
  }

  return summary
}
