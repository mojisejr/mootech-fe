// BFF — /api/account-export: ส่งออกข้อมูลส่วนตัว (PDPA) ของผู้ใช้ที่ล็อกอิน.
//   POST {email?}        → ขอส่งออกแบบ async (engine บันทึกคำขอ status=collecting; ส่งอีเมลจริงรอ provider)
//   GET  ?status=1       → สถานะคำขอล่าสุด
//   GET                  → JSON ทั้งก้อน (ดาวน์โหลดทันที / backup)
// Engine: {BAZI_BASE_URL}/api/account/export
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  if (!UUID_RE.test(rawId)) {
    res.status(401).json({ code: "not_authenticated" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    if (req.method === "POST") {
      const email = typeof req.body?.email === "string" ? req.body.email : undefined
      const upstream = await fetch(`${base}/api/account/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId: rawId, email }),
      })
      const payload = await upstream.json().catch(() => ({}))
      res.status(upstream.ok ? upstream.status : upstream.status).json(payload)
      return
    }
    const statusQ = req.query.status ? "&status=1" : ""
    const upstream = await fetch(`${base}/api/account/export?anonId=${encodeURIComponent(rawId)}${statusQ}`)
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "export unreachable" })
  }
}
