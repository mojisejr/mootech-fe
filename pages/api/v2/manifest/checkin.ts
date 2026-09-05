// BFF — POST /api/v2/manifest/checkin: ติ๊ก/ถอนงานประจำวันของเป้าหมายมานิเฟส (ต่อ engine)
import type { NextApiRequest, NextApiResponse } from "next"

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
  const body = (req.body ?? {}) as { taskId?: string; done?: boolean; date?: string }
  try {
    const upstream = await fetch(`${base}/api/manifest/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, taskId: body.taskId, done: body.done, date: body.date }),
    })
    res.status(upstream.status).json(await upstream.json().catch(() => ({})))
  } catch {
    res.status(502).json({ error: "manifest unreachable" })
  }
}
