// BFF — POST /api/qi-earn { code, ref? }: รับชี่จากภารกิจ (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember).
// Engine: POST {BAZI_BASE_URL}/api/qi/earn — จ่ายซ้ำในรอบเดิมไม่ได้ (capped).
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { baziFetch } from '@/lib/bazi/fetch'

const CODE_RE = /^[a-z0-9_]{1,64}$/i
// 🔴 ALLOWLIST (ปิดช่องโหว่ 2026-11-27 · ประชุม 24 พ.ย. ข้อ 2): เดิมปฏิเสธแค่ line_oa_add แล้วส่งทุกโค้ดที่เหลือต่อไปให้
// engine ซึ่งกันแค่ "จ่ายซ้ำในรอบเดิม" ไม่ได้ตรวจว่าเหตุการณ์เกิดจริง ⇒ คนที่ล็อกอินยิง POST เองได้ทุกเส้นที่ควรมาจากระบบ
// (signup · referral_free/plus/pro พร้อม ref มั่ว · wuxing_matrix 1,000 ชี) โดยไม่ต้องทำภารกิจ
// เหลือไว้เฉพาะรหัสที่ "หน้าเว็บยิงเองโดยชอบ" — เพิ่มรายการใหม่ต้องมีเหตุผลว่าผู้ใช้กดเองได้จริง:
//   daily_login  ปุ่มเช็คอิน (AccountScreen / QiScreen / QiCheckinScreen) — engine จำกัดวันละ 1 ครั้ง
//   share        กดแชร์แล้ว (ดวง/ไพ่/แผนที่) — วันละ 1 ครั้ง
//   install_pwa  เปิดแอปแบบติดตั้งแล้ว (lib/pwa/use-install-reward) — ครั้งเดียวตลอดชีพ
const SELF_CLAIM_CODES = new Set(["daily_login", "share", "install_pwa"])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const memberId = who.userId
  const body = (req.body ?? {}) as { code?: string; ref?: string }
  const code = String(body.code ?? "")
  const ref = body.ref ? String(body.ref).slice(0, 200) : undefined
  if (!CODE_RE.test(code)) {
    res.status(400).json({ error: "code is required" })
    return
  }
  if (!SELF_CLAIM_CODES.has(code)) {
    res.status(403).json({ error: "code must be claimed via its own endpoint" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await baziFetch(`${base}/api/qi/earn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: memberId, code, ...(ref ? { ref } : {}) }),
    })
    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      res.status(upstream.status).json(payload)
      return
    }
    res.status(200).json(payload)
  } catch {
    res.status(502).json({ error: "qi earn unreachable" })
  }
}
