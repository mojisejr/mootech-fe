// MuMate PWA · request-permission + create a PushSubscription (goo · #285 phase 1).
//
// SCOPE: this ticket ONLY asks the OS for permission and returns the browser's PushSubscription. It
// does NOT send it to any server — persisting the subscription is phase 3 (#287). The caller (the
// phase-1 diagnostic page, later มุน's button) logs / displays the result.
//
// Notification.requestPermission() MUST be called from a user gesture (a click handler) — browsers
// ignore it otherwise. This function assumes it is invoked from one; it does not fabricate a gesture.

import { capabilityFromEnv, readCapabilityEnv } from "./capability";

export type SubscribeFailure =
  | "unsupported" //     this runtime has no push APIs (and install won't help — e.g. LINE webview)
  | "needs-install" //   iOS Safari tab: must Add-to-Home-Screen first
  | "denied" //          user (or a prior choice) blocked notifications
  | "dismissed" //       user closed the prompt without choosing (permission stayed 'default')
  | "no-registration" // service worker never became ready
  | "missing-vapid" //   NEXT_PUBLIC_VAPID_PUBLIC_KEY not configured (ฟีม must set it)
  | "error"; //          subscribe() threw (bad key, push service down, …)

export type SubscribeResult =
  | { ok: true; subscription: PushSubscription }
  | { ok: false; reason: SubscribeFailure; error?: unknown };

/**
 * Ask for notification permission and create (or reuse) a push subscription.
 * @param vapidPublicKey the URL-safe base64 VAPID public key. Defaults to NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 */
export async function requestPushSubscription(
  vapidPublicKey: string | undefined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
): Promise<SubscribeResult> {
  const capability = capabilityFromEnv(readCapabilityEnv());

  if (capability.needsInstall) return { ok: false, reason: "needs-install" };
  if (capability.canReceivePush !== true) return { ok: false, reason: "unsupported" };
  if (!vapidPublicKey) return { ok: false, reason: "missing-vapid" };

  const permission = await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "denied" };
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  try {
    const registration = await navigator.serviceWorker.ready;
    // Reuse an existing subscription so re-subscribing is idempotent (one endpoint per device).
    const existing = await registration.pushManager.getSubscription();
    if (existing) return { ok: true, subscription: existing };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // required by Chrome — every push must show a notification
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    return { ok: true, subscription };
  } catch (error) {
    return { ok: false, reason: "error", error };
  }
}

/**
 * Convert a URL-safe base64 VAPID key to the Uint8Array the Push API's applicationServerKey needs.
 * (The Push API predates base64url support in atob, so the padding/char swap is done by hand.)
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
