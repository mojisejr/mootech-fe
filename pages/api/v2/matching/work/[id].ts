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

    // The people, in the order the user typed them. The SCREEN must still order by comparison.ranking —
    // this list exists to put a name and a face on each candidate index, not to rank them.
    const people = await db
      .select({
        slot: workComparisonCandidate.slot,
        friendId: workComparisonCandidate.friendId,
        rankScore: workComparisonCandidate.rankScore,
        name: memberWithFriend.name,
        surname: memberWithFriend.surname,
        pictureUrl: memberWithFriend.pictureUrl,
      })
      .from(workComparisonCandidate)
      .leftJoin(memberWithFriend, eq(memberWithFriend.id, workComparisonCandidate.friendId))
      .where(eq(workComparisonCandidate.matchingId, id))

    let comparison: unknown = null
    try {
      comparison = JSON.parse(row.result)
    } catch {
      // A row we cannot parse is a 500, not an empty screen: the user paid a unit and the data is there.
      console.error('[v2][matching/work] unparseable result for', id)
      return res.status(500).json({ ok: false, error: 'stored result is unreadable' })
    }

    return res.status(200).json({
      ok: true,
      matching_id: row.matchingId,
      create_at: row.createAt,
      comparison,
      candidates: people.sort((a, b) => a.slot - b.slot),
    })
  } catch (e) {
    console.error('[v2][matching/work] read failed:', e)
    return res.status(500).json({ ok: false, error: 'internal error' })
  }
}
