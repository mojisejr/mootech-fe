// POST /api/v2/matching/work — the colleague lane: compare up to 3 people in one press (mootech-fe#585).
//
// 🔴 ROUTE PRECEDENCE. `pages/api/v2/matching/[id].ts` also matches this path shape. Next resolves the
// STATIC segment first, so `/api/v2/matching/work` lands here and never in `[id]` with id="work".
// ✓ observed in the build output, not assumed — `.next/server/pages-manifest.json` lists
// `/api/v2/matching/work` and `/api/v2/matching/work/[id]` as their own entries alongside
// `/api/v2/matching/[id]`. (An earlier version of this comment cited a spec file that was never written;
// ตู๋ caught the dangling reference on mootech-fe#593.)
//
// 🔴 The request NEVER names its subject. The caller's user_id comes from the signed session only, and
// every friend id is re-checked against that user inside the flow (#252/#273/be#16).
//
// Status vocabulary is the one the compatibility screens already read:
//   410 → 'quota'   the monthly ceiling was reached
//   5xx → 'system'  everything else, the engine included
// so an engine outage can never render as "โควตาเต็ม" (#263).
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { runWorkCompare } from '@/lib/matching/work-compare-flow'
import { MAX_CANDIDATES } from '@/lib/matching/bazi-work-client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  const body = (req.body ?? {}) as { friend_ids?: unknown }
  const raw = body.friend_ids
  if (!Array.isArray(raw) || raw.length === 0) {
    return res.status(400).json({ ok: false, error: 'friend_ids must be a non-empty array' })
  }
  if (raw.length > MAX_CANDIDATES) {
    return res.status(400).json({ ok: false, error: `เลือกได้สูงสุด ${MAX_CANDIDATES} คน`, max: MAX_CANDIDATES })
  }

  try {
    const out = await runWorkCompare({ userId: who.userId, friendIds: raw.map(String) })
    if (out.ok) {
      // `matching_id` is the key the result route reads back; a 2xx without it is a contract violation.
      // `entries` is the SAME shape GET /api/v2/matching/work/[id] answers with — one list, already in
      // ranking order, each entry carrying its own person — so the screen can render straight from the
      // 8.4s call without a second round trip, and without ever joining two arrays by position.
      //
      // 🔴 THE RAW `comparison` IS NOT SENT. It used to ride along "for debugging", which put a second
      // source of ranking and identity back in the payload with a comment asking people not to use it —
      // and this file's own sibling says in as many words that a warning is not a gate
      // (features/v2-service/work-comparison.ts). ตู๋ caught the contradiction on mootech-fe#593.
      // The ~7MB engine body never leaves the server either way.
      return res
        .status(200)
        .json({ ok: true, matching_id: out.matchingId, entries: out.entries, rankingComplete: out.rankingComplete })
    }
    switch (out.kind) {
      case 'quota':
        return res.status(410).json({ ok: false, reason: 'quota', error: out.message })
      case 'no-friend':
        return res.status(404).json({ ok: false, reason: 'system', error: 'friend not found for this account' })
      case 'too-many':
        return res.status(400).json({ ok: false, reason: 'system', error: `เลือกได้สูงสุด ${out.max} คน` })
      case 'unusable-birth':
        return res.status(422).json({ ok: false, reason: 'system', error: 'ข้อมูลวันเกิดไม่ครบ ไม่สามารถคำนวณได้' })
      case 'engine-down':
        console.error('[v2][matching/work] engine down:', out.detail)
        return res
          .status(503)
          .json({ ok: false, reason: 'system', error: 'ระบบคำนวณไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง' })
    }
  } catch (e) {
    console.error('[v2][matching/work] failed:', e)
    return res.status(500).json({ ok: false, reason: 'system', error: 'internal error' })
  }
}
