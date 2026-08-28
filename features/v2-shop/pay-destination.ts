// features/v2-shop/pay-destination.ts — WHERE a checkout attempt goes, given what the server answered.
// PURE: no fetch, no router, no React. mootech-fe#466 (round 2, ตู๋'s review of 983d3b0).
//
// 🔴 WHY THIS FILE EXISTS, AND WHY THE FIRST ATTEMPT WAS NOT ENOUGH.
//
// #466's first fix moved the REFUSAL decision out of pages/v2/shop/checkout.tsx into refusedHref(). That
// moved half the decision: WHERE a refusal goes became testable, but WHEN it is asked — before or after the
// generic `!r.ok` fallback — stayed a line of ordering inside the page. ตู๋ proved the half that stayed was
// still unguarded by running the ticket's own DoD mutant against the real tree:
//
//   MC1  delete the two `if (refused…)` lines           → npm test 883 passed, rc=0   (green)
//   MC2  move `if (!r.ok …)` ABOVE the refusal check    → npm test 883 passed, rc=0   (green)
//        …and MC2 lands the user back on "ธนาคารปฏิเสธการชำระเงิน", the exact sentence this ticket exists
//        to delete. A mutant that restores the bug while the suite stays green is the definition of a
//        missing tooth.
//
// The repo had already written this lesson down — scripts/result-declined-rule.test.ts:3-5 says a rule that
// lived in a page "was never tested, and the branch that was missing stayed missing". checkout.tsx:5 says
// the same about itself. So the whole decision comes out, not the convenient half: this function owns the
// ORDER too, and the page is left with no branch to reorder.
import { isRefusedState } from './result-state'

export type PayLane = 'card' | 'promptpay'

/** The JSON the two charge routes can answer with (pages/api/v2/payment/charge.ts · promptpay.ts). */
export type PayBody = {
  chargeId?: string
  qr?: string
  authorizeUri?: string
  purchaseError?: string
}

export type PayDestination = {
  /** 'route' = our own Next router · 'external' = a URL that is NOT ours (the bank's 3-D Secure page). */
  kind: 'route' | 'external'
  href: string
  /**
   * Leave the pay button disabled after navigating?
   *
   * 🔴 true for every outcome where a charge EXISTS or is about to (#439's note in the page: re-enabling
   * the button while the browser is still leaving invites a second charge). false only where nothing was
   * created and the user may legitimately act again.
   */
  keepPaying: boolean
}

/**
 * THE ORDER IS THE RULE — and it is asserted, not commented.
 *
 *   1. a REFUSAL (409 + a purchaseError we know) — must be asked FIRST, because a refusal is also `!ok`,
 *      so any later fallback would swallow it and blame the bank or the network for it.
 *   2. the lane's own failure — different words per lane, deliberately (a card can be declined; a QR
 *      cannot, and "ลองใช้บัตรใบอื่น" is nonsense on the PromptPay lane).
 *   3. the bank wants the cardholder (3-D Secure) — leaves the app.
 *   4. success.
 */
