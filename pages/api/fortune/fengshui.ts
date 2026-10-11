// BFF — POST /api/fortune/fengshui: ไพ่อาถรรพ์ฮวงจุ้ยของผู้ใช้ที่ล็อกอิน (ซินแสนุ้ย 2026-10-07).
// แนบ anonId ให้ engine ตัดโควตา/QI (qiGate "card"). Engine: POST {BAZI_BASE_URL}/api/fengshui/predict.
//   body: { count?: 1|3, question?: string, persona?: 'mu'|'mi' } → { cards:[{no,name,meaning,caution,advice,imageUrl}], summary?, qi }
import type { NextApiRequest, NextApiResponse } from "next"
import { baziClientHeaders } from "@/lib/bazi/client-identity"
import { resolveRouteMember } from "@/lib/v2/resolve-user"
import { baziFetch } from "@/lib/bazi/fetch"

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
  const body = (req.body ?? {}) as { count?: number; question?: string; persona?: string }
  const count = body.count === 1 ? 1 : 3
  const persona = body.persona === "mi" ? "mi" : "mu"
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 200) : ""
  try {
    const upstream = await baziFetch(`${base}/api/fengshui/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...baziClientHeaders(req) },
      // ซินแสนุ้ย 2026-10-11: หน้าเปิดไพ่ = สรุปคำทำนายแบบไพ่อื่น (style summary) ไม่ใช่คำตอบแบบแชท — สรุปได้แม้ไม่มีคำถาม
      body: JSON.stringify({ mode: "llm", style: "summary", random: true, count, persona, question: question || undefined, anonId: memberId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อไพ่ไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
