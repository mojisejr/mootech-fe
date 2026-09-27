// MuMate v2 · web-push transport wrapper (goo · #288 phase 4). The ONLY place that talks to the push
// service. It maps the push service's HTTP answer into a 3-way outcome the orchestrator acts on —
// this classification is the ตู๋ gate: 404/410 = the subscription is really gone (delete it), but
// 429/5xx = a TEMPORARY hiccup (keep it — deleting here would eat healthy subscribers when the push
// service has a bad minute). rก็คือ "รู้ได้ตอนยิงเท่านั้น" — we can only learn this from the response.

import webpush from 'web-push'
import type { PushPayload } from './payload'

export type SendOutcome =
  | { status: 'ok' } // 2xx — delivered to the push service
  | { status: 'gone' } // 404 / 410 — subscription permanently dead → remove the row
  | { status: 'transient' } // 429 / 5xx / network — temporary → KEEP the row, retry next tick

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

let vapidConfigured = false

// web-push keeps VAPID details in module state; set them once. Keys are guaranteed present on Vercel
// (prod + preview, verified 2026-08-19) and in .env.local. Absent = a real misconfig, so throw loudly
// rather than send unsigned (which the push service would reject anyway).
function ensureVapid(): void {
  if (vapidConfigured) return
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) {
    throw new Error('web-push: VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

export async function sendPush(target: PushTarget, payload: PushPayload): Promise<SendOutcome> {
  ensureVapid()
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      // Urgency:high + a short TTL → the push service delivers NOW instead of batching under Android
      // Doze (which held reminders until the phone was unlocked — the "เวลาไม่ตรง มาตอนเปิดเครื่อง" bug).
      // TTL 3600s = if the device is offline, drop the reminder after an hour rather than pile up stale ones.
      { urgency: 'high', TTL: 3600 },
    )
    return { status: 'ok' }
  } catch (err) {
    // WebPushError carries the push service's HTTP status on `.statusCode`. A network error has none
    // → falls through to transient (never delete on an error we cannot attribute to the endpoint).
    const code = (err as { statusCode?: number }).statusCode
    if (code === 404 || code === 410) return { status: 'gone' }
    // Apple's push endpoint (web.push.apple.com) rejects (e.g. bad VAPID_SUBJECT) were invisible — an
    // all-iOS silent miss looked identical to success. Log host+status so it surfaces in Vercel logs.
    try {
      console.error('[push] send failed', { statusCode: code ?? null, host: new URL(target.endpoint).host })
    } catch { /* URL parse can't fail for a stored endpoint, but never let logging throw */ }
    return { status: 'transient' }
  }
}
