// BFF — GET /api/qi-wallet: ยอดชี่ + ประวัติ ของผู้ใช้ที่ล็อกอิน (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember).
// ?history=N ได้ (default 20, เพดาน 100 ตาม engine) — หน้าประวัติเต็มขอมา 100.
// Engine: GET {BAZI_BASE_URL}/api/qi/wallet?anonId=...&history=N (pdf-dev).
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
  const requested = Number(req.query.history ?? 20)
  const history = Number.isFinite(requested) ? Math.min(100, Math.max(0, Math.floor(requested))) : 20
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(
      `${base}/api/qi/wallet?anonId=${encodeURIComponent(memberId)}&history=${history}`,
    )
    if (!upstream.ok) {
      res.status(502).json({ error: `qi wallet failed (${upstream.status})` })
      return
    }
    res.status(200).json(await upstream.json())
  } catch {
    res.status(502).json({ error: "qi wallet unreachable" })
  }
}
