// BFF — /api/v2/manifest/photo: รูป manifest เก็บใน "ฐานข้อมูลเดียวกับการ์ด" (engine Neon) ไม่ใช่ Supabase.
//   POST { imageBase64, mime } → { url }   (เก็บลง DB, คืน URL เสิร์ฟที่เบราว์เซอร์โหลดได้)
//   GET  ?id=<uuid>            → ไบต์รูป     (proxy จาก engine, สโคปด้วย anonId จาก cookie)
import type { NextApiRequest, NextApiResponse } from "next"

// รูป base64 ใหญ่ — ปลดล็อกลิมิต body (client ย่อ ~1080px q0.8 มาแล้ว) เหมือน /api/v2/avatar
export const config = { api: { bodyParser: { sizeLimit: "8mb" } } }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  // ── เสิร์ฟรูป: /api/v2/manifest/photo?id=<uuid> → proxy ไบต์จาก engine (goal.imageUrl ชี้มาที่นี่) ──
  if (req.method === "GET") {
    const id = typeof req.query.id === "string" ? req.query.id : ""
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "id ไม่ถูกต้อง" })
      return
    }
    try {
      const upstream = await fetch(`${base}/api/manifest/photo/${id}?anonId=${encodeURIComponent(rawId)}`)
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: "ไม่พบรูป" })
        return
      }
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "image/jpeg")
      res.setHeader("Cache-Control", "private, max-age=86400, immutable")
      res.status(200).send(buf)
    } catch {
      res.status(502).json({ error: "manifest photo unreachable" })
    }
    return
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST")
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  // ── อัปโหลด: เก็บลง engine DB → คืน URL เสิร์ฟของ FE เอง (ให้เบราว์เซอร์โหลดผ่าน same-origin) ──
  try {
    const body = (req.body ?? {}) as { imageBase64?: string; mime?: string }
    const upstream = await fetch(`${base}/api/manifest/photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, imageBase64: body.imageBase64, mime: body.mime }),
    })
    const j = (await upstream.json().catch(() => ({}))) as { id?: string; error?: string }
    if (!upstream.ok || !j.id) {
      res.status(upstream.status || 502).json({ error: j.error ?? "อัปโหลดรูปไม่สำเร็จ" })
      return
    }
    res.status(201).json({ url: `/api/v2/manifest/photo?id=${j.id}` })
  } catch {
    res.status(502).json({ error: "manifest photo unreachable" })
  }
}
