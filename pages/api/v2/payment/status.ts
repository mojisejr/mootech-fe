// GET /api/v2/payment/status (mootech-fe#355) — the caller's OWN v2 payment records, scoped by the session
// user_id (never a user_id from the query).
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { listUserPayments } from '@/lib/payment/repo'
import { qrDeadlineState } from '@/lib/payment/qr-deadline'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })

  const now = new Date()
  const rows = await listUserPayments(who.userId)
  return res.status(200).json({
    payments: rows.map((r) => ({
      chargeId: r.chargeId,
      orderId: r.orderId,
      packageCode: r.packageCode,
      tierCode: r.tierCode,
      amountSatang: r.amountSatang,
      method: r.method,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      // #455 — when the QR stops being scannable, straight from the gateway. `null` = we do not know
      // (card charge, or a row older than 0011). The screen must not read null as "still valid".
      chargeExpiresAt: r.chargeExpiresAt ? r.chargeExpiresAt.toISOString() : null,
      // 🔴 #455 (ตู๋ #476) — the DECIDED state, so the screen never has to write the comparison itself.
      // `chargeExpiresAt` above stays for display (a countdown needs the timestamp); this is the thing to
      // branch on. There is deliberately no boolean here: 'unknown' must not be collapsible into 'live'.
      qrDeadline: qrDeadlineState(r.chargeExpiresAt, now),
    })),
  })
}
