// POST /api/v2/payment/preview (mootech-fe#361) — price a package (+ optional discount code) WITHOUT
// charging, and hand back a server-fixed quote_id that charge must present.
//
// Session-gated like the rest of /api/v2. The body carries only { package_code, code? }: any amount /
// discount / percent a client sends is ignored — the money is computed here from the package and code rows
// the SERVER looked up (rule 1). A code that cannot be honoured is REFUSED with a reason (never silently
// priced at full).
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { priceFor } from '@/lib/discount/preview-flow'
import { insertQuote } from '@/lib/discount/repo'

// A quote is only good for a short while — the price it froze (VAT, code status, code quota) can move.
export const QUOTE_TTL_MS = 15 * 60 * 1000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })

  const body = (req.body ?? {}) as Record<string, unknown>
  const packageCode = typeof body.package_code === 'string' ? body.package_code : ''
  const codeStr = typeof body.code === 'string' && body.code.trim() !== '' ? body.code.trim() : null
  if (!packageCode) return res.status(400).json({ error: 'missing package_code' })

  const now = new Date()
  const priced = await priceFor(packageCode, codeStr, now)
  if (!priced.ok) {
    return res.status(priced.status).json({ error: priced.error, codeError: priced.codeError })
  }

  const expiresAt = new Date(now.getTime() + QUOTE_TTL_MS)
  const quoteId = await insertQuote({
    userId: who.userId,
    packageCode: priced.packageCode,
    codeId: priced.code?.id ?? null,
    listSatang: priced.listSatang,
    discountSatang: priced.discountSatang,
    amountSatang: priced.amountSatang,
    vatPercent: priced.vatPercent,
    expiresAt,
  })

  return res.status(200).json({
    quoteId,
    packageCode: priced.packageCode,
    listSatang: priced.listSatang,
    discountSatang: priced.discountSatang,
    amountSatang: priced.amountSatang,
    vatSatang: priced.vatSatang,
    vatPercent: priced.vatPercent,
    codeApplied: priced.code ? priced.code.code : null,
    expiresAt: expiresAt.toISOString(),
  })
}
