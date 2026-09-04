// BFF — GET /api/qi-wallet: ยอดชี่ + ประวัติ ของผู้ใช้ที่ล็อกอิน (anonId = cookie-mumate-id).
// ?history=N ได้ (default 20, เพดาน 100 ตาม engine) — หน้าประวัติเต็มขอมา 100.
// Engine: GET {BAZI_BASE_URL}/api/qi/wallet?anonId=...&history=N (pdf-dev).
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
  const requested = Number(req.query.history ?? 20)
  const history = Number.isFinite(requested) ? Math.min(100, Math.max(0, Math.floor(requested))) : 20
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(
      `${base}/api/qi/wallet?anonId=${encodeURIComponent(rawId)}&history=${history}`,
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
