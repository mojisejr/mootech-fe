// BFF — GET /api/chat/quota: สถานะโควตาแชทของผู้ใช้ที่ล็อกอิน (anonId = cookie-mumate-id) สำหรับ
// แถบสถานะบนหน้าแชท เพื่อบอกว่า "คุยจากอะไร / เหลือกี่ / ชี่เท่าไร / คำถามถัดไปหักอะไร".
// รวม 2 อ่านจาก engine (pdf-dev): feature-check(chat) = peekUse (ไม่หัก) + qi/wallet = ยอดชี่.
//   → { qi, unlimited, nextSource, cost, freeRemaining, affordable }
// graceful: engine ล่ม/ไม่มี identity → 401/200 พร้อมค่า null ให้แถบซ่อนเอง ไม่ทำให้หน้าแชทพัง.
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ChatQuota = {
  qi: number | null
  unlimited: boolean
  nextSource: "free" | "credit" | "qi" | null
  cost: number
  freeRemaining: number // -1 = ไม่จำกัด
  affordable: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" })
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  if (!UUID_RE.test(rawId)) return res.status(401).json({ code: "not_authenticated" })

  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const [checkRes, walletRes] = await Promise.all([
      fetch(`${base}/api/qi/feature-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId: rawId, feature: "chat" }),
      }),
      fetch(`${base}/api/qi/wallet?anonId=${encodeURIComponent(rawId)}&history=0`),
    ])
    const check = checkRes.ok ? await checkRes.json() : null
    const wallet = walletRes.ok ? await walletRes.json() : null
    const freeRemaining = typeof check?.freeRemaining === "number" ? check.freeRemaining : 0
    const out: ChatQuota = {
      qi: typeof wallet?.qi === "number" ? wallet.qi : null,
      unlimited: freeRemaining === -1,
      nextSource: check?.nextSource ?? null,
      cost: typeof check?.cost === "number" ? check.cost : 0,
      freeRemaining,
      affordable: check?.affordable !== false,
    }
    return res.status(200).json(out)
  } catch {
    return res.status(200).json({ qi: null, unlimited: false, nextSource: null, cost: 0, freeRemaining: 0, affordable: true })
  }
}
