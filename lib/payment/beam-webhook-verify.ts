// Beam Checkout webhook signature — PURE, env-free, unit-testable against the vector Beam publishes
// (docs.beamcheckout.com/webhook-authentication). Beam lane slice 2, CIEL mootech-fe-beam-gateway-001.
//
// The scheme, verbatim from Beam's docs:
//   1. base64-decode the HMAC key shown on the webhook in Lighthouse (it differs per environment)
//   2. HMAC-SHA256 the EXACT raw request body bytes with that key
//   3. base64-encode the digest; it must equal the `X-Beam-Signature` header
// Differences from Omise's scheme (webhook-verify.ts) that matter here: there is NO timestamp in the
// message, the digest is base64 (Omise: hex), and Beam sends ONE signature (no comma-separated rotation
// pairs). Everything the Omise verifier learned still applies: raw bytes only (bodyParser off), constant
// time compare, fail closed on any missing input, never log the secret or the signature value.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function signBeamPayload(rawBody: Buffer, hmacKeyB64: string): string {
  const key = Buffer.from(hmacKeyB64, 'base64')
  return createHmac('sha256', key).update(rawBody).digest('base64')
}

/**
 * true only when a signature is present, a key is configured, and the base64 digests match byte for byte.
 * A malformed base64 signature compares unequal rather than throwing — a bad header is a 401, not a 500.
 */
export function verifyBeamSignature(rawBody: Buffer, signature: string | null | undefined, hmacKeyB64: string | undefined): boolean {
  if (!signature || !hmacKeyB64) return false
  const key = Buffer.from(hmacKeyB64, 'base64')
  if (key.length === 0) return false
  const expected = createHmac('sha256', key).update(rawBody).digest()
  let given: Buffer
  try {
    given = Buffer.from(signature.trim(), 'base64')
  } catch {
    return false
  }
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}
