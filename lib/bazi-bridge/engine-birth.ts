// A1 fix — วันเกิดมี 2 แหล่งใน Supabase เดียวกัน:
//   · legacy `user`.dob/time/is_remember_time (mootech-be เก่า) — เป็นตัวที่ destiny/chat อ่านมาคำนวณ
//   · engine `bazi_user_profile`.birth_date/birth_time/time_unknown — เป็นตัวที่หน้า "แก้วันเกิด" เขียน
// เดิมสองแหล่งไม่ sync กัน → แก้วันเกิดแล้วหน้าหลัก/ดวง/chat ยังคำนวณจาก user.dob เดิม (ธาตุไม่เปลี่ยน).
// helper นี้ทำให้ค่าที่ "แก้ล่าสุด" (engine profile) ชนะ: ถ้ามี birth_date ใน bazi_user_profile ให้ทับ
// dob/time/is_remember_time ของ row ก่อนส่งเข้า userRowToFeCalcInput. gender/place_name/name ยังมาจาก user.
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { applyEngineProfileBirth, type UserBirthRow } from "@/lib/bazi-bridge/input"

const rowsOf = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? (r as Record<string, unknown>[]) : ((r as { rows?: Record<string, unknown>[] })?.rows ?? [])

/**
 * ทับวันเกิดของ `user` row ด้วยค่าที่ผู้ใช้แก้ล่าสุดใน engine `bazi_user_profile` (ถ้ามี).
 * anon_id ฝั่ง engine = user_id ฝั่ง legacy (cookie-mumate-id เดียวกัน).
 * best-effort: engine ล่ม/ไม่มีแถว → คืน row เดิม (คำนวณจาก legacy ต่อได้ ไม่พังจอ).
 */
export async function mergeEngineBirth(userId: string, row: UserBirthRow): Promise<UserBirthRow> {
  try {
    const prof = rowsOf(
      await db.execute(
        sql`SELECT birth_date, birth_time, time_unknown FROM "bazi_user_profile" WHERE anon_id = ${userId} LIMIT 1`,
      ),
    )[0]
    return applyEngineProfileBirth(row, prof) // ยังไม่เคยแก้ฝั่ง engine → คืน row เดิม (legacy)
  } catch {
    return row
  }
}
