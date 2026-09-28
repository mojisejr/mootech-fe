// GET /api/v2/promo/share-code — โค้ดแชร์ "Pro ฟรี 1 เดือน" ของผู้ใช้ (Promo B).
// คืน { eligible:false } ถ้ายังไม่เข้าเกณฑ์ (ต้องเคยใช้ MUMATE100 + จ่ายสำเร็จ) · ไม่งั้นออก/คืนโค้ด + used/max.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { isEligibleIssuer, getOrCreateShareCode, getCampaignConfig } from '@/lib/promo/share-repo'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })

  // แอดมินปิดการแชร์ต่อ → ไม่โชว์บล็อกแชร์ (เอาแค่คนนั้น)
  const cfg = await getCampaignConfig()
  if (!cfg.enabled) return res.status(200).json({ eligible: false })

  if (!(await isEligibleIssuer(who.userId))) return res.status(200).json({ eligible: false })
  const { code, used, max } = await getOrCreateShareCode(who.userId, cfg.maxPerIssuer)
  return res.status(200).json({ eligible: true, code, used, max })
}
