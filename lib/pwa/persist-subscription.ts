// MuMate PWA push · carry the device subscription to the server (goo · #298, reframed 2026-08-17).
//
// This is the wire the whole PWA-push arc was missing. #285 asks the OS for a PushSubscription, #287 built
// POST/DELETE /api/v2/push/subscribe that stores it — but nothing ever carried the subscription from the
// browser to the server. push_subscription stayed empty, so #288's cron would run, find zero rows, and
// nothing would ever ring, while every screen looked "done".
//
// REFRAME: the destination switch was a dead end (only one destination left ⇒ not a choice), so it was
// removed. Ticking a ยาม now saves the reminder; the SAVE button registers the device. So this file is no
// longer a toggle — it is the SAVE action's push side (saveWithNotification), with the permission prompt
// LEADING the user gesture (Safari drops a prompt requested after an await).
//
// Two layers, split so a unit test stubs ONLY fetch and exercises the rest for real
// ([[thin-wrapper-mocked-both-sides]]):
//   • postPushSubscription / deletePushSubscription — thin transport, never throw, drain-on-error.
//   • saveWithNotification — the save-time permission/POST orchestration, deps injected so it needs no browser.
import type { SubscribeResult } from './subscribe'
import type { NotifyState } from '@/features/v2-calendar/notify-state'

const SUBSCRIBE_URL = '/api/v2/push/subscribe'

/**
 * POST this device's subscription. Returns true IFF the server stored it (201). Body matches the endpoint's
 * contract `{ endpoint, keys:{p256dh,auth}, userAgent? }` — PushSubscription.toJSON() already has that shape.
 * Never throws: a network failure is "not stored", so the caller leaves the toggle off.
 */
export async function postPushSubscription(
  subscription: PushSubscription,
  userAgent?: string,
): Promise<boolean> {
  let res: Response
  try {
    res = await fetch(SUBSCRIBE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...subscription.toJSON(), userAgent }),
    })
  } catch {
    return false // network down — retryable, but not persisted
  }
  // Drain the body so the request finishes (an unread body hangs Playwright's networkidle — the exact
  // trap #291 hit; see reminders-api.ts). ok/status stay readable after the body is consumed.
  try { await res.text?.() } catch { /* already consumed/absent — we only care to release it */ }
  return res.status === 201 || res.ok
}

/**
 * DELETE this device's subscription by endpoint. The server scopes the delete by session user_id, so this
 * can only remove the caller's own row. Returns true IFF it was removed. Never throws.
 *
 * NOTE (#298 reframe): after the destination switch was removed, NOTHING calls this — there is no per-device
 * "turn push off" control anymore. Kept intentionally for the future device-notification-settings surface;
 * do not delete it (ใบ: "คง deletePushSubscription ไว้").
 */
export async function deletePushSubscription(endpoint: string): Promise<boolean> {
  let res: Response
  try {
    res = await fetch(`${SUBSCRIBE_URL}?endpoint=${encodeURIComponent(endpoint)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
  } catch {
    return false
  }
  try { await res.text?.() } catch { /* ignore */ }
  return res.ok
}

export interface SaveWithNotifyDeps {
  /** The device's notification state (page reads it via notifyStateFrom). Decides whether to register. */
  notify: NotifyState
  /** Ask the OS for permission + get-or-create the browser PushSubscription. MUST be safe to call first. */
  requestSubscription: () => Promise<SubscribeResult>
  /** POST the device subscription to the server (idempotent UPSERT on endpoint). */
  post: (subscription: PushSubscription) => Promise<boolean>
  /** Persist the reminder itself (drives goo's save-flow machine). Returns whether the row was saved. */
  saveReminder: () => Promise<boolean>
}

export interface SaveWithNotifyResult {
  saved: boolean //  the reminder row was persisted
  pushed: boolean // the device subscription was stored (only ever attempted when the device can receive push)
}

/**
 * The save button's action after the #298 reframe. One tap: persist the reminder AND, when the device can
 * receive push, register it — with the permission prompt LEADING the gesture.
 *
 *   default / granted            → requestSubscription() FIRST (before any await) → save reminder → POST on grant
 *   denied / needs-install / unsupported → save the reminder ONLY, never touch the endpoint
 *
 * 🔴 The requestSubscription() call MUST happen before the reminder save is awaited. `Notification.request-
 * Permission()` (subscribe.ts) only shows a prompt inside the user gesture; awaiting the save first exits the
 * gesture in Safari and the box never appears. That ordering is the invariant mutant M9-b guards.
 *
 * The reminder is ALWAYS saved when committable, even if the user denies permission (ฟีม: ตั้งไว้ได้แม้เครื่อง
 * ยังไม่พร้อม). A push failure never blocks the save.
 */
export async function saveWithNotification(deps: SaveWithNotifyDeps): Promise<SaveWithNotifyResult> {
  // 1) permission request LEADS the gesture — fire it synchronously, before we await anything below.
  const wantsPush = deps.notify === 'default' || deps.notify === 'granted'
  const subscribing = wantsPush ? deps.requestSubscription() : null

  // 2) persist the reminder — always, regardless of the push outcome.
  const saved = await deps.saveReminder()

  // 3) if we asked, await the result and POST on grant. A denial/failure leaves `saved` intact.
  let pushed = false
  if (subscribing) {
    const result = await subscribing
    if (result.ok) pushed = await deps.post(result.subscription)
  }
  return { saved, pushed }
}
