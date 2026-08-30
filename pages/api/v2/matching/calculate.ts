// POST /api/v2/matching/calculate — ดวงสมพงษ์, computed on FE against the bazi engine (#357).
// Replaces the v1 hop through mootech-be POST /user-matching. v1's route stays live and untouched.
//
// 🔴 The request NEVER names its subject. be took user_id from the body (matching.controller.ts:13), and
// the MEMBER_ID cookie is client-set and forgeable (#252/#273/be#16). Here the caller's user_id comes from
// the signed session only, and the friend must belong to that user (lib/matching/calculate-flow.ts).
//
// Status vocabulary is the one the screen already reads
// (features/v2-service/hooks/useCompatibilityResult.ts:203-206):
//   410 → 'quota'   the free ceiling was reached  ← be used HttpStatus.GONE for exactly this
//   5xx → 'system'  everything else, including the engine being down
// So the engine failing can never render as "โควตาเต็ม": 503 ≠ 410, and the reason field says which.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { isMatchingType, runCalculateMatching } from '@/lib/matching/calculate-flow'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  // Identity first — an unsigned caller never reaches the engine and never writes a row (DoD).
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  const body = (req.body ?? {}) as { friend_id?: unknown; matching_type?: unknown }
  const friendId = typeof body.friend_id === 'string' ? body.friend_id.trim() : ''
  const matchingType = body.matching_type
  if (!friendId) return res.status(400).json({ ok: false, error: 'friend_id is required' })
  if (!isMatchingType(matchingType)) {
    return res.status(400).json({ ok: false, error: 'matching_type is not one of LOVE/BOSS/EMPLOYEE/FRIEND' })
  }

  try {
    const out = await runCalculateMatching({ userId: who.userId, friendId, matchingType })

    if (out.ok) {
      // `matching_id` is the key the result flow reads; a 2xx without it is a contract violation on the
      // client side (useCompatibilityResult.ts:199-200), so it is the one field that must always be here.
      return res.status(200).json({ ok: true, matching_id: out.matchingId, result: out.result })
    }

    switch (out.kind) {
      case 'quota':
        return res.status(410).json({ ok: false, reason: 'quota', error: out.message })
      case 'no-friend':
        return res.status(404).json({ ok: false, reason: 'system', error: 'friend not found for this account' })
      case 'unusable-birth':
        return res
          .status(422)
          .json({ ok: false, reason: 'system', error: 'ข้อมูลวันเกิดไม่ครบ ไม่สามารถคำนวณได้' })
      case 'engine-down':
        // 503, never 410 — the user still has quota and nothing was written. Saying "โควตาเต็ม" here would
        // be the #263 bug (a retry invited, or a ceiling blamed, for our own outage).
        console.error('[v2][matching] engine down:', out.detail)
        return res
          .status(503)
          .json({ ok: false, reason: 'system', error: 'ระบบคำนวณไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง' })
    }
  } catch (e) {
    console.error('[v2][matching] calculate failed:', e)
    return res.status(500).json({ ok: false, reason: 'system', error: 'internal error' })
  }
}
