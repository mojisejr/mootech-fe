// BFF — ประวัติเซียมซีโป๊ยเซียน 20 ใบล่าสุด (GET) + รีวิว 👍/👎 + ข้อความ รับ 3-5 QI (POST {id, rating, review}) · เดือนละไม่เกิน 100 QI
// Engine: {BAZI_BASE_URL}/api/immortal-cards/siamsi/history — anonId จาก session เท่านั้น
import type { NextApiRequest, NextApiResponse } from "next"
import { baziClientHeaders } from "@/lib/bazi/client-identity"
import { resolveRouteMember } from "@/lib/v2/resolve-user"
import { baziFetch } from "@/lib/bazi/fetch"

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
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream =
      req.method === "GET"
        ? await baziFetch(`${base}/api/immortal-cards/siamsi/history?anonId=${encodeURIComponent(who.userId)}`, { headers: { ...baziClientHeaders(req) } })
        : await baziFetch(`${base}/api/immortal-cards/siamsi/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...baziClientHeaders(req) },
            body: JSON.stringify((() => {
              const b = (req.body ?? {}) as { id?: string; rating?: number; review?: string }
              return { anonId: who.userId, id: String(b.id ?? ""), rating: b.rating === -1 ? -1 : 1, review: String(b.review ?? "") }
            })()),
          })
    res.status(upstream.status).json(await upstream.json().catch(() => ({})))
  } catch {
    res.status(502).json({ error: { message: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง" } })
  }
}
