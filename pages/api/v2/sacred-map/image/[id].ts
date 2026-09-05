// BFF — GET /api/v2/sacred-map/image/[id]: พร็อกซีรูปสถานที่จาก engine (เสิร์ฟ bytes จาก DB)
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const id = String(req.query.id ?? "").trim()
  const base = process.env.BAZI_BASE_URL
  if (!id || !base) {
    res.status(404).json({ error: "not found" })
    return
  }
  try {
    const upstream = await fetch(`${base}/api/sacred-map/image/${encodeURIComponent(id)}`, { redirect: "follow" })
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "ไม่พบรูป" })
      return
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg"
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.setHeader("Content-Type", contentType)
    res.setHeader("Cache-Control", "public, max-age=86400")
    res.status(200).send(buf)
  } catch {
    res.status(502).json({ error: "โหลดรูปไม่สำเร็จ" })
  }
}
