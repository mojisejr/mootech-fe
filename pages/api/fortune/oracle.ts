// BFF — POST /api/fortune/oracle: เสี่ยงไพ่ออราเคิลเคี้ยงคุง (oracle-cards) ของผู้ใช้ที่ล็อกอิน.
// แนบ anonId ให้ engine ตัดโควตา/QI (qiGate "card"). Engine: POST {BAZI_BASE_URL}/api/oracle-cards/predict.
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
  const body = (req.body ?? {}) as { cardNos?: number[]; random?: boolean; question?: string }
  const pick = Array.isArray(body.cardNos) && body.cardNos.length === 3 ? { cardNos: body.cardNos } : { random: true }
  try {
    const upstream = await baziFetch(`${base}/api/oracle-cards/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...baziClientHeaders(req) },
      body: JSON.stringify({ mode: "llm", question: body.question, ...pick, anonId: memberId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อไพ่ไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
