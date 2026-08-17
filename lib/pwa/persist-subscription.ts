// MuMate PWA push · carry the device subscription to the server (goo · #298).
//
// This is the wire the whole PWA-push arc was missing. #285 asks the OS for a PushSubscription, #287 built
// POST/DELETE /api/v2/push/subscribe that stores it, #286 drew the mumate toggle — but nothing ever carried
// the subscription from the browser to the server. push_subscription stayed empty, so #288's cron would run,
// find zero rows, and nothing would ever ring, while every screen looked "done".
//
// Two layers here, split so a unit test stubs ONLY fetch and exercises the rest for real
// ([[thin-wrapper-mocked-both-sides]]):
//   • postPushSubscription / deletePushSubscription — thin transport, never throw, drain-on-error.
//   • toggleMumatePush — the direction/permission/tick orchestration, deps injected so it needs no browser.
import type { SubscribeResult } from './subscribe'

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

export interface MumateToggleDeps {
  /** Is the mumate destination currently ticked on? (⇒ this tap turns it OFF and DELETEs the row.) */
  isOn: boolean
  /** Ask the OS for permission + get-or-create the browser PushSubscription (lib/pwa/subscribe). */
  requestSubscription: () => Promise<SubscribeResult>
  /** The current device subscription, WITHOUT prompting — for the DELETE endpoint. null if none. */
  currentSubscription: () => Promise<PushSubscription | null>
  post: (subscription: PushSubscription) => Promise<boolean>
  remove: (endpoint: string) => Promise<boolean>
  /** Flip the mumate destination in the draft (draft.toggleDest('mumate')). Called ONLY on server success. */
  flip: () => void
}

/**
 * The mumate toggle's side effect. The tick must reflect the SERVER row, not the browser permission —
 * "the browser said yes" is not "the server has this device", and #298 exists precisely because those two
 * were conflated (the toggle ticked on permission while the row stayed empty).
 *
 *   turn ON  → request permission + subscribe → POST → flip ONLY on 201.
 *   turn OFF → DELETE the row → flip ONLY on success (or when there is no device subscription to delete).
 *
 * Any failure (denied / unsupported / needs-install / dismissed / POST 4xx-5xx / network) leaves the toggle
 * exactly where it was; the reason surfaces to the user via the capability re-read under the row.
 */
export async function toggleMumatePush(deps: MumateToggleDeps): Promise<void> {
  if (deps.isOn) {
    const sub = await deps.currentSubscription()
    if (!sub) {
      deps.flip() // no device subscription ⇒ nothing to delete ⇒ just untick
      return
    }
    if (await deps.remove(sub.endpoint)) deps.flip()
    return
  }
  const result = await deps.requestSubscription()
  if (!result.ok) return // not granted / not supported ⇒ never POST, never tick
  if (await deps.post(result.subscription)) deps.flip()
}
