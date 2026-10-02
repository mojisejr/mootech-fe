// BFF — /api/account-export: ส่งออกข้อมูลส่วนตัว (PDPA) ของผู้ใช้ที่ล็อกอิน.
//   POST {email?}        → ขอส่งออกแบบ async (engine บันทึกคำขอ status=collecting; ส่งอีเมลจริงรอ provider)
//   GET  ?status=1       → สถานะคำขอล่าสุด
//   GET                  → JSON ทั้งก้อน (ดาวน์โหลดทันที / backup)
// Engine: {BAZI_BASE_URL}/api/account/export
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { baziFetch } from '@/lib/bazi/fetch'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const memberId = who.userId
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    if (req.method === "POST") {
      const email = typeof req.body?.email === "string" ? req.body.email : undefined
      const upstream = await baziFetch(`${base}/api/account/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId: memberId, email }),
      })
      const payload = await upstream.json().catch(() => ({}))
      res.status(upstream.ok ? upstream.status : upstream.status).json(payload)
      return
    }
    const statusQ = req.query.status ? "&status=1" : ""
    const upstream = await baziFetch(`${base}/api/account/export?anonId=${encodeURIComponent(memberId)}${statusQ}`)
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "export unreachable" })
  }
}
