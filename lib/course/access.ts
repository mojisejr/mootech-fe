// lib/course/access.ts — สิทธิ์เรียน + ลิงก์วิดีโอของคอร์ส (server-only: ใช้ db).
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { REVERSED_CODE } from '@/lib/payment/repo'
import { COURSES, packagesGranting, type CourseSlug } from './content'

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

/** ep → video id ของคอร์สนี้ (เฉพาะที่ตั้งไว้). ตารางยังไม่มี (ยังไม่รัน 0039) → {} ไม่ล้ม */
export async function readVideoIds(slug: CourseSlug): Promise<Record<number, string>> {
  try {
    const r = await db.execute(sql`SELECT ep, video_url FROM course_video WHERE course = ${slug}`)
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

/** เคยซื้อแพ็กที่ให้สิทธิ์คอร์สนี้สำเร็จ (ไม่ถูก reverse) = สิทธิ์ตลอดชีพ */
export async function hasPurchased(userId: string, slug: CourseSlug): Promise<boolean> {
  const codes = packagesGranting(slug)
  if (codes.length === 0) return false
  const r = await db.execute(sql`
    SELECT 1 FROM v2_payment
     WHERE user_id = ${userId}
       AND status = 'APPROVED'
       AND package_code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})
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

/** สิทธิ์เรียน EP เสียเงิน: เคยซื้อคอร์ส (ตลอดชีพ) หรือ (คอร์สที่เปิดให้สมาชิก) สมาชิกที่จ่ายเงินจริงและยังไม่หมด */
export async function courseAccessFor(slug: CourseSlug, userId: string | null): Promise<CourseAccess> {
  if (!userId) return { access: false, via: null }
  if (await hasPurchased(userId, slug)) return { access: true, via: 'purchase' }
  if (COURSES[slug].memberAccess) {
    try {
      if (await isPaidMemberNow(userId)) return { access: true, via: 'member' }
    } catch {
      /* อ่านสมาชิกไม่ได้ → ไม่มีสิทธิ์ */
    }
  }
  return { access: false, via: null }
}
