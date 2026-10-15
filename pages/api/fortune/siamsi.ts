// BFF — POST /api/fortune/siamsi: ไพ่เซียมซีเคี้ยงคุง 80 ใบ (ซินแสนุ้ย 2026-10-15) ของผู้ใช้ที่ล็อกอิน.
// 1 คำถาม = 1 ใบ · แนบ anonId ให้ engine ตัดโควตา/QI ("card") · Engine: POST {BAZI_BASE_URL}/api/siamsi-kiangkung/predict (mode llm, summary)
// แปลงผลให้เป็นรูปแบบเดียวกับ oracle/divine ({cards, engineProse, llmProse, qi}) → ใช้ CardReadingScreen ร่วมกันได้
import type { NextApiRequest, NextApiResponse } from "next"
import { baziClientHeaders } from "@/lib/bazi/client-identity"
import { resolveRouteMember } from "@/lib/v2/resolve-user"
import { baziFetch } from "@/lib/bazi/fetch"

type EngineCard = { no: number; name: string; theme?: string; situation?: string; caution?: string; advice?: string; imageUrl?: string | null }
type EnginePayload = { card?: EngineCard; summary?: string; qi?: unknown; error?: unknown }

export function toCardReading(payload: EnginePayload) {
  const c = payload.card
  if (!c) return payload
  const lines = [c.situation, c.caution ? `ข้อควรระวัง: ${c.caution}` : "", c.advice ? `คำแนะนำ: ${c.advice}` : ""].filter(Boolean)
  return {
    cards: [{ no: c.no, name: c.name, keyword: c.theme ?? "", meaning: c.situation ?? "", book1: c.caution, book2: c.advice, imageUrl: c.imageUrl ?? null }],
    engineProse: lines.join(" "),
    llmProse: payload.summary ?? "",
    qi: payload.qi ?? null,
  }
}

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
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  const body = (req.body ?? {}) as { cardNos?: number[]; random?: boolean; question?: string }
  const pick = Array.isArray(body.cardNos) && body.cardNos.length === 1 ? { cardNo: body.cardNos[0] } : { random: true }
  try {
    const upstream = await baziFetch(`${base}/api/siamsi-kiangkung/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...baziClientHeaders(req) },
      body: JSON.stringify({ mode: "llm", style: "summary", question: body.question, ...pick, anonId: who.userId }),
    })
    const payload = (await upstream.json().catch(() => ({}))) as EnginePayload
    res.status(upstream.status).json(upstream.ok ? toCardReading(payload) : payload)
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อไพ่ไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
