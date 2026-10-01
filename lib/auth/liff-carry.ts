// lib/auth/liff-carry.ts — "ใบส่งต่อ" สำหรับสมาชิกที่สมัครผ่าน LIFF (mumate-login-identity-001 slice 7g, 2026-10-02).
//
// §ปัญหา. 2026-09-28 21:41 → 2026-10-01 17:25 (Bangkok) LINE ในแอปล็อกอินผ่าน LIFF (#846) ซึ่งช่อง LIFF อยู่คนละ
// LINE Provider กับช่อง Login → LINE userId (sub) คนละค่า. คนที่ "สมัครครั้งแรก" ในช่วงนั้นมีบัญชีที่ผูกกับ sub ฝั่ง LIFF
// อย่างเดียว. ตั้งแต่ #860 ล็อกอิน LINE มีทางเดียว (ช่อง Login) → sub ใหม่ ไม่มีเจ้าของ → ได้บัญชีใหม่ว่าง ๆ แล้วของในบัญชีเดิม
// (Qi, PRO ที่จ่าย, ดวง, โค้ดเชิญ) หายไปจากมือ. เกิดทันทีที่ session ยุค LIFF จบ (MEMBER_ID อายุ 7 วัน).
//
// §ทางแก้ (owner อนุมัติ 2026-10-02). ตอนจบ session ยุค LIFF เซิร์ฟเวอร์ออก "ใบส่งต่อ" = cookie ที่เซ็นด้วย HMAC
// (httpOnly, 30 นาที, path /api/auth) ระบุบัญชีที่ session นั้นเป็นเจ้าของ. ล็อกอิน LINE ครั้งถัดไปในเบราว์เซอร์เดียวกัน
// ถ้า sub ใหม่ "ยังไม่มีเจ้าของ" → ผูก sub ใหม่เข้าบัญชีเดิมแทนการสร้างบัญชีใหม่.
//
// §หลักฐานตัวตน = session NextAuth ที่เราเซ็นเอง (httpOnly) ในเบราว์เซอร์เดียวกัน — ไม่ใช่อีเมล (owner decision 2).
// §ขอบเขตแคบโดยตั้งใจ: ออกใบได้เฉพาะบัญชีที่ "สร้างในช่วง LIFF" และมีแถว LINE แถวเดียว; ใช้ได้เฉพาะตอนที่ sub ใหม่ไม่มีเจ้าของ
// (สมาชิกเดิมที่ได้บัญชีซ้ำ → sub ช่อง Login มีเจ้าของแล้ว → กลับบัญชีจริงตามปกติ ไม่ใช้ใบ).
// §ชั่วคราว: session ยุค LIFF หมดอายุภายใน 30 วัน (NextAuth default) → ถอดไฟล์นี้ได้หลัง 2026-10-31.
import { createHmac, timingSafeEqual } from 'node:crypto'

/** create_at ของบัญชี (สตริง Bangkok 'YYYY-MM-DD HH:MM:SS' เรียงตามตัวอักษรได้) — merge #846 (21:41:55) จนถึง #860 ขึ้น production
 *  (17:26:31) + เผื่อ 3 นาทีให้ทุก instance รับ deploy ใหม่ */
export const LIFF_WINDOW = { start: '2026-09-28 21:41:55', end: '2026-10-01 17:30:00' } as const

export const CARRY_TTL_SECONDS = 30 * 60
export const CARRY_COOKIE_PATH = '/api/auth'

export function carryCookieName(secure: boolean): string {
  return `${secure ? '__Secure-' : ''}mumate.liff-carry`
}

export function isInLiffWindow(createAt: string | null | undefined): boolean {
  const v = String(createAt ?? '').trim().slice(0, 19)
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) && v >= LIFF_WINDOW.start && v < LIFF_WINDOW.end
}

/** session จาก LIFF login (#846 jwt branch): lineProfile มี sub แต่ไม่มี iss. OAuth ช่อง Login เก็บ claims ของ id_token (มี iss เสมอ). */
export function isLiffEraLineProfile(lineProfile: unknown): lineProfile is { sub: string } {
  const lp = lineProfile as { sub?: unknown; iss?: unknown } | null | undefined
  return typeof lp?.sub === 'string' && lp.sub.trim() !== '' && !lp.iss
}

export interface CarryPayload {
  /** บัญชีที่ session ยุค LIFF เป็นเจ้าของ */
  u: string
  /** unix seconds */
  exp: number
}

function key(secret: string): Buffer {
  // แยก key จากการใช้งานอื่นของ NEXTAUTH_SECRET
  return createHmac('sha256', secret).update('mumate:liff-carry:v1').digest()
}

function mac(body: string, secret: string): string {
  return createHmac('sha256', key(secret)).update(body).digest('base64url')
}

export function signCarry(payload: CarryPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${mac(body, secret)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function verifyCarry(token: string | null | undefined, secret: string, nowSeconds: number): CarryPayload | null {
  if (!token || !secret) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  const expected = Buffer.from(mac(body, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<CarryPayload>
    if (typeof p.u !== 'string' || !UUID.test(p.u) || typeof p.exp !== 'number') return null
    if (p.exp <= nowSeconds) return null
    return { u: p.u, exp: p.exp }
  } catch {
    return null
  }
}

export function carrySetCookie(token: string, secure: boolean): string {
  return [
    `${carryCookieName(secure)}=${token}`,
    `Path=${CARRY_COOKIE_PATH}`,
    `Max-Age=${CARRY_TTL_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export function carryClearCookie(secure: boolean): string {
  return [`${carryCookieName(secure)}=`, `Path=${CARRY_COOKIE_PATH}`, 'Max-Age=0', 'HttpOnly', 'SameSite=Lax', ...(secure ? ['Secure'] : [])].join('; ')
}

/** อ่านใบจาก request (Next API req.cookies) แล้วตรวจลายเซ็น/อายุ — null = ไม่มีใบที่ใช้ได้ */
export function readCarry(
  cookies: Partial<Record<string, string>>,
  secret: string | undefined,
  secure: boolean,
  nowSeconds = Math.floor(Date.now() / 1000),
): CarryPayload | null {
  return verifyCarry(cookies[carryCookieName(secure)], secret ?? '', nowSeconds)
}

export const isSecureDeploy = (): boolean => process.env.NODE_ENV === 'production'

/** เพิ่ม Set-Cookie โดยไม่ทับของเดิม — getServerSession อาจตั้ง session cookie (rolling) ไว้ใน response เดียวกันแล้ว */
export function appendSetCookie(
  res: { getHeader(name: string): unknown; setHeader(name: string, value: string | string[]): unknown },
  cookie: string,
): void {
  const prev = res.getHeader('Set-Cookie')
  const list = Array.isArray(prev) ? prev.map(String) : prev == null ? [] : [String(prev)]
  res.setHeader('Set-Cookie', [...list, cookie])
}
