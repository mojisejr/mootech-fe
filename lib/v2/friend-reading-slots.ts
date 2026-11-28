// lib/v2/friend-reading-slots.ts — สล็อตดูดวงเพื่อนฟรีของ Pro (ตาราง friend_reading_slot · 0041 · ประชุม 24 พ.ย. ข้อ 2)
// "Pro ดูดวงเพื่อนฟรี 10 คนแรก" นับจากแถวในตารางนี้: ผู้ใช้ 1 แถวต่อเพื่อน 1 คน (pk ร่วม)
// เขียนด้วย SQL ตรงตามแบบ lib/promo/share-repo.ts (ตารางจาก migration .sql ไม่ผูกกับ drizzle snapshot)
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/** ตารางยังไม่ถูกสร้าง (เจ้าของยังไม่รัน 0041) หรือ DB อ่านไม่ได้ — route จะแปลงเป็น 503 สำหรับ Pro
 *  แทนที่จะเดาว่า "ไม่มีสล็อต" แล้วไปหักชีสมาชิก Pro */
export class FriendSlotStoreUnavailable extends Error {
  constructor() {
    super('friend_reading_slot unavailable')
  }
}

const rowsOf = (r: unknown): Record<string, unknown>[] => (Array.isArray(r) ? (r as Record<string, unknown>[]) : [])

export async function friendSlotState(userId: string, friendId: string): Promise<{ already: boolean; used: number }> {
  let rows: Record<string, unknown>[]
  try {
    rows = rowsOf(await db.execute(sql`SELECT friend_id FROM friend_reading_slot WHERE user_id = ${userId}`))
  } catch {
    throw new FriendSlotStoreUnavailable()
  }
  const list = rows.map((r) => String(r.friend_id ?? ''))
  return { already: list.includes(friendId), used: list.length }
}

/** ใช้สล็อตใหม่ให้เพื่อนคนนี้ ถ้ายังมีที่ว่าง (used < max) — INSERT … WHERE ในประโยคเดียว
 *  false = สล็อตเต็มระหว่างทาง (คำขวน/ขอซ้ำ) → ผู้เรียกไปหักชีแทน · throw = DB ล้ม (ผู้เรียกทอน 503 ไม่หักชี) */
export async function takeFriendSlot(userId: string, friendId: string, max: number): Promise<boolean> {
  try {
    const r = await db.execute(sql`
      INSERT INTO friend_reading_slot (user_id, friend_id)
      SELECT ${userId}, ${friendId}
       WHERE (SELECT count(*)::int FROM friend_reading_slot WHERE user_id = ${userId}) < ${max}
      ON CONFLICT (user_id, friend_id) DO NOTHING`)
    // postgres-js: คืน array เปล่าเมื่อแทรกได้ / มี count ของแถวเมื่อ driver ส่ง meta มา — อ่านให้ครบทั้งสองแบบ
    const meta = r as unknown as { count?: number | string; rowCount?: number; rows?: unknown[] }
    if (typeof meta?.rowCount === 'number') return meta.rowCount > 0
    if (meta?.count !== undefined) return Number(meta.count) > 0
    return true
  } catch {
    throw new FriendSlotStoreUnavailable()
  }
}
