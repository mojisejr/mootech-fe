// GET /api/v2/payment/status (mootech-fe#355) — the caller's OWN v2 payment records, scoped by the session
// user_id (never a user_id from the query).
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { listUserPayments } from '@/lib/payment/repo'
import { qrStatusFields } from '@/lib/payment/qr-deadline'

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
      // 🔴 #455 — สองช่องนี้สร้างพร้อมกันจากค่าเดียว และ payload ที่ขัดกันเองสร้างไม่ได้เลย
      // เหตุผลเต็มอยู่ใน lib/payment/qr-deadline.ts (ทาง ข ของมุน · ฟันของตู๋ #476)
      ...qrStatusFields(r.chargeExpiresAt, now),
    })),
  })
}
