// BFF — /api/notification-prefs: ตั้งค่าการแจ้งเตือน (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember).
//   GET → 3 หมวด (ยังไม่ตั้ง = ค่าเริ่มต้น)   PUT {dailyFortune?, reminders?, updates?}
// Engine: {BAZI_BASE_URL}/api/account/notification-prefs.
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { baziFetch } from '@/lib/bazi/fetch'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
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
    const upstream = await baziFetch(
      `${base}/api/account/notification-prefs${req.method === "GET" ? `?anonId=${encodeURIComponent(memberId)}` : ""}`,
      {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: req.method === "GET" ? undefined : JSON.stringify({ ...(req.body ?? {}), anonId: memberId }),
      },
    )
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "notification prefs unreachable" })
  }
}
