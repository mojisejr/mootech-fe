// BFF — /api/v2/avatar: รูปโปรไฟล์ (edit-personal-info "เปลี่ยนรูปโปรไฟล์")
//   GET                     → bytes รูปของผู้ใช้ (จาก cookie-mumate-id) | 404
//   POST {imageBase64,mime} → อัปโหลด (engine ย่อ 256px เก็บ base64) | 409 ยังไม่ตั้ง @name
// Engine: {BAZI_BASE_URL}/api/profile/avatar
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } }

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
  const base = process.env.BAZI_BASE_URL
  if (!base) {
    res.status(503).json({ error: "engine not configured" })
    return
  }
  try {
    if (req.method === "GET") {
      const upstream = await fetch(`${base}/api/profile/avatar?anonId=${encodeURIComponent(rawId)}`)
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: "ยังไม่มีรูปโปรไฟล์" })
        return
      }
      const contentType = upstream.headers.get("content-type") || "image/jpeg"
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.setHeader("Content-Type", contentType)
      res.setHeader("Cache-Control", "private, max-age=0, must-revalidate")
      res.status(200).send(buf)
      return
    }
    const body = (req.body ?? {}) as { imageBase64?: string; mime?: string }
    if (!body.imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" })
      return
    }
    const upstream = await fetch(`${base}/api/profile/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, imageBase64: body.imageBase64, mime: body.mime }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "avatar unreachable" })
  }
}
