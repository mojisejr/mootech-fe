// MuMate v2 · resolve the CALLER's internal user_id from the NextAuth session (goo · #287).
//
// The identity rule (same as first-run-reset, but this is the PERMANENT home — first-run-reset.ts is
// deleted whole by #248, so #287 must not import from it):
//
//   getServerSession → session.providerId  ─(user_provider.id_token, provider)→  user_provider.user_id
//
// 🔴 The client cannot forge this. Body / query / the MEMBER_ID cookie are ALL forgeable (MEMBER_ID is
// set client-side, not httpOnly — mootech-be#16 / #252 / #273). Only the signed NextAuth JWT (httpOnly)
// is trustworthy, so the server derives user_id itself and NEVER reads it from the request.
//
// 🔴 resolveUserFromRows is NOT `rows[0]` (ตู๋, #254 B2): the match is case-INsensitive on provider, the
// app's own dedupe is case-SENSITIVE, and nothing enforces uniqueness on (id_token, provider) at the DB
// level — so two rows for one human CAN exist. On anything that reads/writes a specific user we REFUSE
// on disagreement rather than pick whichever row the planner returned.

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { isSecureDeploy } from '@/lib/auth/liff-carry'
import { issueMemberSeal, memberSealNeedsRefresh, readMemberSeal } from '@/lib/auth/member-seal'

export type ResolvedIdentity =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 404 | 409; error: string }

const rowsOf = (r: unknown): Array<{ user_id?: unknown }> =>
  Array.isArray(r) ? r : ((r as { rows?: Array<{ user_id?: unknown }> })?.rows ?? [])

