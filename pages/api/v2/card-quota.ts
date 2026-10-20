// BFF — GET /api/v2/card-quota: สิทธิ์ "ครั้งถัดไป" ของโควตา card (ไพ่ทุกสำรับ + เซียมซี + เบอร์มงคล — ก้อนเดียวกัน)
// โดยไม่หัก (engine feature-check = peekUse). ใช้ก่อนกดเปิด: ถ้าครั้งนี้จะ "หัก QI" (ฟรีหมด) → จอขึ้นป็อปอัป
// "อยากดูแบบไม่จำกัด?" ก่อน (Kittipon/gafiw 2026-10-20: ฟรี 1 ครั้ง/วันรวมทุกฟีเจอร์ — กดอีกทีให้ชวนซื้อแพ็กเกจ)
//   → { nextSource: free|credit|qi|null, cost, freeRemaining (-1 = ไม่จำกัด), affordable }
// engine ล่ม → ปล่อยผ่าน (nextSource null + affordable true) ให้ engine ตัดสินตอนเปิดจริงตามเดิม
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from "@/lib/v2/resolve-user"
import { baziFetch } from "@/lib/bazi/fetch"

export type CardQuota = {
  nextSource: "free" | "credit" | "qi" | null
  cost: number
  freeRemaining: number
  affordable: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })
  const who = await resolveRouteMember(req, res)
  if (!who.ok) return res.status(who.status).json(who.body)
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const r = await baziFetch(`${base}/api/qi/feature-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: who.userId, feature: "card" }),
    })
    const j = r.ok ? ((await r.json()) as Partial<CardQuota>) : null
    const out: CardQuota = {
      nextSource: j?.nextSource ?? null,
      cost: typeof j?.cost === "number" ? j.cost : 0,
      freeRemaining: typeof j?.freeRemaining === "number" ? j.freeRemaining : 0,
      affordable: j?.affordable !== false,
    }
    return res.status(200).json(out)
  } catch {
    return res.status(200).json({ nextSource: null, cost: 0, freeRemaining: 0, affordable: true } satisfies CardQuota)
  }
}
