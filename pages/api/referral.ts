// BFF — /api/referral: โค้ดแนะนำเพื่อนของผู้ใช้ที่ล็อกอิน (anonId = cookie-mumate-id).
//   GET          → { code, redeemed } (สร้างครั้งแรกอัตโนมัติ — รูปแบบ MUMATE+เลข 3 หลัก)
//   POST {code}  → กรอกโค้ดเพื่อน: ผู้ชวน +250 coins · คนกรอก +100 coins (คนละครั้งตลอดชีพ)
// Engine: {BAZI_BASE_URL}/api/referral (pdf-dev).
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_RE = /^[A-Za-z0-9]{4,32}$/

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
    if (req.method === "GET") {
      const upstream = await fetch(`${base}/api/referral?anonId=${encodeURIComponent(rawId)}`)
      const payload = await upstream.json().catch(() => ({}))
      res.status(upstream.ok ? 200 : upstream.status).json(payload)
      return
    }
    const code = String((req.body ?? {}).code ?? "").trim()
    if (!CODE_RE.test(code)) {
      res.status(400).json({ error: "code is required" })
      return
    }
    const upstream = await fetch(`${base}/api/referral`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, code }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "referral unreachable" })
  }
}
