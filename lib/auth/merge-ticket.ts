// lib/auth/merge-ticket.ts — the signed offer that survives the member's decision
// (mumate-login-identity-001 slice 4).
//
// §WHY A TICKET EXISTS AT ALL. DoD 4 forbids merging on the same press that starts
// the link: the member must be told what they are about to lose and confirm it
// separately. So the request that PROVES the second credential is not the request
// that performs the merge, and something has to carry the proof across the gap.
//
// It cannot be the browser. A subject arriving in a request body is a claim, not a
// proof — send someone else's Google subject and the server would move their
// credential onto your account. That is the same account-takeover shape
// lib/auth/link-state.ts exists to prevent, one step later in the flow.
//
// §SO THIS IS link-state.ts's PATTERN, DELIBERATELY AND ALMOST LINE FOR LINE.
// Signature checked BEFORE the payload is parsed; constant-time comparison; a secret
// read through a function that THROWS rather than falling back; HttpOnly, SameSite
// Lax, Secure-unless-dev; short TTL; and the cookie cleared on BOTH the success and
// the failure path by the route, so one ticket is spendable exactly once. A reader
// who knows that module knows this one, and the two cannot drift into different
// anti-forgery rules.
//
// §WHAT DIFFERS FROM link-state.ts, and why each difference is on purpose.
//   1. TTL is 5 minutes, not 10. link-state has to survive a provider's consent
//      screen on a slow connection; this only has to survive a member reading one
//      paragraph and pressing a button.
//   2. The signed string carries a DOMAIN PREFIX. Both modules sign with
//      LINK_STATE_SECRET, and without a prefix a value minted by one could in
//      principle be presented to the other. The prefix makes that structurally
//      impossible rather than relying on the field checks to notice.
//   3. There is no PKCE verifier or nonce. Nothing here talks to a provider; the
//      provider round trip is already finished and its result is what we are
//      holding.
//
// §WHAT IS NOT IN THE TICKET, AND THIS IS THE LOAD-BEARING PART. The ticket records
// the verdict this flow REACHED, so the screen can describe it. It is not the
// authority for the write. The confirm route recomputes the survivor from the
// database before moving anything, because a payment landing between the offer and
// the confirmation would change who is allowed to lose, and owner decision 8 does
// not bend for a cached answer.
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Five minutes. Long enough to read the confirmation, short enough that a ticket
 *  left behind on a shared machine is usually already dead. */
export const MERGE_TICKET_TTL_MS = 5 * 60 * 1000

/** Signed into every ticket so a value minted for another purpose with the same
 *  secret cannot be presented here. Bump the version if the payload shape changes
 *  in a way an older ticket must not satisfy. */
const DOMAIN = 'mumate.merge-ticket.v1'

export interface MergeTicketClaims {
  /** the member whose SIGNED session started this, carried so the confirm route
   *  never re-derives identity from anything the client can write */
  signedInUserId: string
  /** provider key, lower-case */
  provider: string
  /** the stable subject the provider attested in the request that minted this */
  subject: string
  /** the verdict this flow reached, for DESCRIBING the offer only */
  survivorUserId: string
  loserUserId: string
}

export type MergeTicketFailure =
  | 'missing'
  | 'malformed'
  | 'bad-signature'
  | 'expired'
  | 'provider-mismatch'
  /** the session presenting the ticket is not the session that was issued it */
  | 'session-mismatch'

export type MergeTicketResult =
  | { ok: true; value: MergeTicketClaims }
  | { ok: false; reason: MergeTicketFailure }

interface Payload {
  u: string
  p: string
  s: string
  w: string
  l: string
  t: number
}

// House convention (lib/calculator/nonce.ts, lib/auth/link-state.ts): a signing key
// is read through a function that throws when unset. A key that silently falls back
// to a constant is worse than no signing at all, because every deployment then
// shares it.
function secret(): string {
  const s = process.env.LINK_STATE_SECRET
  if (!s) throw new Error('LINK_STATE_SECRET is not configured')
  return s
}

function sign(encoded: string): string {
  return createHmac('sha256', secret()).update(`${DOMAIN}.${encoded}`).digest('base64url')
}

export function normalizeProviderKey(provider: string): string {
  return String(provider ?? '').trim().toLowerCase()
}

