// Shared card/promptpay charge flow (mootech-fe#355) — added helper so charge.ts and promptpay.ts don't
// duplicate the session-gate + server-authoritative quote + fail-loud + record-PENDING logic. (Not in the
// ticket's file list; noted in the PR — it only factors the two route bodies, no new behavior.)
import type { NextApiRequest, NextApiResponse } from 'next'
import { randomInt } from 'node:crypto'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { getUserEmail, insertPendingReserved, attachChargeId, abandonPending, recordChargeFailure, decidePurchaseFor } from './repo'
import { priceFor } from '@/lib/discount/preview-flow'
import { getQuote } from '@/lib/discount/repo'
import type { ChargeResult } from './gateway'
import { isRefusedCharge } from './gateway'

export function makeOrderId(): string {
  // parity with v1: 10 random decimal digits (crypto.randomInt)
  return Array.from({ length: 10 }, () => randomInt(0, 10)).join('')
}

export async function runChargeFlow(
  req: NextApiRequest,
  res: NextApiResponse,
  method: 'card' | 'promptpay',
  create: (args: { amountSatang: number; token?: string; email: string; orderId: string; packageCode: string }) => Promise<ChargeResult>,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Identity from the signed session ONLY — the request never names the subject. body.user_id is ignored.
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) {
    res.status(who.status).json({ error: who.error }) // 401/404/409 — and NO charge is created
    return
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const packageCode = typeof body.package_code === 'string' ? body.package_code : ''
  const token = typeof body.token === 'string' ? body.token : undefined
  const quoteId = typeof body.quote_id === 'string' ? body.quote_id : null
  // 🔴 body.user_id / body.amount / body.discount / body.percent are DELIBERATELY IGNORED — the amount and
  // the discount are computed server-side. body.code is only a STRING key the server looks up itself.
  const codeStr = typeof body.code === 'string' && body.code.trim() !== '' ? body.code.trim() : null
  if (!packageCode || (method === 'card' && !token)) {
    res.status(400).json({ error: 'missing token or package_code' })
    return
  }

  // Price BEFORE any charge, with the SAME function preview used — an unknown/unsellable package or an
  // unusable code fails loud here, never after the card is charged (#355 ③).
  const now = new Date()
  const priced = await priceFor(packageCode, codeStr, now)
  if (!priced.ok) {
    res.status(priced.status).json({ error: priced.error, codeError: priced.codeError })
    return
  }

  // 🔴 #456 — THE REPURCHASE GATE, and its POSITION is the requirement, not a detail. It sits after pricing
  // (it needs the tier the package grants) and BEFORE insertPendingReserved — which means before the
  // v2_payment row, before the discount hold, and before Omise is touched at all. Refusing after the money
  // moved would mean taking payment and then saying the purchase was not allowed, which is worse than the
  // bug this ticket fixes.
  //
  // 🔴 A closed button on the shop screen (มุน, mootech-fe#457) is NOT this gate. The button is what a
  // cooperative client does; this is what happens to everybody else. Both read the same decision function,
  // so they cannot disagree about who may buy what.
  const purchase = await decidePurchaseFor(who.userId, priced.tierCode, now)
  if (!purchase.allow) {
    // 409, not 400: the request is well-formed and was legal to make — it conflicts with what this user
    // already holds. `reason` names the SITUATION so #457's screen can choose its own words for it.
    res.status(409).json({ error: 'already entitled', purchaseError: purchase.reason })
    return
  }

  // 🔴 With a code, the quote is MANDATORY (ตู๋ #372 ②): "you pay what you were shown" must not be a
  // client's option. Without a code the amount comes from the package alone and cannot drift today — when
  // #362 makes VAT editable from the back office it drifts for everyone, and this becomes unconditional.
  if (codeStr && !quoteId) {
    res.status(400).json({ error: 'a discount code requires the quote it was previewed with', codeError: 'QUOTE_REQUIRED' })
    return
  }

  // 🔴 Quote compare (ตู๋ B3): if the client presents a quote_id, the freshly computed money must MATCH the
  // quote the user was shown. VAT changed / code paused / window passed ⇒ the numbers move ⇒ refuse and say
  // so, instead of silently charging a different amount. The client never sends the amount — we compare our
  // recomputation against OUR stored quote.
  if (quoteId) {
    const q = await getQuote(quoteId, who.userId)
    if (!q) {
      res.status(400).json({ error: 'unknown quote' })
      return
    }
    if (q.expiresAt.getTime() <= now.getTime()) {
      res.status(409).json({ error: 'quote expired', quoteChanged: true })
      return
    }
    const same =
      q.packageCode === priced.packageCode &&
      q.amountSatang === priced.amountSatang &&
      q.discountSatang === priced.discountSatang &&
      q.vatPercent === priced.vatPercent &&
      (q.codeId ?? null) === (priced.code?.id ?? null)
    if (!same) {
      res.status(409).json({ error: 'price changed since the quote', quoteChanged: true })
      return
    }
  }

  // 🔴 RESERVE BEFORE MONEY (#361 ②): the v2_payment PENDING row + the discount reservation are written in
  // ONE transaction FIRST. A full/over-quota code is refused here — before the card is touched. The charge
  // id is attached after Omise accepts.
  // ONE orderId for both the stored row and Omise's metadata — they are the same reference (v1 parity).
  const orderId = makeOrderId()
  const reserved = await insertPendingReserved(
    {
      userId: who.userId,
      packageCode: priced.packageCode,
      tierCode: priced.tierCode,
      amountSatang: priced.amountSatang,
      vatSatang: priced.vatSatang,
      expire: priced.expire,
      bufferDay: priced.bufferDay,
      method,
      orderId,
      quoteId,
      discountSatang: priced.discountSatang,
      codeId: priced.code?.id ?? null,
    },
    priced.code
      ? {
          codeId: priced.code.id,
          vatPercent: priced.vatPercent,
          maxUsePerUser: priced.code.maxUsePerUser,
        }
      : null,
  )
  if (!reserved.ok) {
    res.status(409).json({ error: 'code is no longer available', codeError: reserved.reason })
    return
  }

  const email = (await getUserEmail(who.userId)) ?? ''
  let charge: ChargeResult
  try {
    charge = await create({ amountSatang: priced.amountSatang, token, email, orderId, packageCode })
  } catch (e) {
    // The charge failed ⇒ give the code's quota back and kill the row, so a refused card can never leave a
    // discount code looking "full" (the return path the ticket requires).
    await abandonPending(reserved.paymentId, priced.code?.id ?? null)
    throw e
  }
  // The charge EXISTS at the gateway now — refused or not. Attach the real id FIRST and unconditionally,
  // so the webhook can always find this row no matter what we conclude on the next line.
  await attachChargeId(reserved.paymentId, charge.chargeId)

  // 🔴 #437 — ASK THE GATEWAY'S OWN VERDICT. Until this block existed, the answer was thrown away and every
  // charge was reported as PENDING: a card Omise had already declined reached the screen as "in progress"
  // and stayed there forever, because nothing downstream ever learned otherwise. Omise answers a declined
  // card with HTTP 200 and object 'charge' (never an error object), so omisePost above did NOT throw —
  // which is exactly why a plain try/catch could never have caught this.
  if (isRefusedCharge(charge)) {
    // 🔴 ORDER IS LOAD-BEARING — reason first, verdict second (ตู๋, review of #440 round 2). Not because
    // the reason matters more, but because it is the only one of the two that nothing else can rebuild:
    // recordChargeFailure has exactly ONE caller in the repo (here), and the webhook never writes
    // failure_code. A hold left held is released later by abandonByChargeId; a reason never written is
    // gone. So if abandonPending is the line that throws, writing the reason first is what saves it.
    // Guarded by MR7 in scripts/payment-charge-route.test.ts — do not reorder these two calls.
    //
    // 🔴 WRITING DOWN THE REASON MUST NEVER BE ABLE TO STOP THE REFUND OF THE HOLD (ตู๋, review of #440).
    // These two lines are not equals. Releasing the discount hold and marking the row REJECT is REQUIRED —
    // skip it and the user's code stays spent on a payment that never happened. Recording WHY is a nicety.
    // A nicety is not allowed to take the required thing down with it, so it gets its own catch.
    //
    // This is not hypothetical: deploying this code before migration 0010 makes the UPDATE below raise
    // 42703 (undefined_column). Unguarded, that throw skipped abandonPending entirely — the caller got a
    // 500 AND the hold leaked. ตู๋ proved it with an injected 42703 plus a control run. Ordering the deploy
    // (migration first) would also avoid it, but ordering is a rule a human has to remember every time;
    // this catch is structure, and it also covers the DB simply being unreachable for a moment.
    try {
      await recordChargeFailure(reserved.paymentId, {
        code: charge.failureCode ?? null,
        message: charge.failureMessage ?? null,
      })
    } catch (e) {
      // Deliberately swallowed AND surfaced: the row still becomes REJECT below, we just lose the reason.
      console.error('[#437] could not record charge failure reason', { paymentId: reserved.paymentId, chargeId: charge.chargeId, error: e })
    }
    // Same call the webhook's terminal-failure branch uses: releases the discount hold AND marks REJECT.
    // Doing it here means the code is free again immediately, instead of waiting for a webhook round-trip.
    await abandonPending(reserved.paymentId, priced.code?.id ?? null)
    res.status(200).json({
      chargeId: charge.chargeId,
      status: 'REJECT',
      failureCode: charge.failureCode ?? null,
      amountSatang: priced.amountSatang,
      discountSatang: priced.discountSatang,
    })
    return
  }

  // Not refused. Still PENDING on purpose — accepted is NOT settled: only settleAndProvision (webhook or
  // reconcile cron) may write APPROVED, because that is the same step that creates member_subscription.
  // Marking APPROVED here would produce a paid row that granted nobody anything.
  res.status(200).json({
    chargeId: charge.chargeId,
    status: 'PENDING',
    amountSatang: priced.amountSatang,
    discountSatang: priced.discountSatang,
    ...(charge.qrDownloadUri ? { qr: charge.qrDownloadUri } : {}),
    // 🔴 #439 — the bank wants to see the cardholder before it decides. Handing this to the client is the
    // whole point: Omise returns it, and until #439 the adapter threw it away, so nobody could be sent.
    // Absent on any charge that did not need authentication — the client must treat absence as "carry on".
    ...(charge.authorizeUri ? { authorizeUri: charge.authorizeUri } : {}),
  })
}
