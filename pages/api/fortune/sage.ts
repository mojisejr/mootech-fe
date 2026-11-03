// BFF — POST /api/fortune/sage: เซียมซีโป๊ยเซียน (ซินแสนุ้ย 2026-11-03) ของผู้ใช้ที่ล็อกอิน — 1 ใบตามไฟล์ ไม่ผ่าน AI.
// แนบ anonId จาก cookie ให้ engine ตัดโควตา/QI (qiGate "card"). Engine: POST {BAZI_BASE_URL}/api/immortal-cards/siamsi.
// 402 = โควตา/ชี่หมด (ส่ง error กลับให้จอเปิดชีตซื้อ/แลก) · 401 = ยังไม่ล็อกอิน.
import type { NextApiRequest, NextApiResponse } from "next"
import { baziClientHeaders } from "@/lib/bazi/client-identity"
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
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  const body = (req.body ?? {}) as { question?: string }
  try {
    const upstream = await baziFetch(`${base}/api/immortal-cards/siamsi`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...baziClientHeaders(req) },
      body: JSON.stringify({ question: body.question || undefined, anonId: memberId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อเซียนไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
