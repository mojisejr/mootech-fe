// lib/v2/calendar-access.ts — สิทธิ์เข้าถึง "ปฏิทินดวงเฉพาะบุคคล" นอกเหนือจาก tier (เจ้าของ 2026-09-15).
//
// ปกติปฏิทินเฉพาะบุคคลเป็น PAID (PLUS/PRO). เพิ่มทางให้ /ops grant "owned entitlement calendar" ต่อ user ได้
// (เช่น แจกให้ free user บางคน) โดยไม่ต้องอัป tier. gate ปฏิทิน (day-detail/calendar-month) เช็ค isPaid หรือ
// owns-calendar. อ่านจาก engine entitlements (owned[]) — แหล่งเดียวกับที่ /ops grant. fail-closed = ไม่มีสิทธิ์.
const BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'

/** ผู้ใช้ได้รับ grant "ปฏิทินเฉพาะบุคคล" (owned kind=calendar) ไหม. อ่านล้ม/เอนจินดับ → false (fail-closed). */
export async function ownsCalendar(userId: string): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/qi/entitlements?anonId=${encodeURIComponent(userId)}`)
    if (!r.ok) return false
    const j = (await r.json().catch(() => null)) as { owned?: Array<{ kind?: string }> } | null
    return Array.isArray(j?.owned) && j.owned.some((o) => o?.kind === 'calendar')
  } catch {
    return false
  }
}
