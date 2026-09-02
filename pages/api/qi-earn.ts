// BFF — POST /api/qi-earn { code, ref? }: รับชี่จากภารกิจ (anonId = cookie-mumate-id).
// Engine: POST {BAZI_BASE_URL}/api/qi/earn — จ่ายซ้ำในรอบเดิมไม่ได้ (capped).
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
  const body = (req.body ?? {}) as { code?: string; ref?: string }
  const code = String(body.code ?? "")
  const ref = body.ref ? String(body.ref).slice(0, 200) : undefined
  if (!CODE_RE.test(code)) {
    res.status(400).json({ error: "code is required" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/qi/earn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, code, ...(ref ? { ref } : {}) }),
    })
    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      res.status(upstream.status).json(payload)
      return
    }
    res.status(200).json(payload)
  } catch {
    res.status(502).json({ error: "qi earn unreachable" })
  }
}
