// Omise webhook signature verification (mootech-fe#355) — PURE crypto, no env/DB, so its mutants redden in
// the MAIN `npm test` lane (lesson ②: never leave a money gate testable only in the DB suite).
//
// Ported EXACTLY from mootech-be omise.service.ts verifyWebhookSignature (the money we already take runs on
// this): the signing secret is base64-decoded, and the HMAC-SHA256 is over `${timestamp}.` + the RAW body
// bytes (never re-serialized JSON — that is why the route must set bodyParser:false and read the raw
// stream). Compared as hex with a length check then timingSafeEqual. Fails CLOSED on any missing input.
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyOmiseSignature(
  rawBody: Buffer,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  secretB64: string | null | undefined,
): boolean {
  // Fail closed: no secret configured, or no signature/timestamp header, or an empty/non-Buffer body.
  if (!secretB64 || !signature || !timestamp) return false
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) return false

  const secret = Buffer.from(secretB64, 'base64')
  const payload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody])
  const expected = createHmac('sha256', secret).update(payload).digest('hex')

  const sigBuf = Buffer.from(signature, 'utf8')
  const expBuf = Buffer.from(expected, 'utf8')
  if (sigBuf.length !== expBuf.length) return false // timingSafeEqual throws on length mismatch
  return timingSafeEqual(sigBuf, expBuf)
}

// Convenience for tests / callers that need to produce a valid signature (Omise's own algorithm), e.g. the
// e2e that fires a webhook at the local route. NOT used on the request path.
export function signOmisePayload(rawBody: Buffer, timestamp: string, secretB64: string): string {
  const secret = Buffer.from(secretB64, 'base64')
  const payload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody])
  return createHmac('sha256', secret).update(payload).digest('hex')
}
