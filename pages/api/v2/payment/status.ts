// GET /api/v2/payment/status (mootech-fe#355) — the caller's OWN v2 payment records, scoped by the session
// user_id (never a user_id from the query).
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { listUserPayments } from '@/lib/payment/repo'
import { qrStatusFields } from '@/lib/payment/qr-deadline'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })

  const now = new Date()
  const rows = await listUserPayments(who.userId)
  return res.status(200).json({
    payments: rows.map((r) => ({
      chargeId: r.chargeId,
      orderId: r.orderId,
      packageCode: r.packageCode,
      tierCode: r.tierCode,
      amountSatang: r.amountSatang,
      method: r.method,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      // 🔴 #455 — สองช่องนี้สร้างพร้อมกันจากค่าเดียว · payload ที่ขัดกันเองสร้างไม่ได้
      // เหตุผลเต็ม + คำรับประกันที่ถูก อยู่ใน lib/payment/qr-deadline.ts
      //
      // 🏷️ ชื่อสองชั้นนี้ **ต่างกันโดยตั้งใจ ❌ อย่า "ซ่อม" ให้ตรงกัน** (มุน · #455)
      //   คอลัมน์ DB   charge_expires_at   ชื่อที่ Omise เรียก — เก็บของเขาไว้ตามที่เขาเรียก
      //   ช่องบน wire  liveUntil           สัญญาของ ENDPOINT นี้ ซึ่งแคบกว่าคอลัมน์
      //
      // คอลัมน์ตอบว่า "charge นี้หมดอายุเมื่อไหร่" (มีค่าแม้ตอนที่มันตายไปแล้ว)
      // ช่องบน wire ตอบว่า "หน้าต่างที่ยังเปิดอยู่ ปิดเมื่อไหร่" (ไม่มีค่าเมื่อไม่มีหน้าต่าง)
      // ⇒ ทำให้ชื่อตรงกันเมื่อไหร่ ก็ต้องส่งค่าตอน expired ด้วย และกับดักที่ตู๋ชี้ไว้ก็กลับมาทันที
      ...qrStatusFields(r.chargeExpiresAt, now),
    })),
  })
}
