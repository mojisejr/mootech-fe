// BFF — GET /api/qi-entitlements: สรุปสิทธิ์ปัจจุบัน (tier / เครดิตคงเหลือ / ของที่เป็นเจ้าของ / โควตาฟรี)
// ของผู้ใช้ที่ล็อกอิน (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember).
// Engine: GET {BAZI_BASE_URL}/api/qi/entitlements?anonId=... (pdf-dev).
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
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
    const upstream = await fetch(
      `${base}/api/qi/entitlements?anonId=${encodeURIComponent(memberId)}`,
    )
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "qi entitlements unreachable" })
  }
}
