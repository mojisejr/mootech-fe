// BFF — /api/v2/display-name: ชื่อแสดงแบบ @name (team.mp4 2026-09 — ตั้งไม่ซ้ำ โชว์คู่ชื่อจริง)
//   GET                → { displayName | null }      (ของผู้ใช้จาก session — resolveRouteMember)
//   GET ?check=NAME    → { available }               (ฟอร์มเช็คขณะพิมพ์/ก่อนบันทึก)
//   POST {displayName} → ตั้ง/แก้; ชื่อซ้ำ → 409 { error: "display_name_taken" }
// Engine: {BAZI_BASE_URL}/api/profile/display-name
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const memberId = who.userId
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
        : `${base}/api/profile/display-name?anonId=${encodeURIComponent(memberId)}`
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
      body: JSON.stringify({ anonId: memberId, displayName }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "display-name unreachable" })
  }
}
