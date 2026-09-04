// BFF — GET /api/qi-entitlements: สรุปสิทธิ์ปัจจุบัน (tier / เครดิตคงเหลือ / ของที่เป็นเจ้าของ / โควตาฟรี)
// ของผู้ใช้ที่ล็อกอิน (anonId = cookie-mumate-id).
// Engine: GET {BAZI_BASE_URL}/api/qi/entitlements?anonId=... (pdf-dev).
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
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
      `${base}/api/qi/entitlements?anonId=${encodeURIComponent(rawId)}`,
    )
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "qi entitlements unreachable" })
  }
}
