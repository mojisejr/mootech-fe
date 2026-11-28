// features/v2-home/shortcuts.ts — รายการ "ทางลัด 4 ช่อง" บนหน้าหลัก (Home v3 รอบแรก · ประชุม 24 พ.ย. 2569 ข้อ 1). PURE
// เก็บใน localStorage ของเครื่องก่อน (ค่าตั้งต้นของรอบนี้ — ยังไม่ซิงก์ข้ามเครื่อง) · 4 ช่อง · เลือกจากรายการด้านล่าง
// ทุก href ต้องเป็นหน้าที่มีอยู่จริงใน pages/v2 (เพิ่มทางลัด = เพิ่มใน SHORTCUT_CATALOG ที่เดียว)
export type Shortcut = { key: string; label: string; href: string; icon: string }

export const SHORTCUT_SLOTS = 4
export const SHORTCUT_KEY = 'mumate:home-shortcuts-v1'
export const SHORTCUT_EVENT = 'mumate:home-shortcuts-change'

export const SHORTCUT_CATALOG: readonly Shortcut[] = [
  { key: 'destiny', label: 'ดวงของฉัน', href: '/v2/destiny', icon: '🔮' },
  { key: 'calendar', label: 'ปฏิทิน', href: '/v2/calendar', icon: '📅' },
  { key: 'love', label: 'ดูดวงคู่', href: '/v2/service/compatibility/love', icon: '💞' },
  { key: 'shop', label: 'แพ็กเกจ', href: '/v2/shop', icon: '🛍️' },
  { key: 'colleague', label: 'เพื่อนร่วมงาน', href: '/v2/service/compatibility/colleague', icon: '🤝' },
  { key: 'qi', label: 'ชี (QI)', href: '/v2/qi', icon: '⚡' },
  { key: 'referral', label: 'ชวนเพื่อน', href: '/v2/qi/referral', icon: '🎁' },
  { key: 'manifest', label: 'มานิเฟสต์', href: '/v2/service/manifest', icon: '🌱' },
  { key: 'service', label: 'ฟีเจอร์ทั้งหมด', href: '/v2/service', icon: '✦' },
  { key: 'account', label: 'โปรไฟล์', href: '/v2/account', icon: '👤' },
]

/** 4 ช่องแรกของคนใหม่ — ของที่ใช้บ่อยที่สุดของแอป (ดวง · ปฏิทิน · ดูดวงคู่ · ร้าน) */
export const DEFAULT_SHORTCUTS: readonly string[] = ['destiny', 'calendar', 'love', 'shop']

const BY_KEY = new Map(SHORTCUT_CATALOG.map((s) => [s.key, s]))
export function shortcutByKey(key: string): Shortcut | null {
  return BY_KEY.get(key) ?? null
}

/** สิ่งที่อ่านมาจาก storage → key 4 ตัวที่ใช้ได้จริงเสมอ:
 *  ค่าว่าง/พัง/ไม่ใช่ array → ค่าเริ่มต้นทั้งชุด · key ที่ไม่มีในรายการ (ถูกถอดออก) และ key ซ้ำ → ตัดทิ้ง
 *  · ขาด → เติมด้วยค่าเริ่มต้นที่ยังไม่ถูกใช้ · เกิน → ตัดให้เหลือ 4 (ห้ามมีช่องว่างหรือซ้ำในแถว) */
export function parseShortcuts(raw: string | null | undefined): string[] {
  let input: unknown = null
  try {
    input = raw ? JSON.parse(raw) : null
  } catch {
    input = null
  }
  const wanted = Array.isArray(input) ? input.filter((x): x is string => typeof x === 'string') : []
  const out: string[] = []
  for (const k of [...wanted, ...DEFAULT_SHORTCUTS]) {
    if (out.length >= SHORTCUT_SLOTS) break
    if (BY_KEY.has(k) && !out.includes(k)) out.push(k)
  }
  return out
}
