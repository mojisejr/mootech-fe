// Shared card/promptpay charge flow (mootech-fe#355) — added helper so charge.ts and promptpay.ts don't
// duplicate the session-gate + server-authoritative quote + fail-loud + record-PENDING logic. (Not in the
// ticket's file list; noted in the PR — it only factors the two route bodies, no new behavior.)
import type { NextApiRequest, NextApiResponse } from 'next'
import { randomInt } from 'node:crypto'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { getUserEmail, insertPendingReserved, attachChargeId, abandonPending } from './repo'
import { priceFor } from '@/lib/discount/preview-flow'
import { getQuote } from '@/lib/discount/repo'
import type { ChargeResult } from './gateway'

export function makeOrderId(): string {
  // parity with v1: 10 random decimal digits (crypto.randomInt)
  return Array.from({ length: 10 }, () => randomInt(0, 10)).join('')
}

export async function runChargeFlow(
  req: NextApiRequest,
  res: NextApiResponse,
  method: 'card' | 'promptpay',
  create: (args: { amountSatang: number; token?: string; email: string; orderId: string }) => Promise<ChargeResult>,
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
    charge = await create({ amountSatang: priced.amountSatang, token, email, orderId })
  } catch (e) {
    // The charge failed ⇒ give the code's quota back and kill the row, so a refused card can never leave a
    // discount code looking "full" (the return path the ticket requires).
    await abandonPending(reserved.paymentId, priced.code?.id ?? null)
    throw e
  }
  await attachChargeId(reserved.paymentId, charge.chargeId)

  res.status(200).json({
    chargeId: charge.chargeId,
    status: 'PENDING',
    amountSatang: priced.amountSatang,
    discountSatang: priced.discountSatang,
    ...(charge.qrDownloadUri ? { qr: charge.qrDownloadUri } : {}),
  })
}
