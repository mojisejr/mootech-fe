// BFF — /api/v2/narrate: เกลา engine-truth เป็นคำทำนายร้อยแก้วด้วย AI (ใช้ร่วมหลายฟีเจอร์).
//   POST { engineText, domainLabel?, feature? }  → { text } (หรือ { error })
// Engine: {BAZI_BASE_URL}/api/bazi/narrate (LLM, guardServerLlm กันโควตา/ต้นทุนที่ engine).
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  const body = (req.body ?? {}) as { engineText?: string; domainLabel?: string; feature?: string }
  const engineText = String(body.engineText ?? "").trim()
  if (!engineText) {
    res.status(400).json({ error: { message: "engineText is required" } })
    return
  }
  try {
    const upstream = await fetch(`${base}/api/bazi/narrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engineText: engineText.slice(0, 12000),
        domainLabel: body.domainLabel || "ผลวิเคราะห์",
        feature: body.feature || "narrate",
      }),
    })
    const payload = await upstream.json().catch(() => ({ error: { message: "เรียก AI ไม่สำเร็จ" } }))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อ AI ไม่สำเร็จ" } })
  }
}
