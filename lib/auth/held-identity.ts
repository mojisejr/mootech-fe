// lib/auth/held-identity.ts — carry the first provider's verified identity across the
// proof of the second (mumate-login-identity-001 slice 5, owner decision 23).
//
// §WHY. A member who answers "yes, I have used MuMate with LINE" signed in a moment ago
// with Google, and NextAuth verified that Google identity. Signing in with LINE REPLACES
// the session (JWT strategy, no adapter), so without this the Google identity is gone
// and the link start route has to send the member through Google AGAIN — three provider
// screens for one answer. The owner walked it on 2026-09-26 and read the second Google
// screen as a fault.
//
// §SO THIS HOLDS IT, AND ONLY THE SERVER CAN WRITE IT. Issued by POST /api/auth/identity-hold
// from the SIGNED session NextAuth has just verified — never from anything in a request body,
// because a subject in a body is a claim, not a proof. HttpOnly, SameSite=Lax, Secure unless
// dev, 10 minutes: long enough for LINE's consent screen, short enough that one left behind
// on a shared machine is usually already dead. Spent by POST /api/auth/identity-attach, which
// clears it on every exit, success or not.
//
// §THE PROOF STANDARD DOES NOT DROP. The link flow proves: this browser holds a signed
// session for account A AND a fresh attestation of identity X. Here: this browser held a
// NextAuth-verified X within the last ten minutes AND now holds a signed session for A.
// The same two facts, gathered in the other order.
//
// §THE PATTERN IS merge-ticket.ts's, line for line where it can be: domain-prefixed HMAC with
// LINK_STATE_SECRET (read through a function that throws), signature checked before parsing,
// constant-time compare.
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextApiRequest } from 'next'

export const HELD_IDENTITY_TTL_MS = 10 * 60 * 1000
export const HELD_IDENTITY_COOKIE = 'mumate_held_identity'

/** Signed into every value so a link state or a merge ticket (same secret) cannot be
 *  presented here. Bump if the payload shape changes. */
const DOMAIN = 'mumate.held-identity.v1'

export interface HeldIdentityClaims {
  /** lower-case provider key: google | line */
  provider: string
  /** the provider's stable subject — Google `sub`, LINE userId */
  subject: string
  name: string
  email: string
  pictureUrl: string
}

export type HeldIdentityFailure = 'missing' | 'malformed' | 'bad-signature' | 'expired'

export type HeldIdentityResult =
  | { ok: true; value: HeldIdentityClaims }
  | { ok: false; reason: HeldIdentityFailure }

interface Payload {
  p: string
  s: string
  n: string
  e: string
  i: string
  t: number
}

function secret(): string {
  const s = process.env.LINK_STATE_SECRET
  if (!s) throw new Error('LINK_STATE_SECRET is not configured')
  return s
}

function sign(encoded: string): string {
  return createHmac('sha256', secret()).update(`${DOMAIN}.${encoded}`).digest('base64url')
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function issueHeldIdentity(claims: HeldIdentityClaims, now: number = Date.now()): string {
  const provider = text(claims.provider).toLowerCase()
  if (provider !== 'google' && provider !== 'line') throw new Error('issueHeldIdentity requires google or line')
  if (!text(claims.subject)) throw new Error('issueHeldIdentity requires a subject')
  const payload: Payload = {
    p: provider,
    s: text(claims.subject),
    n: text(claims.name),
    e: provider === 'line' ? '' : text(claims.email),
    i: text(claims.pictureUrl),
    t: now,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyHeldIdentity(cookieValue: string | undefined | null, now: number = Date.now()): HeldIdentityResult {
  if (!cookieValue) return { ok: false, reason: 'missing' }
  const dot = cookieValue.indexOf('.')
  if (dot <= 0 || dot === cookieValue.length - 1) return { ok: false, reason: 'malformed' }
  const encoded = cookieValue.slice(0, dot)
  const mac = cookieValue.slice(dot + 1)
  const want = sign(encoded)
  if (want.length !== mac.length || !timingSafeEqual(Buffer.from(want), Buffer.from(mac))) {
    return { ok: false, reason: 'bad-signature' }
  }
  let payload: Payload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Payload
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!payload || typeof payload.t !== 'number' || !text(payload.p) || !text(payload.s)) {
    return { ok: false, reason: 'malformed' }
  }
  if (now - payload.t > HELD_IDENTITY_TTL_MS || payload.t - now > 60_000) return { ok: false, reason: 'expired' }
  return {
    ok: true,
    value: { provider: payload.p, subject: payload.s, name: text(payload.n), email: text(payload.e), pictureUrl: text(payload.i) },
  }
}

export function heldIdentityCookie(value: string, opts: { secure: boolean }): string {
  const parts = [
    `${HELD_IDENTITY_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(HELD_IDENTITY_TTL_MS / 1000)}`,
  ]
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearHeldIdentityCookie(opts: { secure: boolean }): string {
  const parts = [`${HELD_IDENTITY_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

/** Both routes change who can sign in as whom, so a cross-site POST must never reach
 *  them. Same rule as pages/api/calculator/compute.ts: the Origin must name this host. */
export function isSameOriginPost(req: Pick<NextApiRequest, 'headers'>): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
