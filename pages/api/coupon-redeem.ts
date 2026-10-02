// BFF — POST /api/coupon-redeem { code }: user แลกคูปองกิจกรรม (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember) → engine.
// #2 คูปอง Phase 2. กันรับซ้ำอยู่ฝั่ง engine (1 คูปอง/บัญชี).
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { baziFetch } from '@/lib/bazi/fetch'


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
  const body = (req.body ?? {}) as { code?: string }
  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (!code) {
    res.status(400).json({ error: "code is required" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await baziFetch(`${base}/api/coupon/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: memberId, code }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "coupon redeem unreachable" })
  }
}
