// BFF — /api/v2/display-name: ชื่อแสดงแบบ @name (team.mp4 2026-09 — ตั้งไม่ซ้ำ โชว์คู่ชื่อจริง)
//   GET                → { displayName | null }      (ของผู้ใช้จาก cookie-mumate-id)
//   GET ?check=NAME    → { available }               (ฟอร์มเช็คขณะพิมพ์/ก่อนบันทึก)
//   POST {displayName} → ตั้ง/แก้; ชื่อซ้ำ → 409 { error: "display_name_taken" }
// Engine: {BAZI_BASE_URL}/api/profile/display-name
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
      const check = typeof req.query.check === "string" ? req.query.check : ""
      const url = check
        ? `${base}/api/profile/display-name?check=${encodeURIComponent(check)}`
        : `${base}/api/profile/display-name?anonId=${encodeURIComponent(rawId)}`
      const upstream = await fetch(url)
      const payload = await upstream.json().catch(() => ({}))
      res.status(upstream.ok ? 200 : upstream.status).json(payload)
      return
    }
    const displayName = String((req.body ?? {}).displayName ?? "").trim()
    if (!displayName) {
      res.status(400).json({ error: "displayName is required" })
      return
    }
    const upstream = await fetch(`${base}/api/profile/display-name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, displayName }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "display-name unreachable" })
  }
}
