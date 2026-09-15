// /ops analytics ฝั่ง FE DB: รายได้ (v2_payment APPROVED) + การกระจาย tier (member_subscription active).
// อ่านอย่างเดียว. ฝั่ง engine (QI economy + chat) ประกอบเพิ่มใน api route ผ่าน lib/ops/engine.
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

const rowsOf = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? (r as Record<string, unknown>[]) : ((r as { rows?: Record<string, unknown>[] })?.rows ?? [])

export async function getFeAnalytics(days = 30) {
  const d = Math.min(365, Math.max(1, days))
  // รายได้รายวัน (บาท = satang/100) เฉพาะที่ APPROVED
  const revenueByDay = rowsOf(await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS orders,
           COALESCE(SUM(amount_satang), 0)::bigint AS satang
      FROM v2_payment
     WHERE status = 'APPROVED' AND created_at >= now() - (${d} || ' days')::interval
     GROUP BY 1 ORDER BY 1`))
  // รายได้แยกตาม tier + แพ็ก (รวม QI pack)
  const revenueByPackage = rowsOf(await db.execute(sql`
    SELECT package_code, tier_code,
           COUNT(*)::int AS orders,
           COALESCE(SUM(amount_satang), 0)::bigint AS satang
      FROM v2_payment
     WHERE status = 'APPROVED' AND created_at >= now() - (${d} || ' days')::interval
     GROUP BY 1, 2 ORDER BY satang DESC`))
  // การกระจายสมาชิกที่ยัง active (member_subscription)
  const tierDistribution = rowsOf(await db.execute(sql`
    SELECT tier_code, COUNT(*)::int AS members
      FROM member_subscription
     WHERE status = 'ACTIVE' AND expire_at >= CURRENT_DATE
     GROUP BY 1 ORDER BY members DESC`))
  // สมาชิก v2 (CIEL mootech-ga4-instrumentation-001, D4) — ตัวหารของ "% สมาชิกที่ใช้งานต่อวัน" ที่ทีมขอ.
  // "สมาชิก v2" = user.onboarded_at ไม่ว่าง (ผ่าน first-run แล้ว) ตามที่ owner ตัดสิน 2026-09-15: ใช้ข้อมูล v2
  // ตั้งแต่นี้ไป ไม่นับ member เก่าที่ยังไม่เคยผ่าน first-run. onboarded_at เป็น text ISO (BE consent.service
  // เขียน new Date().toISOString()) จึง cast เป็น timestamptz ได้; "วันนี้" = วันตามเวลากรุงเทพ.
  // GA ให้ตัวเลขนี้ไม่ได้ — มันรู้จักแค่คนที่เข้ามาในช่วงวันที่เลือก ไม่รู้จักสมาชิกที่สมัครแล้วหายไป.
  const memberRows = rowsOf(await db.execute(sql`
    SELECT COUNT(*)::int AS members_total,
           COUNT(*) FILTER (WHERE (onboarded_at::timestamptz AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date)::int AS members_new_today,
           COUNT(*) FILTER (WHERE onboarded_at::timestamptz >= now() - interval '7 days')::int AS members_new_7d
      FROM "user"
     WHERE onboarded_at IS NOT NULL AND onboarded_at <> ''`))
  const m = memberRows[0] ?? {}
  const members = {
    total: Number(m.members_total ?? 0),
    newToday: Number(m.members_new_today ?? 0),
    new7d: Number(m.members_new_7d ?? 0),
  }
  return { days: d, revenueByDay, revenueByPackage, tierDistribution, members }
}
