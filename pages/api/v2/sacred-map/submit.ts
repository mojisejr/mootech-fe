// BFF — POST /api/v2/sacred-map/submit : ผู้ใช้เสนอสถานที่ศักดิ์สิทธิ์ใหม่
//   forward body → engine POST /api/sacred-map (เข้าคิว pending รอแอดมิน verify)
// engine validate ด้วย SacredSubmissionSchema (name/lat/lng จำเป็น) — เราแค่ pass-through
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } })
    return
  }
  const base = process.env.BAZI_BASE_URL
  if (!base) {
    res.status(503).json({ error: { message: "ยังเชื่อมต่อระบบไม่ได้ ลองใหม่ภายหลัง" } })
    return
  }
  try {
    const upstream = await fetch(`${base}/api/sacred-map`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
