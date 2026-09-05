// BFF — POST /api/fortune/sage: เสี่ยงเซียนเสี่ยงทาย (fortune-sage) ของผู้ใช้ที่ล็อกอิน.
// แนบ anonId จาก cookie ให้ engine ตัดโควตา/QI (qiGate "card"). Engine: POST {BAZI_BASE_URL}/api/fortune-sage/predict.
// 402 = โควตา/ชี่หมด (ส่ง error กลับให้จอเปิดชีตซื้อ/แลก) · 401 = ยังไม่ล็อกอิน.
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
  const body = (req.body ?? {}) as { question?: string; topic?: string; no?: number }
  try {
    const upstream = await fetch(`${base}/api/fortune-sage/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: body.question, topic: body.topic, no: body.no, anonId: rawId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อเซียนไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
