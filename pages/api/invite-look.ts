// BFF — GET /api/invite-look?code=MUMATE123: ใช้โค้ดแนะนำได้ไหม + ชื่อผู้ชวน (สำหรับหน้า /invite).
// public (ผู้รับลิงก์ยังไม่มีบัญชี); คืนแค่ @name ผู้ชวน ไม่มีข้อมูลส่วนตัวอื่น.
// Engine: GET {BAZI_BASE_URL}/api/referral?code= (pdf-dev).
import type { NextApiRequest, NextApiResponse } from "next"

const CODE_RE = /^MUMATE\d{3}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const code = String(req.query.code ?? "").trim().toUpperCase()
  if (!CODE_RE.test(code)) {
    res.status(400).json({ error: "โค้ดไม่ถูกต้อง" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/referral?code=${encodeURIComponent(code)}`)
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "referral unreachable" })
  }
}
