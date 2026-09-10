// BFF — /api/v2/honeycomb: เบอร์รังผึ้ง (พีระมิดเลข). เบอร์มาจาก input ผู้ใช้ (ไม่ผูก profile).
//   POST { phoneNumber }  → HoneycombReading (rows พีระมิด + layers ความหมาย) จาก engine
// Engine: {BAZI_BASE_URL}/api/honeycomb/predict (deterministic, stateless)
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  const phoneNumber = String((req.body ?? {}).phoneNumber ?? "").trim()
  if (!phoneNumber) {
    res.status(400).json({ error: { message: "กรุณากรอกเบอร์มือถือ" } })
    return
  }
  try {
    const upstream = await fetch(`${base}/api/honeycomb/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    })
    const payload = await upstream.json().catch(() => ({ error: { message: "คำนวณปิรามิดไม่สำเร็จ" } }))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อระบบทำนายไม่สำเร็จ" } })
  }
}
