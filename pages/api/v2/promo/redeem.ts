// POST /api/v2/promo/redeem { code } — เพื่อนกรอกโค้ดเพื่อรับ Pro ฟรี 1 เดือน (Promo B).
// ต้องล็อกอิน (grant เขียน member_subscription ผูก user_id). คืนเหตุผลเป็น enum ให้ FE แปลเป็นข้อความ.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { redeemShareCode, type RedeemReason } from '@/lib/promo/share-repo'

const STATUS: Record<RedeemReason, number> = {
  OK: 200,
  INVALID: 404,
  SELF: 409,
  ALREADY: 409,
  ISSUER_FULL: 409,
  CAMPAIGN_FULL: 409,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })

  const code = typeof (req.body ?? {}).code === 'string' ? (req.body.code as string) : ''
  const result = await redeemShareCode(who.userId, code)
  return res.status(STATUS[result.reason]).json(result)
}
