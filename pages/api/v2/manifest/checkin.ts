// BFF — POST /api/v2/manifest/checkin: ติ๊ก/ถอนงานประจำวันของเป้าหมายมานิเฟส (ต่อ engine)
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
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
  const body = (req.body ?? {}) as { taskId?: string; done?: boolean; date?: string }
  try {
    const upstream = await fetch(`${base}/api/manifest/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: memberId, taskId: body.taskId, done: body.done, date: body.date }),
    })
    res.status(upstream.status).json(await upstream.json().catch(() => ({})))
  } catch {
    res.status(502).json({ error: "manifest unreachable" })
  }
}
