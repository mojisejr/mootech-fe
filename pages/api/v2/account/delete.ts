// POST /api/v2/account/delete — ขอลบบัญชี (มีตติ้งทีม 2026-09-02: แจ้งสิ่งที่จะหาย + พักบัญชี
// ~30 วันก่อนลบจริง) — 🔴 ตอนนี้ยังไม่มีขาหลัง: mootech-be ไม่มี endpoint ลบ user (และยังไม่มี
// auth จริงฝั่ง BE ให้อ้าง) จึงตอบ 501 เสมอ หน้า UI จะโชว์สถานะ "ยังไม่เปิดใช้" อย่างตรงไปตรงมา
// ห้ามเปลี่ยนเป็น 200 ลอย ๆ ทั้งที่ไม่มีอะไรถูกลบ (#384/#365 class — การโกหกสถานะคือบั๊กที่ repo นี้เคยเจอ)
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })

  // TODO(BE): ต่อ mootech-be DELETE /user ที่ทำ soft-delete + grace 30 วัน แล้วเปลี่ยนบรรทัดนี้
  // เป็นการเรียกจริง (พร้อมคงสิทธิ์ "กลับมาล็อกอินภายใน 30 วัน = ยกเลิกการลบ")
  return res.status(501).json({
    ok: false,
    error: 'not_implemented',
    message: 'ระบบลบบัญชียังไม่เปิดใช้งาน กรุณาลองใหม่ภายหลัง หรือติดต่อทีมงาน',
  })
}
