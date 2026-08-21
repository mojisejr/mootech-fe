// 🔴 TEMPORARY (#249) — team-preview only. **#248 deletes this file before launch.**
// If you are reading this after the preview gate is gone, it should not exist. Delete it.
//
// POST /api/v2/first-run-reset — put the CALLER back to "never finished first-run" so they can walk
// the three screens again on prod without anyone hand-running SQL against prod
// (testenv/scripts/reset-user.sh only ever talks to localhost:5433 — there is no prod equivalent).
//
// Two locks, both server-side:
//   1. the v2 preview gate (middleware guardV2 + re-checked here) — only the team can reach it
//   2. the NextAuth session — decides WHOSE row is touched. See lib/v2/first-run-reset.ts for why
//      neither the body nor the MEMBER_ID cookie may be trusted for that.
//
// Writes are the exact inverse of what consent.service.ts does, and nothing else:
//   user.onboarded_at → NULL · user.onboarding_goal → NULL · rows in consent for that user → gone
// It never deletes the user, the chart, or anything a real account depends on.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { isV2Authenticated } from '@/lib/v2/gate'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  // Preview gate FIRST — this stays exactly where resolveResetIdentity checked it (gate before
  // session), because resolveSessionUserId is the SHARED identity home (#287) and deliberately knows
  // nothing about the team-preview gate. #353: the endpoint now derives the caller's user_id through
  // that one shared module instead of keeping a second hand-synced copy of the session→user_id chain
  // (the very "THREE hand-synced copies" disease lib/usage-core.ts:23 records). The session→user_id
  // rule, the case-insensitive provider match, and the 409 "refuse-don't-guess" (ตู๋, #254 B2) all
  // live in lib/v2/resolve-user.ts now — see there for why body/query/MEMBER_ID are never trusted.
  if (!isV2Authenticated(req)) {
    return res.status(401).json({ ok: false, error: 'not in team preview' })
  }

  try {
    const found = await resolveSessionUserId(req, res)
    if (!found.ok) {
      if (found.status === 409) {
        console.error('[first-run-reset] ambiguous identity for one provider account — refusing')
        // This endpoint DELETEs consent rows. resolve-user returns the MECHANICAL reason ('identity is
        // ambiguous') shared with routes that delete NOTHING (reminders / push subscribe), so it must not
        // carry reset wording. The DESTRUCTIVE endpoint owns the human half: `phase.message` is rendered
        // raw on /v2 (TeamPreviewResetBadge.tsx:148), and on a data-deleting refusal the user most needs
        // to know their data was NOT touched. resolve-user.ts is left untouched. (ตู๋/บอง review, #353)
        return res.status(409).json({ ok: false, error: 'identity is ambiguous — not resetting' })
      }
      return res.status(found.status).json({ ok: false, error: found.error })
    }
    const userId = found.userId

    await db.execute(
      sql`UPDATE "user" SET onboarded_at = NULL, onboarding_goal = NULL WHERE user_id = ${userId}`,
    )
    await db.execute(sql`DELETE FROM consent WHERE user_id = ${userId}`)

    return res.status(200).json({ ok: true })
  } catch (err) {
    // Never leak the DB error text to a browser — but DO write it somewhere. The previous version
    // said "the server log keeps the detail" while logging nothing (ตู๋, #254): when this failed on
    // prod nobody could tell why, only that a button did nothing.
    console.error('[first-run-reset] failed', err)
    return res.status(500).json({ ok: false, error: 'reset failed' })
  }
}
