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
      // #455 slice 3 — REJECT has two causes and the screen has to tell them apart.
      // Match EXACTLY, not by prefix. The producer is one line, lib/payment/reconcile-run.ts:102:
      //     const reason = charge.failureCode ?? `gateway_${charge.status}`
      // so the only values we ever write are the three below, each in full:
      //   'gateway_expired'    the QR died — nobody paid, nobody refused
      //   'gateway_failed'     the gateway ended it and gave no code of its own
      //   'gateway_reversed'   it HAD been paid and the money went back
      // anything else in this column came verbatim from Omise and means the gateway refused.
      //
      // 🔴 'mootech_expired' is RETIRED — it can never appear. It was a fallback for "the gateway gave no
      // status", which isRefusedCharge makes impossible (gateway.ts:118 only passes a status that is in
      // TERMINAL_FAILURE_STATUSES). too proved it unreachable; the producer is gone.
      // It is named here ONLY so that anyone who read the earlier version of this comment — lamun did, and
      // wrote `|| failureCode === 'mootech_expired'` into the screen because of it — knows to delete that
      // half rather than wonder why it never fires. Do not add it back without a producer.
      //
      // ⚠️ The earlier wording said failureCode "starts" gateway_expired. It does not start with it, it IS
      // it. One reader writes startsWith, another writes ===, and both believe they followed the contract.
      failureCode: r.failureCode ?? null,
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
