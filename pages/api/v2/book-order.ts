// POST /api/v2/book-order — ออเดอร์หนังสือ "Your Life Code" (#3 ซินแสนุ้ย 2026-09-15).
//   action "create" (ค่าเริ่มต้น): กรอกฟอร์ม → เก็บ book_order (status NEW) → คืน { id }
//   action "attach": หลังจ่ายสำเร็จที่หน้า result → ผูก charge_id + mark PAID (ยืนยันจาก v2_payment ฝั่ง server)
// SERVER-GATED: identity จาก resolveSessionUserId (ไม่รับ user_id จาก body); ราคา/รูปแบบ authoritative จาก catalog.
// ไม่ gate สมาชิก (ใครก็สั่งซื้อได้). validate มือ (ไม่ใช้ zod — ตาม convention v2 API).
import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bookOrder, v2Payment } from '@/lib/db/schema'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { getPackage } from '@/lib/payment/repo'
import { quotePackage, bookFormatOf } from '@/lib/payment/catalog'

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })
  const userId = who.userId
  const body = (req.body ?? {}) as Record<string, unknown>

  try {
    // ── attach: ผูก charge หลังจ่ายสำเร็จ (ยืนยันจาก v2_payment) ─────────────────────────────
    if (body.action === 'attach') {
      const id = s(body.id)
      const chargeId = s(body.chargeId)
      if (!id || !chargeId) return res.status(400).json({ ok: false, error: 'id + chargeId required' })
      // charge ต้องเป็นของ user คนนี้ + APPROVED + เลน BOOK เท่านั้น (กันปลอม)
      const pay = await db
        .select({ status: v2Payment.status, tierCode: v2Payment.tierCode, userId: v2Payment.userId })
        .from(v2Payment)
        .where(eq(v2Payment.chargeId, chargeId))
        .limit(1)
      const p = pay[0]
      if (!p || p.userId !== userId || p.status !== 'APPROVED' || p.tierCode !== 'BOOK') {
        return res.status(409).json({ ok: false, error: 'charge not settled for this order' })
      }
      const upd = await db
        .update(bookOrder)
        .set({ status: 'PAID', chargeId })
        .where(and(eq(bookOrder.id, id), eq(bookOrder.userId, userId)))
        .returning({ id: bookOrder.id })
      if (!upd.length) return res.status(404).json({ ok: false, error: 'order not found' })
      return res.status(200).json({ ok: true })
    }

    // ── create: กรอกฟอร์ม → เก็บ book_order (NEW) ───────────────────────────────────────────
    const packageCode = s(body.packageCode)
    const format = bookFormatOf(packageCode) // PDF | PHYSICAL | null
    if (!format) return res.status(400).json({ ok: false, error: 'packageCode ไม่ถูกต้อง' })

    const fullName = s(body.fullName)
    const gender = s(body.gender)
    const birthDateBe = s(body.birthDateBe)
    const birthTime = s(body.birthTime)
    const contactChannel = s(body.contactChannel)
    const contactAccount = s(body.contactAccount)
    const email = s(body.email) || null
    if (!fullName || !gender || !birthDateBe || !birthTime || !contactChannel || !contactAccount) {
      return res.status(400).json({ ok: false, error: 'กรอกข้อมูลให้ครบ' })
    }
    if (!['ชาย', 'หญิง'].includes(gender)) return res.status(400).json({ ok: false, error: 'เพศไม่ถูกต้อง' })
    if (!['Facebook', 'Instagram', 'Line'].includes(contactChannel)) {
      return res.status(400).json({ ok: false, error: 'ช่องทางติดต่อไม่ถูกต้อง' })
    }

    // เล่ม (PHYSICAL) ต้องมีข้อมูลจัดส่ง
    const shipName = s(body.shipName) || null
    const shipPhone = s(body.shipPhone) || null
    const shipAddress = s(body.shipAddress) || null
    if (format === 'PHYSICAL' && (!shipName || !shipPhone || !shipAddress)) {
      return res.status(400).json({ ok: false, error: 'รูปเล่มต้องกรอกชื่อ/เบอร์/ที่อยู่จัดส่ง' })
    }

    // ราคา authoritative จาก catalog (ไม่เชื่อ client) — validate packageCode เป็น BOOK ที่ขายอยู่จริงด้วย
    const pkg = await getPackage(packageCode)
    let amountSatang: number | null = null
    if (pkg) {
      try {
        amountSatang = quotePackage(pkg).amountSatang
      } catch {
        return res.status(409).json({ ok: false, error: 'แพ็กเกจนี้ยังไม่เปิดขาย' })
      }
    }

    const saved = await db
      .insert(bookOrder)
      .values({
        userId,
        email,
        fullName,
        gender,
        birthDateBe,
        birthTime,
        format,
        shipName: format === 'PHYSICAL' ? shipName : null,
        shipPhone: format === 'PHYSICAL' ? shipPhone : null,
        shipAddress: format === 'PHYSICAL' ? shipAddress : null,
        contactChannel,
        contactAccount,
        packageCode,
        amountSatang,
        status: 'NEW',
      })
      .returning({ id: bookOrder.id })
    return res.status(201).json({ ok: true, id: saved[0]?.id ?? '' })
  } catch (e) {
    console.error('[book-order]', e instanceof Error ? e.message : e)
    return res.status(500).json({ ok: false, error: 'บันทึกไม่สำเร็จ ลองใหม่' })
  }
}
