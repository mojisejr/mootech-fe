// GET /api/quota?user_id=... — Phase 2 (#264): both usage quotas' REMAINDER in one call, for the
// pre-click indicator. matching = ดูดวงสมพงศ์ (year window, free capped / member unlimited); friend =
// เพิ่มเพื่อน (lifetime count, free & member capped). The remaining numbers use the SAME windows the
// server gates on (see lib/usage.ts) so the indicator can't say "เหลือ X" while the server refuses.
import type { NextApiRequest, NextApiResponse } from 'next'
import { checkMatchingQuota, checkFriendQuota } from '@/lib/usage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const userId = (req.query.user_id as string) ?? ''
  if (!userId) return res.status(400).json({ error: 'user_id required' })
  try {
    const [matching, friend] = await Promise.all([checkMatchingQuota(userId), checkFriendQuota(userId)])
    return res.status(200).json({ matching, friend })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
