// BFF — /api/v2/manifest/entry: บันทึกประจำวัน (mood + note) + สตรีค (ต่อ engine /api/manifest/entry)
//   GET ?from&to → { entries[], streak{current,best} } · POST { date?, mood?(1-5), note? } → { rewarded, streak }
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { baziFetch } from '@/lib/bazi/fetch'


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const memberId = who.userId
  const base = process.env.BAZI_BASE_URL
  if (!base) {
    res.status(503).json({ error: "engine not configured" })
    return
  }
  try {
    if (req.method === "GET") {
      const qs = new URLSearchParams({ anonId: memberId })
      const from = typeof req.query.from === "string" ? req.query.from : ""
      const to = typeof req.query.to === "string" ? req.query.to : ""
      if (from) qs.set("from", from)
      if (to) qs.set("to", to)
      const upstream = await baziFetch(`${base}/api/manifest/entry?${qs.toString()}`)
      res.status(upstream.status).json(await upstream.json().catch(() => ({ entries: [] })))
      return
    }
    if (req.method === "POST") {
      const upstream = await baziFetch(`${base}/api/manifest/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(req.body ?? {}), anonId: memberId }),
      })
      res.status(upstream.status).json(await upstream.json().catch(() => ({})))
      return
    }
    res.status(405).json({ error: "Method not allowed" })
  } catch {
    res.status(502).json({ error: "manifest entry unreachable" })
  }
}
