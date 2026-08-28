// features/v2-shop/pay-ready.ts — whether the Pay button may be pressed. One function, imported by BOTH
// the page and its test (mootech-fe#492, B2 from ตู๋'s review of 82d5c2f).
//
// 🔴 WHY THIS FILE EXISTS AT ALL. The first version of the test re-implemented this decision inline,
// which meant it asserted a COPY of the rule. ตู๋ deleted the real condition from
// pages/v2/shop/checkout.tsx and everything stayed green: `npm test` 1012 passed, tsx lane 79/79.
// A test that rebuilds the thing it is guarding proves the tester can write it twice, and nothing else.
//
// So the rule lives here, the page calls it, the test calls it, and deleting it from the page is a
// compile error rather than a silent pass.
import { validateCard, type CardState } from './card-rules'

export type PayReadyInput = {
  /** false while the server-priced quote is missing — no quote, no amount, nothing to charge. */
  hasQuote: boolean
  loading: boolean
  method: 'card' | 'promptpay'
  card: CardState
  /** The caller's clock. Never read from one here — see the CardForm props for what that default cost. */
  now: Date
}

/**
 * 🔴 PromptPay does not go through the card fields, so it must not be gated by them. Before #492 the
 * gate was "the four boxes are non-empty", which was wrong for cards (letters passed) and irrelevant
 * for PromptPay (there are no boxes). Both lanes are asserted, because a fix for one that silently
 * breaks the other is the shape this ticket family keeps producing.
 */
export function payReady({ hasQuote, loading, method, card, now }: PayReadyInput): boolean {
  if (!hasQuote || loading) return false
  if (method === 'promptpay') return true
  return validateCard(card, now).ok
}
