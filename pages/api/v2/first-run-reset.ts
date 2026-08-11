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
import { getServerSession } from 'next-auth/next'
import { db } from '@/lib/db'
import { isV2Authenticated } from '@/lib/v2/gate'
import { resolveResetIdentity, resolveUserFromRows } from '@/lib/v2/first-run-reset'
import { authOptions } from '../auth/[...nextauth]'

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const session = (await getServerSession(req, res, authOptions)) as
    | { providerId?: string; provider?: string }
    | null

  const who = resolveResetIdentity({
    providerId: session?.providerId,
    provider: session?.provider,
    v2Authenticated: isV2Authenticated(req),
  })
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  try {
    // provider account id → internal user_id. user_provider.id_token holds providerAccountId
    // (pages/index.tsx:371 → UserRegisterOrLogin's id_token arg). Match the provider too, so two
    // accounts that happen to share an id across providers can never resolve to each other.
    //
    // 🔴 NO `LIMIT 1` (ตู๋, #254 B2). The first version took the first row the planner happened to
    // return, and three facts stack up to make that a "delete someone else's data" bug with no
    // attacker involved:
    //   ① here the match is case-INsensitive (lower(provider))
    //   ② the app's own dedupe is case-SENSITIVE — mootech-be user-provider.service.ts:32
    //      findOne({ id_token, provider }) — so 'google' and 'GOOGLE' are two rows to the writer
    //   ③ nothing enforces uniqueness on (id_token, provider) at the DB level: the entity has only
    //      @PrimaryGeneratedColumn('uuid') on id, and no unique index exists in any migration
    // So duplicates CAN exist, and `LIMIT 1` without ORDER BY is not "random" — it is "whichever row
    // the planner returns first", which changes after writes/vacuum. We fetch ALL matches instead and
    // refuse when they disagree: on a destructive endpoint, refusing beats guessing.
    const rows = rowsOf(
      await db.execute(
        sql`SELECT user_id FROM user_provider
            WHERE id_token = ${who.providerId} AND lower(provider) = lower(${who.provider})`,
      ),
    )
    const found = resolveUserFromRows(rows)
    if (!found.ok) {
      if (found.status === 409) {
        console.error('[first-run-reset] ambiguous identity for one provider account — refusing')
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
