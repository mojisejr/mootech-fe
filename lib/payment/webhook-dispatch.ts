// The webhook's DECISION TABLE, lifted out of pages/api/v2/payment/webhook.ts unchanged so a second
// gateway's webhook route (webhook-beam.ts) can reuse it instead of copying eighty lines of money logic.
// Beam Checkout lane, CIEL workstream mootech-fe-beam-gateway-001 slice 1.
//
// 🔴 NOTHING HERE KNOWS WHICH GATEWAY SENT THE EVENT. Every branch judges a normalised ChargeEvent
// (gateway.ts) and calls the same repo functions the Omise route always called — settleAndProvision,
// revokeByChargeId, abandonByChargeId — which are DB-arbitered and idempotent. A gateway adapter's job is
// to verify its own signature and produce that ChargeEvent; from here on the money path is shared, and the
// tests that pin it (payment-webhook-db, reversal-revoke-db, payment-refund-event) pin it for both routes.
//
// `tag` is the log prefix ('[v2/payment/webhook]' or '[v2/payment/webhook-beam]') so a human reading the
// log can tell which provider's delivery each line came from. Log shapes are otherwise byte-identical to
// what the Omise route printed before the lift — those lines are the ones people grep for.
import type { ChargeEvent } from './gateway'
import { isSettleable, isTerminalFailure, isReversal, isRefund } from './gateway'
import { settleAndProvision, abandonByChargeId, revokeByChargeId } from './repo'

export async function dispatchChargeEvent(evt: ChargeEvent, tag: string): Promise<void> {
  // Only a completed, paid charge provisions — and settleAndProvision is idempotent + concurrency-safe, so
  // a retry or a simultaneous duplicate delivery grants at most once.
  if (isSettleable(evt) && evt.chargeId) {
    // #371 — orderId lets a paid charge find its row even when charge_id was never attached to it.
    const { outcome } = await settleAndProvision(evt.chargeId, evt.orderId)
    // 🔴 The answer to Omise stays 200 for every outcome, ON PURPOSE. The ticket warns against replying
    // non-2xx blindly, and the reason bites hardest here: a retry only helps if the cause is temporary, and
    // NO_ROW is not temporary — it means this charge is not in our books at all (a foreign charge, a wrong
    // key, a deleted row). Answering 5xx to that would make Omise retry it forever while nothing changes.
    // What must NOT stay the same is the LOG: these outcomes had one shape before, so "granted" and "money
    // we cannot account for" were indistinguishable in the one place a human would look.
    if (outcome === 'NO_ROW' || outcome === 'AMBIGUOUS') {
      console.error(
        `${tag} 🔴 PAID CHARGE WITH NO USABLE ROW (${outcome}) — charge=${evt.chargeId} ` +
          `order=${evt.orderId ?? '(none)'}. Money has moved and nobody has been granted anything. ` +
          `Check this charge in the Omise dashboard against v2_payment before assuming it is not ours.`,
      )
    } else if (outcome === 'RECOVERED') {
      console.warn(
        `${tag} recovered by order_id — charge=${evt.chargeId} order=${evt.orderId}. ` +
          `The row existed but never received its charge_id (attach failed, or this delivery beat it).`,
      )
    }
  } else if (isReversal(evt)) {
    // 🔴 #484 — CHECKED BEFORE isTerminalFailure ON PURPOSE. That branch answers `false` whenever the event
    // says `paid: true`, and a reversed charge WAS paid, so a reversal arriving that way would fall through
    // this whole handler and change nothing at all — not even the discount hold. Asking the narrower
    // question first makes the routing independent of a field we have never observed on a real reversal.
    const { revoked, shadowHandled } = await revokeByChargeId(evt.chargeId!)
    if (revoked && shadowHandled === 'NEEDS_HUMAN') {
      // revokeByChargeId already logged the detail. Kept as a second line here because this is the file a
      // human opens when they are looking at webhook behaviour, and a silent partial revoke is the exact
      // shape this ticket exists to end.
      console.warn(`${tag} #484 reversal handled, member_payment left for a human — charge=${evt.chargeId}`)
    }
    // The discount hold still has to come off, exactly as any other terminal end (#372 ③ layer 2).
    await abandonByChargeId(evt.chargeId!)
  } else if (isRefund(evt)) {
    // 🔴 #484 slice 6 — THE BRANCH THAT WAS MISSING, and whose absence let a real refund on production take
    // nothing back on 2026-09-09. A refund arrives as `refund.create` carrying the REFUND object, so the
    // charge id is on `data.charge` and every predicate above reads the wrong fields: `status` is the
    // refund's `closed`, never `reversed`, so isReversal cannot fire; `paid` is absent, so isTerminalFailure
    // sees a status it does not recognise and correctly does nothing.
    //
    // The revoke itself is unchanged and already trustworthy — revokeByChargeId carries twelve
    // database-backed tests. What was broken is the pipe to it, not the machinery behind it.
    const chargeId = evt.refundOfChargeId!
    const { revoked, shadowHandled, partial } = await revokeByChargeId(chargeId, { refundedSatang: evt.refundSatang })
    if (partial) {
      // Nothing was changed, deliberately. The product cannot issue a partial refund, so one arriving means
      // a human typed a smaller number in the dashboard — and taking a whole paid month away over that would
      // be worse than doing nothing. Loud, because doing nothing silently is what this ticket exists to end.
      console.warn(
        `${tag} 🔴 PARTIAL REFUND — charge=${chargeId} refunded=${evt.refundSatang} satang, ` +
          `which is less than the charge. NOTHING was revoked and the entitlement still stands. If this ` +
          `refund was meant to end the membership, it has to be completed or handled by hand.`,
      )
    } else if (revoked && shadowHandled === 'NEEDS_HUMAN') {
      console.warn(`${tag} #484 refund handled, member_payment left for a human — charge=${chargeId}`)
    } else if (!revoked) {
      // Not ours, already reversed, or never APPROVED. Named rather than silent: a refund we cannot act on
      // is exactly the case somebody will be looking for in this log later.
      console.warn(`${tag} refund changed nothing — charge=${chargeId}. Not ours, not APPROVED, or already reversed.`)
    }
    // Same as every other terminal end: the discount hold comes off (#372 ③ layer 2).
    await abandonByChargeId(chargeId)
  } else if (isTerminalFailure(evt) && evt.chargeId) {
    // 🔴 The charge ENDED without succeeding (failed/expired/reversed) ⇒ free its discount hold now instead
    // of waiting for the quote to expire (#372 ③ layer 2). An event that is merely not-finished-yet
    // (pending, or anything we don't recognise) falls through and changes nothing — releasing a slot that
    // can still be paid would let one code be spent twice.
    await abandonByChargeId(evt.chargeId)
  } else {
    // 🔴 #484 slice 6 — AN ACCEPTED DELIVERY THAT MATCHES NOTHING IS NO LONGER SILENT.
    // Before this line, a webhook that was received, understood as no-action and answered 200 was
    // indistinguishable from one that never arrived. That is the shape that hid the refund defect for two
    // weeks: the only way to find it was to poll the database for five minutes and then read the charge back
    // from Omise. One line would have said it. No PII — the event key, the ids we already log elsewhere, and
    // the status word.
    console.info(
      `${tag} no branch matched — key=${evt.key || '(none)'} status=${evt.status || '(none)'} ` +
        `charge=${evt.chargeId ?? '(none)'} refundOf=${evt.refundOfChargeId ?? '(none)'} paid=${evt.paid}. ` +
        `Accepted and no action taken.`,
    )
  }
}
