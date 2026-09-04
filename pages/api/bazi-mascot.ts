// BFF image proxy — GET /api/bazi-mascot?ganzhi=<60 jiazi> → bazi /api/bazi/mascot/[ganzhi].
// Keeps BAZI_BASE_URL server-side only; the browser never learns the engine origin.
// The mascot endpoint is public GET on the engine (no secret involved).
import type { NextApiRequest, NextApiResponse } from "next"

const GANZHI_RE = /^[0-9A-Za-z\u0E00-\u0E7F_-]{1,40}$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const ganzhi = String(req.query.ganzhi ?? "")
  if (!GANZHI_RE.test(ganzhi)) {
    res.status(400).json({ error: "ganzhi is required" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/bazi/mascot/${encodeURIComponent(ganzhi)}`)
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: `mascot failed (${upstream.status})` })
      return
    }
    const type = upstream.headers.get("content-type") ?? "image/png"
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    })
    const reader = upstream.body.getReader()
    res.flushHeaders?.()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  } catch {
    res.status(502).json({ error: "mascot unreachable" })
  }
}
