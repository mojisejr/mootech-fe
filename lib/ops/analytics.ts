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
  return { days: d, revenueByDay, revenueByPackage, tierDistribution }
}
