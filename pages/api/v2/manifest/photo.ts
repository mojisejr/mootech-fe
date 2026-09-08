// BFF — /api/v2/manifest/photo: อัปโหลดรูป manifest (ต่อ engine /api/manifest/photo → Supabase → URL)
//   POST { imageBase64, mime } → { url }  (แนบ anonId จาก cookie)
import type { NextApiRequest, NextApiResponse } from "next"

// รูป base64 ใหญ่ — ปลดล็อกลิมิต body (client ย่อ ~1080px q0.8 มาแล้ว) เหมือน /api/v2/avatar
export const config = { api: { bodyParser: { sizeLimit: "8mb" } } }

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
  const base = process.env.BAZI_BASE_URL
  if (!base) {
    res.status(503).json({ error: "engine not configured" })
    return
  }
  try {
    const body = (req.body ?? {}) as { imageBase64?: string; mime?: string }
    const upstream = await fetch(`${base}/api/manifest/photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, imageBase64: body.imageBase64, mime: body.mime }),
    })
    res.status(upstream.status).json(await upstream.json().catch(() => ({})))
  } catch {
    res.status(502).json({ error: "manifest photo unreachable" })
  }
}
