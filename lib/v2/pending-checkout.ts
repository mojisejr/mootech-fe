// lib/v2/pending-checkout.ts — จำหน้า checkout (พร้อม ?code= โปรฯ) ไว้ตอนคนยังไม่ล็อกอินกดลิงก์ broadcast,
// แล้วให้ useV2Home เด้งกลับไปตอนผู้ใช้ "พร้อมจริง" (ผ่าน register/first-run ถึงหน้าแรกแล้ว).
// 🔴 ไม่ใช้ OAuth callbackUrl (ทำ LINE login ค้าง) และไม่ใช้ redirect global แยก (ชนกับ useV2Home → ค้าง).
// localStorage (ไม่ใช่ sessionStorage) เพราะคนใหม่ต้องผ่านหลายหน้า/อาจเปิดใหม่. อายุ 1 ชม. ใช้ครั้งเดียว.
const KEY = 'v2:pending-checkout'
const TTL_MS = 60 * 60 * 1000

function isSafePath(p: string): boolean {
  return p.startsWith('/v2/shop/checkout') && !p.startsWith('//') && !p.includes('://') && !p.includes('\\')
}

export function rememberPendingCheckout(path: string): void {
  if (!isSafePath(path)) return
  try { localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })) } catch { /* ignore */ }
}

/** คืน path แล้วลบทิ้ง (ใช้ครั้งเดียว) — null ถ้าไม่มี/หมดอายุ/ไม่ปลอดภัย */
export function consumePendingCheckout(): string | null {
  let raw: string | null = null
  try { raw = localStorage.getItem(KEY); localStorage.removeItem(KEY) } catch { return null }
  if (!raw) return null
  try {
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number }
    if (typeof path !== 'string' || !isSafePath(path)) return null
    if (typeof at !== 'number' || Date.now() - at > TTL_MS) return null
    return path
  } catch { return null }
}
