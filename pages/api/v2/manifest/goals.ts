// BFF — /api/v2/manifest/goals: เป้าหมายมานิเฟส (ต่อ engine /api/manifest/goals)
//   GET → goals+tasks+progress ของผู้ใช้ · POST สร้าง · PATCH แก้ · DELETE ลบ (แนบ anonId จาก cookie)
import type { NextApiRequest, NextApiResponse } from "next"

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
  try {
    if (req.method === "GET") {
      const upstream = await fetch(`${base}/api/manifest/goals?anonId=${encodeURIComponent(rawId)}`)
      res.status(upstream.status).json(await upstream.json().catch(() => ({ goals: [] })))
      return
    }
    if (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") {
      const upstream = await fetch(`${base}/api/manifest/goals`, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(req.body ?? {}), anonId: rawId }),
      })
      res.status(upstream.status).json(await upstream.json().catch(() => ({})))
      return
    }
    res.status(405).json({ error: "Method not allowed" })
  } catch {
    res.status(502).json({ error: "manifest unreachable" })
  }
}
