// BFF — /api/v2/phone-reading: ดูดวงเบอร์มือถือ (เลขศาสตร์). เบอร์มาจาก input ผู้ใช้ (ไม่ผูก profile).
//   POST { phoneNumber }  → PhoneReading (คู่เลข/ความหมาย/หลัก) จาก engine
// Engine: {BAZI_BASE_URL}/api/bazi/phone-reading (deterministic, stateless)
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  const phoneNumber = String((req.body ?? {}).phoneNumber ?? "").trim()
  if (!phoneNumber) {
    res.status(400).json({ error: "กรุณากรอกเบอร์มือถือ" })
    return
  }
  try {
    const upstream = await fetch(`${base}/api/bazi/phone-reading`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    })
    const payload = await upstream.json().catch(() => ({ error: "อ่านเบอร์ไม่สำเร็จ" }))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "เชื่อมต่อระบบทำนายไม่สำเร็จ" })
  }
}
