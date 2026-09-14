// The SHAPES a v2_payment.charge_id can take before it is a real gateway id — pure, dependency-free, so
// both the repo (which writes them) and a gateway adapter (which may need to mint one) can import it
// without dragging the database into a unit test. Beam lane slice 3.
//
//   pending:<row id>       #361/#371 — reserved before any money moved; the gateway has not issued an id yet.
//                          NOT askable at the gateway (reconcile.ts excludes it).
//   link:<paymentLinkId>   Beam Payment Link — a hosted-page card purchase; Beam mints the charge only when
//                          the customer pays. ASKABLE (GET /api/v1/payment-links/{id}), so the reconciler
//                          includes it and rebinds the row to the real `ch_…` once one exists.
//   anything else          a real id (`chrg_…` Omise, `ch_…` Beam): the row is bound and never re-adopted.
export const PENDING_PREFIX = 'pending:'
export const LINK_PREFIX = 'link:'

export function placeholderChargeId(paymentId: string): string {
  return `${PENDING_PREFIX}${paymentId}`
}
export function linkChargeId(paymentLinkId: string): string {
  return `${LINK_PREFIX}${paymentLinkId}`
}
export function isLinkChargeId(chargeId: string): boolean {
  return chargeId.startsWith(LINK_PREFIX)
}
export function linkIdOf(chargeId: string): string {
  return chargeId.slice(LINK_PREFIX.length)
}

/**
 * May this row ADOPT a real charge id it did not carry before? True for the two provisional shapes. A row
 * already bound to a REAL charge belongs to that charge; taking it would move one person's payment onto
 * another's record (settleAndProvision refuses with AMBIGUOUS).
 */
export function isProvisionalChargeId(chargeId: string, rowId: string): boolean {
  return chargeId === placeholderChargeId(rowId) || isLinkChargeId(chargeId)
}
