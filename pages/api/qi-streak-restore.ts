// BFF — POST /api/qi-streak-restore: กู้คืนสตรีคเช็คอินที่ขาด 1 วัน (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember).
// Engine: POST {BAZI_BASE_URL}/api/qi/streak-restore — หัก 20 ชี่ + มาร์กวันที่กู้ (จำกัดสัปดาห์ละครั้ง; แต้มไม่พอ → 409).
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
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/qi/streak-restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: memberId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "streak restore unreachable" })
  }
}
