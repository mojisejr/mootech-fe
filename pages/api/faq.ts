// BFF — GET /api/faq: บทความช่วยเหลือ (help-faq / document-reader). public read ไม่ต้องล็อกอิน.
// Engine: GET {BAZI_BASE_URL}/api/help/faq (+?slug=).
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const slug = typeof req.query.slug === "string" ? `?slug=${encodeURIComponent(req.query.slug)}` : ""
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/help/faq${slug}`)
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "faq unreachable" })
  }
}
