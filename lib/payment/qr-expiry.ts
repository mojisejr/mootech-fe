// PromptPay QR lifetime (mootech-fe#463) — PURE, no fetch, no side effects.
//
// 🔴 THE BUG THIS CLOSES. `createPromptPayCharge` never set an expiry, so every QR we have ever issued got
// Omise's account default. Measured on a real charge 2026-08-26 (chrg_test_68slhz9op3pqobfbpzb):
// created_at 2026-08-25T04:30:27Z → expires_at 2026-08-26T04:30:27Z = 24h exactly, which matches the
// PromptPay docs ("By default, the QR code expires 24 hours after creation").
//
// A 24-hour QR is a payable instrument left lying around: open the shop, get a QR, close the tab, change
// your mind, buy a different tier with a card — and the abandoned QR is still scannable until tomorrow.
// mootech-fe#456 closed the server side of that (a charge landing on someone already entitled is refused),
// but refusing money that has already left someone's bank is a worse outcome than never taking it.
//
// From the Omise Charges API: `expires_at` is an ISO-8601 timestamp on the CHARGE (not the source), and
// "a timestamp not exceeding 24 hours". There is no documented minimum, which is why #463's proof is a
// live charge, not a reading of this file.
//
// 🔴 WHY THE NUMBER LIVES HERE AND NOWHERE ELSE. mootech-fe#422 exists because "15 minutes" was written
// into four places that then drifted apart. One exported constant, one caller — a second copy of this
// number is the bug, not the convenience.

/**
 * ฟีมเคาะ 2026-09-09: a PromptPay QR is scannable for 15 minutes and then it is not.
 *
 * 🔴 IT WAS FIVE, AND FIVE NEVER WORKED ONCE. Read off the production rows on 2026-09-09, every real
 * PromptPay charge this product has ever taken:
 *
 *   2026-08-25 11:30   expired            charge_expires_at NULL   ← Omise's 24h default
 *   2026-08-26 13:43   APPROVED           charge_expires_at NULL   ← Omise's 24h default
 *   2026-09-03 12:08   gateway_expired    charge_expires_at 12:13:27
 *   2026-09-05 22:20   gateway_expired    charge_expires_at 22:25:27
 *
 * The only success was created while the lifetime was still the 24-hour default. Every charge that has
 * ever carried a five-minute `expires_at` expired: 0 for 2. Five minutes is the window a buyer has to
 * open a banking app, find PromptPay, scan, confirm, and let the transfer clear — and twice it was not
 * enough. #463 shortened this from 24 hours for a real reason (a payable instrument left lying around in
 * someone's photo roll), and that reason is unchanged; 15 minutes is still two orders of magnitude under
 * the default while being a window a person can actually make.
 *
 * 🔑 It matches the quote TTL (pages/api/v2/payment/preview.ts) and the reconciler's grace window on
 * purpose — not because they must agree, but because a buyer who is inside one is inside all of them.
 * The QR still dies well before RECONCILE_HORIZON_MS (grace + one cron period), so a QR that expires can
 * never be mistaken for a repair that is still pending.
 */
export const PROMPTPAY_QR_TTL_MS = 15 * 60 * 1000

/** Omise's documented ceiling for `expires_at`. Ours must stay under it. */
export const OMISE_MAX_EXPIRY_MS = 24 * 60 * 60 * 1000

export class QrExpiryConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QrExpiryConfigError'
  }
}

/**
 * Build the `expires_at` form field for a PromptPay charge.
 *
 * 🔴 THROWS instead of clamping or omitting. Omitting is how we got here — a missing field reads as
 * "fine" all the way to a 24-hour QR in a stranger's photo roll. Clamping would silently ship a lifetime
 * nobody chose. Both failure modes are invisible; an exception is not.
 *
 * `now` is injected so the tests can pin it, and so the value sent to Omise is computed from one clock
 * read rather than two.
 *
 * 🔴 WHY `ttlMs` IS A PARAMETER WITH A DEFAULT and not just the constant read inside. The two guards below
 * only mean something if a wrong value can reach them. Read straight off a `const`, they are unreachable
 * code that no test can redden — a guard that cannot be exercised is decoration, and this repo has been
 * burned by exactly that (a check whose comment claimed more than the check did, `hostnameIsRejected`,
 * #439). The single production caller passes nothing, so the number still lives in one place.
 */
export function promptPayExpiryFields(now: Date, ttlMs: number = PROMPTPAY_QR_TTL_MS): { expires_at: string } {
  const ttl = ttlMs
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new QrExpiryConfigError(`PROMPTPAY_QR_TTL_MS must be a positive number of ms, got ${ttl}`)
  }
  if (ttl > OMISE_MAX_EXPIRY_MS) {
    // Omise would reject this at charge-creation time — i.e. after the user pressed pay. Fail at our door.
    throw new QrExpiryConfigError(`PROMPTPAY_QR_TTL_MS exceeds Omise's 24h ceiling: ${ttl}ms`)
  }
  const at = new Date(now.getTime() + ttl)
  if (Number.isNaN(at.getTime())) {
    throw new QrExpiryConfigError('cannot compute expires_at from an invalid clock reading')
  }
  return { expires_at: at.toISOString() }
}