/** Collapse the rows matched for one provider account into the ONE user_id we may act on — or refuse. */
export function resolveUserFromRows(rows: Array<{ user_id?: unknown }>): ResolvedIdentity {
  const distinct = Array.from(
    new Set(
      rows
        .map((r) => (typeof r?.user_id === 'string' ? r.user_id.trim() : ''))
        .filter((id) => id !== ''),
    ),
  )
  if (distinct.length === 0) return { ok: false, status: 404, error: 'no account for this login yet' }
  if (distinct.length > 1) return { ok: false, status: 409, error: 'identity is ambiguous' }
  return { ok: true, userId: distinct[0] }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MEMBER_ID_COOKIE = 'cookie-mumate-id'

/**
 * กันเหนียว (เอ็ม 2026-09-23): true เมื่อ session ที่เซ็นแล้ว resolve เป็นคนละ user กับ MEMBER_ID cookie
 * (สภาพ "ล็อกอินค้าง 2 บัญชี" / cookie ค้างจาก login เก่า). หน้าจอ (person1 + รายชื่อเพื่อน) อ่านจาก cookie
 * แต่ calculate ยึด session → เพื่อนของ cookie จะหาไม่เจอใน session แล้วขึ้น "friend not found" ที่งง.
 * ให้ route จับเคสนี้แล้วบอก "โปรดเข้าสู่ระบบใหม่" แทน.
 *
 * 🔴 ถ้า resolveSessionUserId ใช้ fallback (ไม่มี session) → sessionUserId == cookie อยู่แล้ว → คืน false
 *    (ผู้ใช้ล็อกอินเดียวปกติไม่มีวันชนเคสนี้). ไม่มี cookie / cookie ไม่ใช่ UUID → false.
 */
export function memberCookieMismatch(req: NextApiRequest, sessionUserId: string): boolean {
  const raw = (req.cookies?.[MEMBER_ID_COOKIE] ?? '').trim()
  if (!UUID_RE.test(raw)) return false
  return raw.toLowerCase() !== sessionUserId.trim().toLowerCase()
}

/**
 * Fallback identity (#391, 2026-09-13): some browsers (Samsung Internet tracking-prevention / Secret Mode,
 * และ webview บางตัว) ทิ้ง cookie `__Secure-next-auth.session-token` ทำให้ getServerSession ว่าง →
 * ปฏิทิน/แจ้งเตือนขึ้น "ยืนยันตัวตนไม่ได้" ทั้งที่หน้าอื่น (ที่อ่าน MEMBER_ID) ยังล็อกอินอยู่.
 *
 * 🔴 hardening slice 1 (2026-10-02): `cookie-mumate-id` ตั้งฝั่ง client ไม่ใช่ httpOnly → server ไม่ใช้เป็นหลักฐานตัวตน
 * ลำพัง. fallback ต้องมี "ตราสมาชิก" (lib/auth/member-seal.ts: httpOnly, เซ็น HMAC, ออกเฉพาะตอนเพิ่งตรวจ session
 * ที่เซ็นแล้ว) ที่ระบุ user คนเดียวกับ cookie-mumate-id. ต้องมีทั้งคู่: ตรา = เซิร์ฟเวอร์เคยเห็น session ของคนนี้, cookie = แอปบนเครื่องนี้ยังล็อกอินเป็นคนนี้
 * (ออกจากระบบฝั่ง client ลบแค่ cookie นี้ → ตราที่ค้างใช้ต่อไม่ได้). แล้วยังตรวจว่ามีแถว user อยู่จริง.
 */
async function resolveMemberIdFallback(req: NextApiRequest): Promise<ResolvedIdentity> {
  const raw = (req.cookies?.[MEMBER_ID_COOKIE] ?? '').trim()
  if (!UUID_RE.test(raw)) return { ok: false, status: 401, error: 'not signed in' }
  const seal = readMemberSeal(req.cookies, process.env.NEXTAUTH_SECRET, isSecureDeploy())
  if (!seal || seal.u.toLowerCase() !== raw.toLowerCase()) return { ok: false, status: 401, error: 'not signed in' }
  try {
    const rows = rowsOf(await db.execute(sql`SELECT user_id FROM "user" WHERE user_id = ${seal.u} LIMIT 1`))
    return resolveUserFromRows(rows)
  } catch {
    return { ok: false, status: 401, error: 'not signed in' }
  }
}

/** Leave a seal on the response for a member whose signed session was just verified, unless the request
 *  already carries a fresh one for them. Best effort: never changes the identity answer. */
function refreshMemberSeal(req: NextApiRequest, res: NextApiResponse, userId: string): void {
  try {
    const secret = process.env.NEXTAUTH_SECRET
    const secure = isSecureDeploy()
    const now = Math.floor(Date.now() / 1000)
    if (!memberSealNeedsRefresh(readMemberSeal(req?.cookies, secret, secure, now), userId, now)) return
    issueMemberSeal(res, userId, { secret, secure, now })
  } catch {
    // headers already sent or an odd response object: the member simply gets the seal on a later request
  }
}

/** Read the caller's user_id from their signed session. 401 if not signed in, 404/409 per the rows.
 *  If the session cookie is missing (e.g. dropped by the browser), fall back to the MEMBER_ID cookie (#391),
 *  but only when the member seal names the same member. A verified session refreshes that seal. */
export async function resolveSessionUserId(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<ResolvedIdentity> {
  const session = (await getServerSession(req, res, authOptions)) as
    | { providerId?: string; provider?: string }
    | null

  const providerId = (session?.providerId ?? '').trim()
  const provider = (session?.provider ?? '').trim()
  if (!providerId || !provider) return resolveMemberIdFallback(req)

  const rows = rowsOf(
    await db.execute(
      sql`SELECT user_id FROM user_provider
          WHERE id_token = ${providerId} AND lower(provider) = lower(${provider})`,
    ),
  )
  // session ถูกต้อง → เชื่อผลตามแถว (404 = ไม่มีบัญชี, 409 = กำกวม) ไม่ fallback (fallback ใช้เฉพาะกรณี "ไม่มี session")
  const resolved = resolveUserFromRows(rows)
  // สมาชิกที่ล็อกอินอยู่ได้ตราสมาชิกในคำขอถัดไปเอง ไม่ต้องล็อกอินใหม่ — ถ้าเบราว์เซอร์ทิ้ง session ภายหลัง fallback ยังใช้ได้
  if (resolved.ok) refreshMemberSeal(req, res, resolved.userId)
  return resolved
}

const IDENTITY_MISMATCH_BODY = { reason: 'identity', error: 'บัญชีไม่ตรงกัน โปรดออกจากระบบแล้วเข้าสู่ระบบใหม่' } as const

export type RouteMember =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 404 | 409; body: Record<string, unknown> }

/**
 * For the routes that used to read cookie-mumate-id directly (hardening slice 1 step 2): the caller comes
 * from the signed session (or the sealed #391 fallback), and a member cookie naming someone else is refused
 * with the 409 `reason: 'identity'` the clients already understand. A refusal keeps the
 * `code: 'not_authenticated'` body those routes always sent.
 */
export async function resolveRouteMember(req: NextApiRequest, res: NextApiResponse): Promise<RouteMember> {
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return { ok: false, status: who.status, body: { code: 'not_authenticated', error: who.error } }
  if (memberCookieMismatch(req, who.userId)) return { ok: false, status: 409, body: { ...IDENTITY_MISMATCH_BODY } }
  return { ok: true, userId: who.userId }
}

/** Same, for routes that also serve anonymous callers: '' whenever there is no member we may act for. */
export async function resolveOptionalRouteMember(req: NextApiRequest, res: NextApiResponse): Promise<string> {
  try {
    const who = await resolveRouteMember(req, res)
    return who.ok ? who.userId : ''
  } catch {
    return ''
  }
}

/**
 * Same resolution, but WITHOUT the MEMBER_ID fallback (mumate-login-identity-001 slice 3).
 *
 * 🔴 Use this, not resolveSessionUserId, for any request that GRANTS ACCESS to an account —
 * attaching a login credential, removing one. The fallback above accepts `cookie-mumate-id`,
 * which is set client-side and is not httpOnly, i.e. forgeable. For reads and quotas that trade
 * was made deliberately (#391: some browsers drop the session cookie and the alternative was
 * locking those members out of the calendar). For a write that decides WHO CAN LOG IN AS WHOM it
 * is an account-takeover primitive: set the cookie to someone else's user_id, link your own
 * provider to it, and you own their account — their charts, their QI, their subscription.
 *
 * The cost of being strict here is small and lands in the right place: a member whose session
 * cookie the browser dropped cannot LINK a provider until they sign in again, which is a sentence
 * of inconvenience, not a lost account.
 */
export async function resolveSignedSessionUserId(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<ResolvedIdentity> {
  const session = (await getServerSession(req, res, authOptions)) as
    | { providerId?: string; provider?: string }
    | null

  const providerId = (session?.providerId ?? '').trim()
  const provider = (session?.provider ?? '').trim()
  if (!providerId || !provider) return { ok: false, status: 401, error: 'not signed in' }

  const rows = rowsOf(
    await db.execute(
      sql`SELECT user_id FROM user_provider
          WHERE id_token = ${providerId} AND lower(provider) = lower(${provider})`,
    ),
  )
  return resolveUserFromRows(rows)
}
