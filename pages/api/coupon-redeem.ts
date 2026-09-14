// BFF — POST /api/coupon-redeem { code }: user แลกคูปองกิจกรรม (anonId = cookie-mumate-id) → engine.
// #2 คูปอง Phase 2. กันรับซ้ำอยู่ฝั่ง engine (1 คูปอง/บัญชี).
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
  const body = (req.body ?? {}) as { code?: string }
  const code = typeof body.code === "string" ? body.code.trim() : ""
  if (!code) {
    res.status(400).json({ error: "code is required" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/coupon/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, code }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "coupon redeem unreachable" })
  }
}
