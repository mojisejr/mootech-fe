// lib/auth/liff-carry-shared.ts — ส่วนที่ไม่ใช้ node:crypto ของ "ใบส่งต่อ" (slice 7g) จึง import จากฝั่ง client ได้
// (self-heal). ส่วนเซ็น/ตรวจใบอยู่ใน lib/auth/liff-carry.ts (server เท่านั้น). เหตุผลทั้งหมดดูหัวไฟล์นั้น.

/** create_at ของบัญชี (สตริง Bangkok 'YYYY-MM-DD HH:MM:SS' เรียงตามตัวอักษรได้) — merge #846 (21:41:55) จนถึง #860 ขึ้น production
 *  (17:26:31) + เผื่อ 3 นาทีให้ทุก instance รับ deploy ใหม่ */
export const LIFF_WINDOW = { start: '2026-09-28 21:41:55', end: '2026-10-01 17:30:00' } as const

export function isInLiffWindow(createAt: string | null | undefined): boolean {
  const v = String(createAt ?? '').trim().slice(0, 19)
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) && v >= LIFF_WINDOW.start && v < LIFF_WINDOW.end
}

/** session จาก LIFF login (#846 jwt branch): lineProfile มี sub แต่ไม่มี iss. OAuth ช่อง Login เก็บ claims ของ id_token (มี iss เสมอ). */
export function isLiffEraLineProfile(lineProfile: unknown): lineProfile is { sub: string } {
  const lp = lineProfile as { sub?: unknown; iss?: unknown } | null | undefined
  return typeof lp?.sub === 'string' && lp.sub.trim() !== '' && !lp.iss
}
