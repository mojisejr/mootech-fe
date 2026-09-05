// BFF — POST /api/fortune/divine: เสี่ยงไพ่จิตวิญญาณแดนสวรรค์ (divine-cards) ของผู้ใช้ที่ล็อกอิน.
// แนบ anonId ให้ engine ตัดโควตา/QI (qiGate "card"). Engine: POST {BAZI_BASE_URL}/api/divine-cards/predict.
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
  const body = (req.body ?? {}) as { cardNos?: number[]; random?: boolean; question?: string }
  const pick = Array.isArray(body.cardNos) && body.cardNos.length === 3 ? { cardNos: body.cardNos } : { random: true }
  try {
    const upstream = await fetch(`${base}/api/divine-cards/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "engine", question: body.question, ...pick, anonId: rawId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อไพ่ไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
