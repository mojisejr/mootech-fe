// BFF — /api/missions: บอร์ดภารกิจของผู้ใช้ที่ล็อกอิน (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember).
//   GET                       → ภารกิจทั้งหมด + ความคืบหน้ารอบปัจจุบัน
//   POST { missionId }        → เพิ่มความคืบหน้า; ครบเป้า engine จ่ายรางวัลอัตโนมัติครั้งเดียว
// Engine: {BAZI_BASE_URL}/api/missions (pdf-dev).
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
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    if (req.method === "GET") {
      const upstream = await fetch(
        `${base}/api/missions?anonId=${encodeURIComponent(memberId)}`,
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
        anonId: memberId,
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
