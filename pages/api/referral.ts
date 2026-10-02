// BFF — /api/referral: โค้ดแนะนำเพื่อนของผู้ใช้ที่ล็อกอิน (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember).
//   GET          → { code, redeemed } (สร้างครั้งแรกอัตโนมัติ — รูปแบบ MUMATE+เลข 3 หลัก)
//   POST {code}  → กรอกโค้ดเพื่อน: ผู้ชวน +250 coins · คนกรอก +100 coins (คนละครั้งตลอดชีพ)
// Engine: {BAZI_BASE_URL}/api/referral (pdf-dev).
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { baziFetch } from '@/lib/bazi/fetch'

const CODE_RE = /^[A-Za-z0-9]{4,32}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
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
    if (req.method === "GET") {
      const upstream = await baziFetch(`${base}/api/referral?anonId=${encodeURIComponent(memberId)}`)
      const payload = await upstream.json().catch(() => ({}))
      res.status(upstream.ok ? 200 : upstream.status).json(payload)
      return
    }
    const code = String((req.body ?? {}).code ?? "").trim()
    if (!CODE_RE.test(code)) {
      res.status(400).json({ error: "code is required" })
      return
    }
    const upstream = await baziFetch(`${base}/api/referral`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: memberId, code }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "referral unreachable" })
  }
}
