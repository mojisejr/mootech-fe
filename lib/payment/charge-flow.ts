// Shared card/promptpay charge flow (mootech-fe#355) — added helper so charge.ts and promptpay.ts don't
// duplicate the session-gate + server-authoritative quote + fail-loud + record-PENDING logic. (Not in the
// ticket's file list; noted in the PR — it only factors the two route bodies, no new behavior.)
import type { NextApiRequest, NextApiResponse } from 'next'
import { randomInt } from 'node:crypto'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { quotePackage, UnsellablePackageError, type Quote } from './catalog'
import { getPackage, getUserEmail, insertPending } from './repo'
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
  // 🔴 body.user_id / body.amount / body.discount / body.code are DELIBERATELY IGNORED — the amount and
  // (later) the discount are computed server-side from the package the server looked up.
  if (!packageCode || (method === 'card' && !token)) {
    res.status(400).json({ error: 'missing token or package_code' })
    return
  }

  // Price + tier BEFORE creating any charge — an unknown/unsellable package fails loud here, never after
  // the card is charged (#355 ③).
  const pkg = await getPackage(packageCode)
  if (!pkg) {
    res.status(400).json({ error: 'unknown package_code' })
    return
  }
  let quote: Quote
  try {
    quote = quotePackage(pkg)
  } catch (e) {
    if (e instanceof UnsellablePackageError) {
      res.status(400).json({ error: 'package is not available' })
      return
    }
    throw e
  }

  const email = (await getUserEmail(who.userId)) ?? ''
  const orderId = makeOrderId()
  const charge = await create({ amountSatang: quote.amountSatang, token, email, orderId })

  await insertPending({
    userId: who.userId,
    packageCode: quote.packageCode,
    tierCode: quote.tierCode,
    amountSatang: quote.amountSatang,
    vatSatang: quote.vatSatang,
    // FREEZE the package's duration terms at charge time (ตู๋ #370 B2) — settle reads these, not payment_package.
    expire: pkg.expire,
    bufferDay: pkg.bufferDay,
    method,
    chargeId: charge.chargeId,
    orderId,
  })

  res.status(200).json({
    chargeId: charge.chargeId,
    status: 'PENDING',
    ...(charge.qrDownloadUri ? { qr: charge.qrDownloadUri } : {}),
  })
}
