// slice 7c (2026-10-02) — /v2/login ใน Facebook/Instagram: เตรียม URL ที่จะเปิดในเบราว์เซอร์จริง.
// localStorage ของ webview ไม่ตามไปเบราว์เซอร์จริง → โค้ดเชิญ (v2:referral) ต้องติดไปกับ URL เป็น ?ref= แล้ว
// /v2/login ฝั่งเบราว์เซอร์จริงเก็บกลับลง localStorage ให้หน้า register อ่านเหมือนเดิม.
import { inAppBrowserKind, isAndroid } from './in-app'

// ชื่อเดียวกับ REFERRAL_STORAGE_KEY ใน pages/invite/[code].tsx (ไม่ import จากไฟล์ page เพื่อไม่ลาก page เข้า bundle อื่น)
export const REFERRAL_KEY = 'v2:referral'
// ผู้ใช้เลือก "เข้าสู่ระบบต่อในแอปนี้" — จำในแท็บนี้ ไม่ถามซ้ำ
export const STAY_IN_APP_KEY = 'v2:login-stay-in-app'

const REF_PATTERN = /^[A-Za-z0-9_-]{3,40}$/

export function cleanRef(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value
  return typeof v === 'string' && REF_PATTERN.test(v) ? v : null
}

export function loginEscapeUrl(origin: string, ref: string | null): string {
  const u = new URL('/v2/login', origin)
  if (ref) u.searchParams.set('ref', ref)
  return u.toString()
}

export function escapeLabels(userAgent: string): { appName: string; browserName: string } | null {
  const kind = inAppBrowserKind(userAgent)
  if (kind !== 'facebook' && kind !== 'instagram') return null
  return {
    appName: kind === 'instagram' ? 'Instagram' : 'Facebook',
    browserName: isAndroid(userAgent) ? 'Chrome' : 'Safari',
  }
}
