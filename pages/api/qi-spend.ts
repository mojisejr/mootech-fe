// BFF — POST /api/qi-spend { code }: ใช้ชี่แลกสิทธิ์ (anonId = cookie-mumate-id).
// Engine: POST {BAZI_BASE_URL}/api/qi/spend — แต้มไม่พอ → 409 "แต้ม Qi ไม่พอ" ·
// มอบสิทธิ์ล้ม → engine refund แต้มเองแล้วตอบ 500 (ไม่มีทางเสียแต้มเปล่า).
// สถานะ upstream ผ่านไปตรง ๆ เพื่อให้จอแยก "ไม่พอ (409)" กับ "ระบบล้ม (5xx)" ได้จริง.
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_RE = /^[a-z0-9_]{1,64}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  if (!UUID_RE.test(rawId)) {
    res.status(401).json({ code: "not_authenticated" })
    return
  }
  const code = String((req.body ?? {}).code ?? "")
  if (!CODE_RE.test(code)) {
    res.status(400).json({ error: "code is required" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/qi/spend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, code }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "qi spend unreachable" })
  }
}
