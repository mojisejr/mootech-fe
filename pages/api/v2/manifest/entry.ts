// BFF — /api/v2/manifest/entry: บันทึกประจำวัน (mood + note) + สตรีค (ต่อ engine /api/manifest/entry)
//   GET ?from&to → { entries[], streak{current,best} } · POST { date?, mood?(1-5), note? } → { rewarded, streak }
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  if (!UUID_RE.test(rawId)) {
    res.status(401).json({ code: "not_authenticated" })
    return
  }
  const base = process.env.BAZI_BASE_URL
  if (!base) {
    res.status(503).json({ error: "engine not configured" })
    return
  }
  try {
    if (req.method === "GET") {
      const qs = new URLSearchParams({ anonId: rawId })
      const from = typeof req.query.from === "string" ? req.query.from : ""
      const to = typeof req.query.to === "string" ? req.query.to : ""
      if (from) qs.set("from", from)
      if (to) qs.set("to", to)
      const upstream = await fetch(`${base}/api/manifest/entry?${qs.toString()}`)
      res.status(upstream.status).json(await upstream.json().catch(() => ({ entries: [] })))
      return
    }
    if (req.method === "POST") {
      const upstream = await fetch(`${base}/api/manifest/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(req.body ?? {}), anonId: rawId }),
      })
      res.status(upstream.status).json(await upstream.json().catch(() => ({})))
      return
    }
    res.status(405).json({ error: "Method not allowed" })
  } catch {
    res.status(502).json({ error: "manifest entry unreachable" })
  }
}
