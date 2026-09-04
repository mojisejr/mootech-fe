// BFF — /api/notification-prefs: ตั้งค่าการแจ้งเตือน (anonId = cookie-mumate-id).
//   GET → 3 หมวด (ยังไม่ตั้ง = ค่าเริ่มต้น)   PUT {dailyFortune?, reminders?, updates?}
// Engine: {BAZI_BASE_URL}/api/account/notification-prefs.
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
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
    const upstream = await fetch(
      `${base}/api/account/notification-prefs${req.method === "GET" ? `?anonId=${encodeURIComponent(rawId)}` : ""}`,
      {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: req.method === "GET" ? undefined : JSON.stringify({ ...(req.body ?? {}), anonId: rawId }),
      },
    )
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "notification prefs unreachable" })
  }
}
