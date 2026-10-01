// lib/course/calendar.ts — คอร์สสอนใช้ปฏิทินจีน Mumate (ฟิว/พล 2026-10-01). server-only (ใช้ db).
//   EP 1-7 ฟรี (สาธารณะ) · EP 8-13 ต้องมีสิทธิ์ (สมาชิก Plus/Pro ที่ยังไม่หมด หรือเคยซื้อคอร์ส = ตลอดชีพ)
//   เนื้อหา EP มาจากชีตของฟิว · ลิงก์วิดีโอเก็บในตาราง course_video (0039) แก้ที่ /ops ของ engine
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { REVERSED_CODE } from '@/lib/payment/repo'
import { COURSE_SLUG, COURSE_PACKAGE_CODES, EPISODES, type Episode } from './calendar-content'

export { COURSE_SLUG, COURSE_PACKAGE_CODES, EPISODES, type Episode }

function rowsOf(r: unknown): Record<string, unknown>[] {
  return (Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[]
}

/** ดึง YouTube video id จากลิงก์ที่ฟิววาง (watch?v= / youtu.be/ / embed/ / shorts/) — ไม่ใช่ YouTube → null */
export function youtubeId(url: string | null | undefined): string | null {
  const s = String(url ?? '').trim()
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(s) ??
    /^([A-Za-z0-9_-]{11})$/.exec(s)
  return m ? m[1] : null
}

/** ep → video id (เฉพาะที่ตั้งไว้แล้ว). ตารางยังไม่มี (ยังไม่รัน 0039) → {} ไม่ล้ม */
export async function readVideoIds(): Promise<Record<number, string>> {
  try {
    const r = await db.execute(sql`SELECT ep, video_url FROM course_video WHERE course = ${COURSE_SLUG}`)
    const out: Record<number, string> = {}
    for (const row of rowsOf(r)) {
      const id = youtubeId(String(row.video_url ?? ''))
      if (id) out[Number(row.ep)] = id
    }
    return out
  } catch {
    return {}
  }
}

/** เคยซื้อคอร์สสำเร็จ (และไม่ถูก reverse) = สิทธิ์ตลอดชีพ แม้ Plus ที่แถมมาหมดแล้ว */
export async function hasPurchasedCourse(userId: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 FROM v2_payment
     WHERE user_id = ${userId}
       AND status = 'APPROVED'
       AND package_code IN (${sql.join(COURSE_PACKAGE_CODES.map((c) => sql`${c}`), sql`, `)})
       AND (failure_code IS NULL OR failure_code <> ${REVERSED_CODE})
     LIMIT 1`)
  return rowsOf(r).length > 0
}

/** เป็นสมาชิกที่ "จ่ายเงินจริง" และยังไม่หมดอายุ — แถว member_subscription ที่ผูก v2_payment (APPROVED, ยอด > 0).
 *  🔴 ฟิว 2026-10-01: ได้ Plus/Pro ฟรีจากโค้ดกิจกรรม (COUPON:… เช่น BaziXMumatePro), แอดมินให้ (ADMIN_…),
 *  หรือแชร์เพื่อนฟรี 1 เดือน → ไม่ได้สิทธิ์คอร์ส. แถวพวกนั้น amount 0 และไม่มี v2_payment_id จึงตกเงื่อนไขนี้เอง. */
export async function isPaidMemberNow(userId: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT 1 FROM member_subscription s
      JOIN v2_payment p ON p.id = s.v2_payment_id
     WHERE s.user_id = ${userId}
       AND s.status = 'ACTIVE'
       AND s.amount_satang > 0
       AND s.expire_at >= (now() AT TIME ZONE 'Asia/Bangkok')::date
       AND p.status = 'APPROVED'
       AND (p.failure_code IS NULL OR p.failure_code <> ${REVERSED_CODE})
     LIMIT 1`)
  return rowsOf(r).length > 0
}

export type CourseAccess = { access: boolean; via: 'member' | 'purchase' | null }

/** สิทธิ์เรียน EP เสียเงิน: สมาชิกที่จ่ายเงินจริงและยังไม่หมด (ไม่ต้องซื้อ) หรือเคยซื้อคอร์ส */
export async function courseAccessFor(userId: string | null): Promise<CourseAccess> {
  if (!userId) return { access: false, via: null }
  try {
    if (await isPaidMemberNow(userId)) return { access: true, via: 'member' }
  } catch {
    /* อ่านสมาชิกไม่ได้ → เช็กการซื้อคอร์สต่อ */
  }
  return (await hasPurchasedCourse(userId)) ? { access: true, via: 'purchase' } : { access: false, via: null }
}
