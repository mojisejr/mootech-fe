// lib/auth/member-seal.ts — "ตราสมาชิก": the server's own signed statement of who the member is
// (mumate-member-identity-hardening-001 slice 1, 2026-10-02).
//
// §WHY. The #391 fallback (lib/v2/resolve-user.ts) identifies a member whose browser dropped the NextAuth
// session cookie. `cookie-mumate-id` is set client-side and is not httpOnly, so the server does not take it
// as proof on its own. The seal is the server's proof: an httpOnly cookie carrying the user_id and an HMAC
// over it, issued only on a response where a signed NextAuth session was just verified (register-login-fe,
// and resolveSessionUserId's session path).
//
// §KEY. Derived from NEXTAUTH_SECRET with its own label, so no new env var is needed and no other HMAC
// the app signs with that secret can double as a seal. Rotating NEXTAUTH_SECRET invalidates every seal,
// which only sends dropped-session members through sign-in once.
//
// §SHAPE. Same token format as lib/auth/liff-carry.ts (base64url JSON body + "." + base64url MAC). That
// file is temporary (removed after 2026-10-31), so this one does not import its signing code.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { appendSetCookie } from './liff-carry'

/** 30 days — NextAuth's default session lifetime. Refreshed while the member keeps a session. */
export const MEMBER_SEAL_TTL_SECONDS = 30 * 24 * 60 * 60

export function memberSealCookieName(secure: boolean): string {
  return `${secure ? '__Secure-' : ''}mumate.member`
}

export interface MemberSeal {
  /** the member's user_id */
  u: string
  /** unix seconds */
  exp: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function key(secret: string): Buffer {
  return createHmac('sha256', secret).update('mumate:member-seal:v1').digest()
}

function mac(body: string, secret: string): string {
  return createHmac('sha256', key(secret)).update(body).digest('base64url')
}

export function signMemberSeal(seal: MemberSeal, secret: string): string {
  const body = Buffer.from(JSON.stringify(seal)).toString('base64url')
  return `${body}.${mac(body, secret)}`
}

export function verifyMemberSeal(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number,
): MemberSeal | null {
  if (!token || !secret) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  const expected = Buffer.from(mac(body, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<MemberSeal>
    if (typeof p.u !== 'string' || !UUID.test(p.u) || typeof p.exp !== 'number') return null
    if (p.exp <= nowSeconds) return null
    return { u: p.u, exp: p.exp }
  } catch {
    return null
  }
}

export function memberSealSetCookie(token: string, secure: boolean): string {
  return [
    `${memberSealCookieName(secure)}=${token}`,
    'Path=/',
    `Max-Age=${MEMBER_SEAL_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export function memberSealClearCookie(secure: boolean): string {
  return [`${memberSealCookieName(secure)}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax', ...(secure ? ['Secure'] : [])].join('; ')
}

/** The verified seal on this request, or null. */
export function readMemberSeal(
  cookies: Partial<Record<string, string>> | undefined,
  secret: string | undefined,
  secure: boolean,
  nowSeconds = Math.floor(Date.now() / 1000),
): MemberSeal | null {
  return verifyMemberSeal(cookies?.[memberSealCookieName(secure)], secret ?? '', nowSeconds)
}

type HeaderRes = { getHeader(name: string): unknown; setHeader(name: string, value: string | string[]): unknown }

/**
 * Append a seal for `userId` to the response. Call ONLY after a signed session has been verified for
 * this user_id. Returns false (and writes nothing) without a secret, for a non-UUID id, or when the
 * response cannot carry headers.
 */
export function issueMemberSeal(
  res: unknown,
  userId: string,
  opts: { secret: string | undefined; secure: boolean; now?: number },
): boolean {
  const r = res as Partial<HeaderRes> | null
  if (!r || typeof r.getHeader !== 'function' || typeof r.setHeader !== 'function') return false
  if (!opts.secret || !UUID.test(userId)) return false
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const token = signMemberSeal({ u: userId.toLowerCase(), exp: now + MEMBER_SEAL_TTL_SECONDS }, opts.secret)
  appendSetCookie(r as HeaderRes, memberSealSetCookie(token, opts.secure))
  return true
}

/** True when the request's seal is missing, names someone else, or is past half its life. */
export function memberSealNeedsRefresh(current: MemberSeal | null, userId: string, nowSeconds: number): boolean {
  if (!current) return true
  if (current.u.toLowerCase() !== userId.toLowerCase()) return true
  return current.exp - nowSeconds < MEMBER_SEAL_TTL_SECONDS / 2
}