export function payDestination(args: {
  lane: PayLane
  status: number
  ok: boolean
  body: PayBody
  packageCode: string
  amountSatang: number
  /** the plan they just tried to buy — the one to name for ALREADY_ON_THIS_TIER. */
  targetPlanName?: string | null
  /** the plan they already hold — the one to name for CANNOT_DOWNGRADE. */
  heldPlanName?: string | null
}): PayDestination {
  const { lane, status, ok, body, packageCode, amountSatang } = args
  const pkg = encodeURIComponent(packageCode)

  // ── 1. refused before any money moved (mootech-fe#456's gate) ──────────────────────────────────────
  // 🔴 BOTH halves are required. 409 alone is not proof: a quote whose price moved also answers 409
  // (lib/payment/charge-flow.ts) and belongs on a different screen. And an unrecognised purchaseError must
  // never reach the URL — pages/v2/shop/result.tsx falls back to PAYING for anything not in RESULT_COPY,
  // parking the reader on a spinner for a payment that never started.
  if (status === 409 && body.purchaseError && isRefusedState(body.purchaseError)) {
    const held = body.purchaseError === 'ALREADY_ON_THIS_TIER' ? args.targetPlanName : args.heldPlanName
    const q = new URLSearchParams({ state: body.purchaseError, package_code: packageCode })
    if (held) q.set('plan', held)
    return { kind: 'route', href: `/v2/shop/result?${q.toString()}`, keepPaying: false }
  }

  // ── 2. the lane's own failure ─────────────────────────────────────────────────────────────────────
  if (lane === 'promptpay') {
    if (!ok || !body.chargeId || !body.qr) {
      // ❌ never CARD_DECLINED here: there is no card on this lane to decline.
      return { kind: 'route', href: '/v2/shop/result?state=OFFLINE', keepPaying: false }
    }
    return {
      kind: 'route',
      href: `/v2/shop/qrcode?charge=${encodeURIComponent(body.chargeId)}&qr=${encodeURIComponent(body.qr)}&amount=${amountSatang}`,
      keepPaying: true,
    }
  }

  // ── 🔴 OUR OWN ENDPOINT FAILED. NOT THE BANK. (ตู๋, review r2 of 1d7b2c3) ─────────────────────────
  // This branch fires on any non-2xx from /api/v2/payment/charge that carried no recognised refusal: a
  // 500, a 400, a 401, a 409 for an expired quote. It said "ธนาคารปฏิเสธการชำระเงิน" for every one of
  // them.
  //
  // 🔑 AND A REAL DECLINE NEVER COMES THROUGH HERE. lib/payment/charge-flow.ts:192 answers **200** with
  // `status: 'REJECT'` when Omise refuses, and that surfaces later through /payment/status, where
  // result-state.ts turns `status === 'REJECTED' && method === 'card'` into CARD_DECLINED. So the branch
  // that names the bank was the ONE branch a bank could not reach — it fired only when we broke.
  //
  // That inversion is the same bug this ticket opened for, at a different line, and it was reachable
  // before #492 touched anything. Fixed here rather than left for a follow-up: shipping a change called
  // "stop blaming the buyer" while its widest entrance kept doing exactly that would be the claim being
  // louder than the mechanism.
  if (!ok || !body.chargeId) {
    return { kind: 'route', href: `/v2/shop/result?state=PAYMENT_SETUP_BROKEN&package_code=${pkg}`, keepPaying: false }
  }

  // ── 3. #439 — the bank wants to see the cardholder first. Not our router: not our destination. ─────
  if (body.authorizeUri) return { kind: 'external', href: body.authorizeUri, keepPaying: true }

  // ── 4. accepted, not settled. Only the webhook/reconciler may call it APPROVED. ────────────────────
  return {
    kind: 'route',
    href: `/v2/shop/result?state=PAYING&charge=${encodeURIComponent(body.chargeId)}&package_code=${pkg}`,
    keepPaying: true,
  }
}

/**
 * Where a checkout goes when the CARD DETAILS never became a token — a bad number/expiry/cvc, or omise.js
 * missing. Separate from payDestination on purpose: there is no server answer to reason about, because no
 * request was ever made. Folding it into a function whose arguments are `status` and `ok` would mean
 * inventing values for both, and an invented 402 is exactly the kind of half-true that this ticket is about.
 *
 * 🔴 THIS PARAGRAPH USED TO SAY CARD_DECLINED WAS THE RIGHT SCREEN HERE. It is not, and #492 answered
 * the question it deferred (ตู๋ flagged this line in two consecutive reviews — the second time because
 * the first fix moved the code and left the sentence).
 *
 * No charge exists when tokenisation fails, so no bank has seen this card, so no screen reached from here
 * may name one. The split is by whose fault it is: three codes the buyer can retype → CARD_UNREADABLE;
 * everything else, including a code we do not recognise → PAYMENT_SETUP_BROKEN. What #466 got wrong was
 * narrower than what was wrong here — it used this screen for a case where the user already owned the
 * plan; the bank was never involved in ANY case reaching this function.
 */
/**
 * Omise's codes for "we read the card and it is not usable". The buyer can fix these.
 *
 * 🔴 THIS IS AN ALLOW-LIST, AND THAT DIRECTION IS THE POINT (mootech-fe#492). Anything NOT named here —
 * including a null code, our key being wrong, omise.js failing to load, or a reason Omise adds next year —
 * falls to PAYMENT_SETUP_BROKEN. Telling buyers they got it wrong when we do not know is blaming somebody
 * without evidence, and the cost lands on them: they go and find another card for a problem we caused.
 */
const BUYER_FIXABLE = new Set(['invalid_card', 'expired_card', 'invalid_security_code'])

/**
 * 🔴 NEITHER BUCKET IS CARD_DECLINED, AND THAT IS THE CORRECTION (ตู๋, review r1 B1).
 *
 * Both are TOKENISATION failures: Omise refused the card details and no charge was ever created, so no
 * bank has seen this card. CARD_DECLINED says "ธนาคารปฏิเสธการชำระเงิน" — the exact sentence this ticket
 * exists to stop — and the first version of this function still sent the buyer-fixable half there.
 *
 * CARD_DECLINED stays reachable from ONE place: a server-side REJECT on the card lane
 * (result-state.ts, `status === 'REJECTED' && method === 'card'`), where a bank really did refuse.
 * Verified in review r2 — the `!ok` branch below used to be a second entrance, and it was the one a
 * bank could never reach.
 */
export function tokenizationFailedDestination(packageCode: string, code: string | null = null): PayDestination {
  const state = code !== null && BUYER_FIXABLE.has(code) ? 'CARD_UNREADABLE' : 'PAYMENT_SETUP_BROKEN'
  return {
    kind: 'route',
    href: `/v2/shop/result?state=${state}&package_code=${encodeURIComponent(packageCode)}`,
    keepPaying: false,
  }
}
