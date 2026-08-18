// MuMate v2 · Vercel cron endpoint (goo · #288 phase 4). A DELIBERATELY THIN shell: verify the caller
// is really Vercel's scheduler, then hand off to lib/push. The production URL is public the moment it
// deploys, so the secret gate is the whole security boundary — and it FAILS CLOSED: with no
// CRON_SECRET configured, every request is rejected (an un-secured cron is never left wide open).
//
// Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set (verified
// against Vercel docs 2026-07-15, not assumed). The user-agent / x-vercel-cron-schedule headers are
// spoofable and are NOT used as proof. Method is GET (how Vercel invokes crons).

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { runDueReminders } from '@/lib/push/run'
import { createDbRepo } from '@/lib/push/repo'
import { sendPush } from '@/lib/push/send'
import { isAuthorized } from '@/lib/push/authorize'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  if (!isAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  // One transaction wraps the whole run so the FOR UPDATE SKIP LOCKED claim (repo.ts) holds its lock
  // across the sends — that is what makes an overlapping invocation skip these rows instead of
  // double-sending them.
  const now = new Date()
  const summary = await db.transaction((tx) =>
    runDueReminders({ repo: createDbRepo(tx), now, send: sendPush }),
  )

  return res.status(200).json({ ok: true, ...summary })
}
