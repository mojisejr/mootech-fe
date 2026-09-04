// BFF — /api/missions: บอร์ดภารกิจของผู้ใช้ที่ล็อกอิน (anonId = cookie-mumate-id).
//   GET                       → ภารกิจทั้งหมด + ความคืบหน้ารอบปัจจุบัน
//   POST { missionId }        → เพิ่มความคืบหน้า; ครบเป้า engine จ่ายรางวัลอัตโนมัติครั้งเดียว
// Engine: {BAZI_BASE_URL}/api/missions (pdf-dev).
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
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    if (req.method === "GET") {
      const upstream = await fetch(
        `${base}/api/missions?anonId=${encodeURIComponent(rawId)}`,
      )
      const payload = await upstream.json().catch(() => ({}))
      res.status(upstream.ok ? 200 : upstream.status).json(payload)
      return
    }
    const body = (req.body ?? {}) as { missionId?: string; increment?: number }
    const missionId = String(body.missionId ?? "")
    if (!missionId) {
      res.status(400).json({ error: "missionId is required" })
      return
    }
    const upstream = await fetch(`${base}/api/missions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonId: rawId,
        missionId,
        // engine cap ที่ target เอง — ไม่ส่งต่อค่าที่ผู้ใช้คุมได้นอกจากตัวเลขถูกช่วง
        increment: Number.isInteger(body.increment) ? Math.min(Math.max(Number(body.increment), 1), 100) : 1,
      }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "missions unreachable" })
  }
}
