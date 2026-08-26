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

  if (!ok || !body.chargeId) {
    return { kind: 'route', href: `/v2/shop/result?state=CARD_DECLINED&package_code=${pkg}`, keepPaying: false }
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
 * 🔴 CARD_DECLINED is the RIGHT screen here and the words still hold — "ยังไม่มีการตัดเงินจากบัตรใบนี้" is
 * true, and the bank genuinely is the next thing to try a different card against. What was wrong in #466
 * was using this screen for a case where the bank was never involved AND the user owns the plan already.
 * (Whether the copy should distinguish "we could not read your card" from "the bank said no" is
 * mootech-fe#447's question, not this one.)
 */
export function tokenizationFailedDestination(packageCode: string): PayDestination {
  return {
    kind: 'route',
    href: `/v2/shop/result?state=CARD_DECLINED&package_code=${encodeURIComponent(packageCode)}`,
    keepPaying: false,
  }
}
