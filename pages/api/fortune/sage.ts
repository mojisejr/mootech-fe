// BFF — POST /api/fortune/sage: เสี่ยงเซียนเสี่ยงทาย (fortune-sage) ของผู้ใช้ที่ล็อกอิน.
// แนบ anonId จาก cookie ให้ engine ตัดโควตา/QI (qiGate "card"). Engine: POST {BAZI_BASE_URL}/api/fortune-sage/predict.
// 402 = โควตา/ชี่หมด (ส่ง error กลับให้จอเปิดชีตซื้อ/แลก) · 401 = ยังไม่ล็อกอิน.
import type { NextApiRequest, NextApiResponse } from "next"
import { baziClientHeaders } from "@/lib/bazi/client-identity"
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
  const body = (req.body ?? {}) as { question?: string; topic?: string; no?: number }
  try {
    const upstream = await fetch(`${base}/api/fortune-sage/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...baziClientHeaders(req) },
      body: JSON.stringify({ mode: "llm", question: body.question, topic: body.topic, no: body.no, anonId: memberId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อเซียนไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
