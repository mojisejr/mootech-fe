// Ops dashboard gate submit (#mumate-ops-dashboard-phase1 Step 1).
// POST { passkey, userId } -> validate -> set httpOnly cookie -> update last_seen_at ->
// best-effort Discord ping -> redirect back to /ops. Fail closed: OPS_DASHBOARD_KEY unset
// means this route always rejects (middleware also hides the whole /ops surface in that case).
import type { NextApiRequest, NextApiResponse } from 'next'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dashboardUsers } from '@/lib/db/schema'
import { opsCookieHeader } from '@/lib/ops/gate'

function redirectWithError(res: NextApiResponse, reason: string) {
  res.writeHead(303, { Location: `/ops?gate_error=${encodeURIComponent(reason)}` })
  res.end()
}

async function notifyDiscord(name: string) {
  const webhook = process.env.DASHBOARD_DISCORD_WEBHOOK
  if (!webhook) return
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `${name} เข้า ops dashboard` }),
    })
  } catch {
    // Best-effort notification only — never block login on Discord being unreachable.
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } })
    return
  }

  const key = process.env.OPS_DASHBOARD_KEY
  if (!key) {
    redirectWithError(res, 'unavailable')
    return
  }

  const passkey = typeof req.body?.passkey === 'string' ? req.body.passkey : ''
  const userId = typeof req.body?.userId === 'string' ? req.body.userId : ''

  if (passkey !== key || !userId) {
    redirectWithError(res, 'invalid')
    return
  }

  const [user] = await db
    .select({ id: dashboardUsers.id, name: dashboardUsers.name, isActive: dashboardUsers.isActive })
    .from(dashboardUsers)
    .where(eq(dashboardUsers.id, userId))
    .limit(1)

  if (!user || !user.isActive) {
    redirectWithError(res, 'invalid')
    return
  }

  await db
    .update(dashboardUsers)
    .set({ lastSeenAt: new Date() })
    .where(eq(dashboardUsers.id, userId))

  await notifyDiscord(user.name)

  res.setHeader('Set-Cookie', opsCookieHeader(key))
  res.writeHead(303, { Location: '/ops' })
  res.end()
}
