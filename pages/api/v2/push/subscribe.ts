// POST/DELETE /api/v2/push/subscribe — store this device's push mailbox (goo · #287).
//
// The subscription is ALWAYS bound to the caller's session user_id (resolveSessionUserId). The request
// never names a user, and reads/writes are scoped by that user_id — so no one can rebind or delete
// someone else's device subscription (#287's "ปิดเสียงเตือนเขาเงียบๆ" threat). Endpoint is the browser's
// own opaque URL; re-subscribing the same device is an idempotent UPSERT.
//
// This ticket only STORES the subscription. Nothing sends a push yet (phase 4, #288).
import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pushSubscription } from '@/lib/db/schema'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'

interface SubscribeBody {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  userAgent?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })
  const userId = who.userId

  try {
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as SubscribeBody
      const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
      const p256dh = body.keys?.p256dh?.trim() ?? ''
      const auth = body.keys?.auth?.trim() ?? ''
      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({ ok: false, error: 'subscription ไม่ครบ (endpoint/keys)' })
      }
      const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 512) : null

      // UPSERT on endpoint (globally unique to one device). A conflict means the SAME device already has a
      // row — re-subscribing REASSIGNS it to the current caller (set user_id) and refreshes the keys. So a
      // shared browser switching A→B moves the single row to B; there is never a second row for one device,
      // and #288 can't push A's reminders to a device B now controls. (ตู๋ #291 B2)
      await db
        .insert(pushSubscription)
        .values({ userId, endpoint, p256dh, auth, userAgent })
        .onConflictDoUpdate({
          target: [pushSubscription.endpoint],
          set: { userId, p256dh, auth, userAgent },
        })
      return res.status(201).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const endpoint =
        typeof req.query.endpoint === 'string'
          ? req.query.endpoint
          : ((req.body as SubscribeBody | undefined)?.endpoint ?? '')
      if (!endpoint) return res.status(400).json({ ok: false, error: 'ต้องระบุ endpoint' })
      await db
        .delete(pushSubscription)
        .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)))
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'POST, DELETE')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (err) {
    console.error('[push/subscribe] failed', err)
    return res.status(500).json({ ok: false, error: 'subscribe failed' })
  }
}