/** One cookie per provider, so two offers in two tabs cannot clobber each other. */
export function mergeTicketCookieName(provider: string): string {
  return `mumate_merge_${normalizeProviderKey(provider)}`
}

export function issueMergeTicket(claims: MergeTicketClaims, now: number = Date.now()): string {
  const provider = normalizeProviderKey(claims.provider)
  if (!claims.signedInUserId?.trim()) throw new Error('issueMergeTicket requires a signedInUserId')
  if (!provider) throw new Error('issueMergeTicket requires a provider')
  if (!claims.subject?.trim()) throw new Error('issueMergeTicket requires a subject')
  if (!claims.survivorUserId?.trim() || !claims.loserUserId?.trim()) {
    throw new Error('issueMergeTicket requires both sides of the decision')
  }

  const payload: Payload = {
    u: claims.signedInUserId,
    p: provider,
    s: claims.subject,
    w: claims.survivorUserId,
    l: claims.loserUserId,
    t: now,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyMergeTicket(
  cookieValue: string | undefined | null,
  expected: { provider: string; signedInUserId: string },
  now: number = Date.now(),
): MergeTicketResult {
  if (!cookieValue) return { ok: false, reason: 'missing' }

  const dot = cookieValue.lastIndexOf('.')
  if (dot <= 0 || dot === cookieValue.length - 1) return { ok: false, reason: 'malformed' }
  const encoded = cookieValue.slice(0, dot)
  const mac = cookieValue.slice(dot + 1)

  // Signature BEFORE parsing. Never hand attacker-controlled bytes to JSON.parse and
  // then act on the result, not even to choose an error message.
  const want = sign(encoded)
  if (want.length !== mac.length) return { ok: false, reason: 'bad-signature' }
  if (!timingSafeEqual(Buffer.from(want), Buffer.from(mac))) {
    return { ok: false, reason: 'bad-signature' }
  }

  let payload: Payload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Payload
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (
    !payload ||
    typeof payload.u !== 'string' ||
    typeof payload.p !== 'string' ||
    typeof payload.s !== 'string' ||
    typeof payload.w !== 'string' ||
    typeof payload.l !== 'string' ||
    typeof payload.t !== 'number' ||
    !Number.isFinite(payload.t)
  ) {
    return { ok: false, reason: 'malformed' }
  }

  if (now < payload.t || now - payload.t > MERGE_TICKET_TTL_MS) {
    return { ok: false, reason: 'expired' }
  }
  if (normalizeProviderKey(expected.provider) !== payload.p) {
    return { ok: false, reason: 'provider-mismatch' }
  }
  // The ticket belongs to the session it was issued to. Without this, a ticket lifted
  // from one member's browser could be presented by another and would move a
  // credential between two accounts that are nothing to do with them.
  const got = String(expected.signedInUserId ?? '')
  if (got.length !== payload.u.length) return { ok: false, reason: 'session-mismatch' }
  if (!timingSafeEqual(Buffer.from(got), Buffer.from(payload.u))) {
    return { ok: false, reason: 'session-mismatch' }
  }

  return {
    ok: true,
    value: {
      signedInUserId: payload.u,
      provider: payload.p,
      subject: payload.s,
      survivorUserId: payload.w,
      loserUserId: payload.l,
    },
  }
}

/** Serialise the ticket cookie.
 *
 *  SameSite MUST be Lax and must never be None, for the reason recorded in
 *  lib/auth/link-state.ts: on 2026-09-22 the session cookie was set to
 *  `None; Secure` to fix an iPad SSR case and login broke for EVERY provider,
 *  because LINE's in-app webview and several mobile browsers block or partition
 *  SameSite=None cookies. Lax is also what makes the confirm POST safe from a
 *  cross-site page: the cookie simply is not sent. */
export function mergeTicketCookie(
  provider: string,
  value: string,
  opts: { secure: boolean; maxAgeSeconds?: number } = { secure: true },
): string {
  const maxAge = opts.maxAgeSeconds ?? Math.floor(MERGE_TICKET_TTL_MS / 1000)
  const parts = [
    `${mergeTicketCookieName(provider)}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

/** Expire the ticket. Sent on the way out of confirm on BOTH the success and the
 *  failure path, so one offer can be spent exactly once. */
export function clearMergeTicketCookie(provider: string, opts: { secure: boolean } = { secure: true }): string {
  const parts = [`${mergeTicketCookieName(provider)}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}
