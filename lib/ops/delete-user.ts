// lib/ops/delete-user.ts — เอ็ม 2026-09-20: /ops ต้องมีปุ่ม "ลบบัญชี" ไว้ทำให้บัญชีเทสต์กลับเป็น "คนใหม่"
// เพื่อทดสอบสมัคร LINE ซ้ำ (เดิมไม่มี — มีแค่ค้นหา/ดู/แก้ tier/QI/วันเกิด). ตัวลบในแอป (/api/v2/account/delete)
// เป็นแบบ "พัก 30 วัน" และไม่ลบ mapping LINE → re-login เจอ user เดิม ไม่กลายเป็นคนใหม่.
//
// จุดชี้ขาด: register-login (NestJS) หา user จาก user_provider (provider='LINE', id_token=LINE userId) —
// ลบแถวนั้นทิ้ง → login ครั้งถัดไปมินต์ user_id ใหม่ = "คนใหม่" จริง. ข้อมูล engine (QI/โปรไฟล์) ผูกกับ
// anonId=user_id เดิม → พอได้ user_id ใหม่ก็กลายเป็นของกำพร้า (ไม่ชนกัน ไม่กระทบ) จึงไม่ต้องแตะ engine.
//
// scoped ที่ user_id เท่านั้น + best-effort ต่อ table (ตารางหาย/schema เพี้ยนใน dev ไม่ทำให้ทั้งชุดล้ม).
import { eq } from 'drizzle-orm'
import { db as defaultDb } from '@/lib/db'
import { user, userProvider, memberSubscription } from '@/lib/db/schema'

type Db = typeof defaultDb

export type DeleteUserResult = {
  userProvider: number
  memberSubscription: number
  user: number
}

/**
 * ลบ identity ของ user ออกจาก FE Supabase ให้ re-login (LINE/Google) มินต์เป็น "คนใหม่".
 * คืนจำนวนแถวที่ลบต่อ table. ไม่ throw — แต่ละ table แยกกัน best-effort.
 */
export async function deleteUserIdentity(userId: string, db: Db = defaultDb): Promise<DeleteUserResult> {
  const out: DeleteUserResult = { userProvider: 0, memberSubscription: 0, user: 0 }

  // 1) provider mapping (LINE/Google id_token → user_id) — ตัวชี้ขาดว่าถูกมองเป็นคนใหม่
  try {
    const r = await db.delete(userProvider).where(eq(userProvider.userId, userId)).returning({ id: userProvider.id })
    out.userProvider = r.length
  } catch {
    /* best-effort */
  }

  // 2) subscription — กันไม่ให้บัญชีใหม่ที่มินต์ user_id ซ้ำ (กรณีสุดวิสัย) สืบทอด tier เก่า
  try {
    const r = await db.delete(memberSubscription).where(eq(memberSubscription.userId, userId)).returning({ id: memberSubscription.id })
    out.memberSubscription = r.length
  } catch {
    /* best-effort */
  }

  // 3) identity/profile row
  try {
    const r = await db.delete(user).where(eq(user.userId, userId)).returning({ userId: user.userId })
    out.user = r.length
  } catch {
    /* best-effort */
  }

  return out
}
