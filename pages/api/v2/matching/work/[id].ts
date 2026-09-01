// GET /api/v2/matching/work/[id] — read one colleague comparison back (mootech-fe#585).
//
// 🔴 WHY A SEPARATE READER AND NOT `pages/api/v2/matching/[id].ts`. That one is driven by `log_matching`
// (`FROM log_matching lm` :50, `WHERE lm.matching_id` :54) and this lane deliberately writes no row there
// (ฟีมเคาะ 2026-09-01). Every colleague card would 404 through it. ฟีมเคาะ ② เมื่อ 2026-09-01: จอผลทำใหม่
// แยก ⇒ the read path is new too, and the pair reader is left untouched.
//
// 🔴 SCOPED TO THE CALLER. `matching_id` is a uuid, but "hard to guess" is not an authorisation rule —
// the row is fetched with `user_id` in the predicate, so another account's comparison is a 404 here.
import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workComparison, workComparisonCandidate, memberWithFriend } from '@/lib/db/schema'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { buildWorkResult, trimWorkResponse } from '@/features/v2-service/work-comparison'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  res.setHeader('Cache-Control', 'no-store, must-revalidate')

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  const id = String(req.query.id ?? '')
  if (!id) return res.status(400).json({ ok: false, error: 'id is required' })

  try {
    const [row] = await db
      .select()
      .from(workComparison)
      .where(and(eq(workComparison.matchingId, id), eq(workComparison.userId, who.userId)))
      .limit(1)
    if (!row) return res.status(404).json({ ok: false, error: 'not found' })

    // The people. 🔴 This list is NOT handed to the screen on its own — it is joined to the readings here,
    // on the server, by `buildWorkResult`. Handing the screen two arrays to line up by position was the
    // defect มุน caught at review: a wrong join renders perfectly, with every name and picture present and
    // the readings attached to the wrong people.
    const people = await db
      .select({
        slot: workComparisonCandidate.slot,
        friendId: workComparisonCandidate.friendId,
        rankScore: workComparisonCandidate.rankScore,
        timeKnown: workComparisonCandidate.timeKnown,
        name: memberWithFriend.name,
        surname: memberWithFriend.surname,
        pictureUrl: memberWithFriend.pictureUrl,
      })
      .from(workComparisonCandidate)
      .leftJoin(memberWithFriend, eq(memberWithFriend.id, workComparisonCandidate.friendId))
      .where(eq(workComparisonCandidate.matchingId, id))

    let parsed: unknown = null
    try {
      parsed = JSON.parse(row.result)
    } catch {
      // A row we cannot parse is a 500, not an empty screen: the user paid a unit and the data is there.
      console.error('[v2][matching/work] unparseable result for', id)
      return res.status(500).json({ ok: false, error: 'stored result is unreadable' })
    }

    // what we stored is already the trimmed block; re-running the normaliser keeps one shape in one place
    const comparison = trimWorkResponse({ comparison: parsed })
    const built = buildWorkResult(
      comparison,
      people.map((p) => ({
        slot: p.slot,
        friendId: p.friendId,
        name: p.name,
        surname: p.surname,
        pictureUrl: p.pictureUrl,
        timeKnown: p.timeKnown,
      })),
    )
    if (!built.ok) {
      // 🔴 5xx, never a 200 with a best-effort list. "these readings belong to other people" must not be
      // something a user can be shown.
      console.error('[v2][matching/work] join refused for', id, built.reason, built.detail)
      return res.status(500).json({ ok: false, error: 'stored result does not line up with its people' })
    }

    return res.status(200).json({
      ok: true,
      matching_id: row.matchingId,
      create_at: row.createAt,
      // ONE list, already in ranking order, each entry carrying its own person. There is nothing to join.
      // 🔴 The raw `comparison` is deliberately NOT here — see the note in ./index.ts.
      entries: built.entries,
      rankingComplete: built.rankingComplete,
    })
  } catch (e) {
    console.error('[v2][matching/work] read failed:', e)
    return res.status(500).json({ ok: false, error: 'internal error' })
  }
}
