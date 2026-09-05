// BFF — GET /api/fortune/card-image/{oracle|divine}/{no}: พร็อกซีรูปหน้าไพ่จาก engine
// engine เสิร์ฟ bytes จากไฟล์จริง (ไม่พึ่ง Supabase CDN) → FE เชื่อมมาที่ engine เป็น source เดียว.
import type { NextApiRequest, NextApiResponse } from "next"

const ENDPOINT: Record<string, string> = {
  oracle: "oracle-cards",
  divine: "divine-cards",
  sage: "fortune-sage",
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const mode = String(req.query.mode ?? "")
  const no = parseInt(String(req.query.no ?? ""), 10)
  const path = ENDPOINT[mode]
  if (!path || !Number.isFinite(no) || no < 1) {
    res.status(400).json({ error: "พารามิเตอร์ไม่ถูกต้อง" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/${path}/image/${no}`)
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `ไม่พบรูปไพ่ #${no}` })
      return
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg"
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.setHeader("Content-Type", contentType)
    res.setHeader("Cache-Control", "public, max-age=86400, immutable")
    res.status(200).send(buf)
  } catch {
    res.status(502).json({ error: "โหลดรูปไพ่ไม่สำเร็จ" })
  }
}
