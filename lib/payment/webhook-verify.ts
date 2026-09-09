// Omise webhook signature verification (mootech-fe#355) — PURE crypto, no env/DB, so its mutants redden in
// the MAIN `npm test` lane (lesson ②: never leave a money gate testable only in the DB suite).
//
// The signing secret is base64-decoded, and the HMAC-SHA256 is over `${timestamp}.` + the RAW body bytes
// (never re-serialized JSON — that is why the route must set bodyParser:false and read the raw stream).
// Fails CLOSED on any missing input.
//
// 🔴 `Omise-Signature` CAN CARRY MORE THAN ONE SIGNATURE, comma-separated, and a verifier MUST accept the
// delivery when ANY of them matches. Rolling the webhook secret generates the new one immediately and keeps
// the previous valid for twenty-four hours; every delivery inside that window is signed with BOTH and
// arrives as two comma-separated hex digests. This file used to compare the WHOLE header against one
// 64-character digest behind a length check, so a two-signature header (~129 characters) was refused before
// any comparison happened. The account holder rolled at 11:02 on 2026-09-09 and every delivery after it
// answered 401 — seven of them — while each charge was quietly rescued by the reconciler fifteen to thirty
// minutes later. Nobody looked at the header, because a green suite said the verifier was fine.
//
// 🔴 mootech-be `omise.service.ts verifyWebhookSignature` CARRIES THE SAME DEFECT — this file was ported
// from it line for line, and the comment saying so was treated as evidence that it was right. It has simply
// never met a rolled secret. A faithful port says nothing about whether the original was correct.
//
// Three details below are deliberate, because the specification promises none of them:
//   · compare DECODED BYTES, not hex text — nothing promises a hex case
//   · trim each candidate — nothing says whether whitespace follows the comma
//   · loop every part; do not assume exactly two, and do not stop at the first match
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
  const expected = createHmac('sha256', secret).update(payload).digest()

  let matched = false
  for (const part of signature.split(',')) {
    // 🔴 The length guard STAYS, moved inside the loop: `timingSafeEqual` throws on unequal lengths, and
    // `Buffer.from(x, 'hex')` does not throw on junk — it stops at the first non-hex character and hands
    // back a SHORT buffer. This line is what rejects `'abc'`, and an empty part between two commas.
    const candidate = Buffer.from(part.trim(), 'hex')
    if (candidate.length !== expected.length) continue
    // No early return: every candidate is compared, so the work done does not depend on WHICH signature
    // matched, or on whether the matching one came first.
    if (timingSafeEqual(candidate, expected)) matched = true
  }
  return matched
}

// The header's shape, carrying no signature, for the ONE log line at the route's 401 branch. A signature is
// not a secret, but there is no reason to print one: the fact nobody could establish on 2026-09-09, through
// two hours of eliminating keys, modes and timelines, was how many signatures the header carried. That fact
// is two numbers.
export function describeSignatureHeader(signature: string | null | undefined): string {
  if (!signature) return 'absent'
  return `len=${signature.length} parts=${signature.split(',').length}`
}

// Convenience for tests / callers that need to produce a valid signature (Omise's own algorithm), e.g. the
// e2e that fires a webhook at the local route. NOT used on the request path.
export function signOmisePayload(rawBody: Buffer, timestamp: string, secretB64: string): string {
  const secret = Buffer.from(secretB64, 'base64')
  const payload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody])
  return createHmac('sha256', secret).update(payload).digest('hex')
}
