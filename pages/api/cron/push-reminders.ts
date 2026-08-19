// MuMate v2 · Vercel cron endpoint (goo · #288 phase 4). A DELIBERATELY THIN shell: verify the caller
// is really Vercel's scheduler, then hand off to lib/push. The production URL is public the moment it
// deploys, so the secret gate is the whole security boundary — and it FAILS CLOSED (authorize.ts).
//
// Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set (verified
// against Vercel docs 2026-07-15). Method is GET (how Vercel invokes crons).
//
// TWO PHASES, on purpose (ตู๋ F1): claimAndMark is ONE atomic auto-committed UPDATE — it marks sent_at
// and returns the rows in a single statement, so the mark is durable BEFORE any push leaves. Delivery
// then runs OUTSIDE that statement. A crash/timeout can only make a reminder miss, never double-send.
// (There is no long-held transaction, so a cron run no longer blocks a user deleting their own
// reminder — ตู๋ F4 falls out of this same change.)

import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { deliverClaimed } from '@/lib/push/run'
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

  const now = new Date()
  const repo = createDbRepo(db)
  const claimed = await repo.claimAndMark(now) // atomic claim+mark, auto-committed
  const summary = await deliverClaimed({ claimed, repo, send: sendPush }) // outside any txn

  return res.status(200).json({ ok: true, ...summary })
}
