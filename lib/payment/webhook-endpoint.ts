// v2 DYNAMIC WEBHOOK endpoint (mootech-fe#374) — PURE, no fetch, no side effects.
//
// 🔴 THE BUG THIS CLOSES. Omise gives one account ONE static webhook per mode. v1 (live key) already owns
// the live-mode one and it points at mootech-be. The day v2 goes live, both would want that single line:
// whichever one it points at, the OTHER charges successfully and NOBODY is provisioned — for every single
// transaction, not an edge case (#371 is the same shape, but only on a race).
//
// The fix is per-charge endpoints. From the Omise API reference for creating a charge:
//   webhook_endpoints — "URLs to which charge notifications are to be sent. This field can contain a
//   maximum of two URLs. Each URL must be secure (HTTPS) and must not be: localhost, an IPv4 or IPv6
//   address, a hostname with only numbers."
//   "All event notifications related to the associated charge and refund (if any) will be delivered to the
//   URLs defined here INSTEAD OF the default webhook_endpoint from account setting."
// ⇒ v2's charges stop touching the account-level line at all, so v1 keeps it and mootech-be is untouched.
//
// 🔴 WHY THE VALIDATION IS HERE AND NOT LEFT TO OMISE. Omise enforces these rules at charge-creation time,
// which is AFTER the user pressed pay. A misconfigured env would surface as a failed payment on a real
// person's screen. Validating before the request turns that into a deploy-time failure for us instead.
//
// 🔴 WHY MISSING ENV IS FATAL, NOT A SILENT FALLBACK. Falling back to the account's static webhook is
// exactly the collision this ticket exists to prevent: money would move and no one would be provisioned.
// Refusing to charge is the safe direction — same discipline as secretKey() in omise-gateway.ts.

export const OMISE_WEBHOOK_URL_ENV = 'OMISE_WEBHOOK_URL_V2'

export class WebhookEndpointConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookEndpointConfigError'
  }
}

// Hostname forms Omise rejects. Checked here so a bad value fails at our door, not at the till.
//
// 🔴 EXPORTED because #439 needs the same rule for the 3-D Secure return origin, and ตู๋ caught the first
// attempt at that: a hand-copied version that had drifted on day one (no lowercasing, no bracketed IPv6 —
// `https://[::1]/` passed the copy while this one rejects it). One implementation, two callers; there is
// no version of "keep the copies in sync" that survives contact with a second person.
export function hostnameIsRejected(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost') return true
  if (h.endsWith('.localhost')) return true
  // IPv6 arrives from URL as bracketed ("[::1]"); IPv4 and digits-only hostnames are plain.
  if (h.startsWith('[') && h.endsWith(']')) return true
  if (/^\d+(\.\d+)*$/.test(h)) return true // 127.0.0.1 AND "12345" — Omise rejects both
  return false
}

/**
 * The single v2 webhook URL, validated. Throws (never returns a fallback) when unusable.
 * `env` is injected so this is testable without touching process.env.
 */
export function v2WebhookUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[OMISE_WEBHOOK_URL_ENV]
  if (!raw || raw.trim() === '') {
    throw new WebhookEndpointConfigError(
      `${OMISE_WEBHOOK_URL_ENV} is not configured — refusing to charge, because without it Omise would ` +
        `deliver this charge's events to the ACCOUNT's static webhook, which belongs to v1 (#374).`,
    )
  }
  const value = raw.trim()
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new WebhookEndpointConfigError(`${OMISE_WEBHOOK_URL_ENV} is not a valid URL`)
  }
  if (url.protocol !== 'https:') {
    throw new WebhookEndpointConfigError(`${OMISE_WEBHOOK_URL_ENV} must be https (Omise rejects anything else)`)
  }
  if (hostnameIsRejected(url.hostname)) {
    throw new WebhookEndpointConfigError(
      `${OMISE_WEBHOOK_URL_ENV} host ${url.hostname} is rejected by Omise (localhost, IP address, or all-digit host)`,
    )
  }
  return value
}

/**
 * The form fields to merge into a create-charge POST. Form-encoded array syntax — the same shape the
 * adapter already uses for `metadata[orderId]`.
 *
 * 🔑 Returned as fields rather than applied inside the adapter so the "did we actually send it?" test can
 * assert on a value, and so BOTH charge paths (card + PromptPay) provably use one implementation.
 */
export function webhookEndpointFields(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  return { 'webhook_endpoints[]': v2WebhookUrl(env) }
}
