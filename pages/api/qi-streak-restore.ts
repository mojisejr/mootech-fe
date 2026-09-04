// BFF — POST /api/qi-streak-restore: กู้คืนสตรีคเช็คอินที่ขาด 1 วัน (anonId = cookie-mumate-id).
// Engine: POST {BAZI_BASE_URL}/api/qi/streak-restore — หัก 20 ชี่ + มาร์กวันที่กู้ (จำกัดสัปดาห์ละครั้ง; แต้มไม่พอ → 409).
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
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
    const upstream = await fetch(`${base}/api/qi/streak-restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "streak restore unreachable" })
  }
}
