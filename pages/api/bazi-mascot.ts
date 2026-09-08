// BFF image proxy — GET /api/bazi-mascot?ganzhi=<60 jiazi> → bazi /api/bazi/mascot/[ganzhi].
// Keeps BAZI_BASE_URL server-side only; the browser never learns the engine origin.
// The mascot endpoint is public GET on the engine (no secret involved).
import type { NextApiRequest, NextApiResponse } from "next"

// ganzhi \u0E08\u0E32\u0E01 engine \u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E08\u0E35\u0E19 (\u0E40\u0E0A\u0E48\u0E19 "\u4E01\u4E11") \u2014 \u0E15\u0E49\u0E2D\u0E07\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15 CJK (\u4E00-\u9FFF) \u0E14\u0E49\u0E27\u0E22
// \u0E44\u0E21\u0E48\u0E07\u0E31\u0E49\u0E19 proxy \u0E15\u0E2D\u0E1A 400 \u0E41\u0E25\u0E30\u0E21\u0E32\u0E2A\u0E04\u0E2D\u0E15\u0E44\u0E21\u0E48\u0E02\u0E36\u0E49\u0E19
const GANZHI_RE = /^[0-9A-Za-z\u0E00-\u0E7F\u4E00-\u9FFF_-]{1,40}$/

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
    // engine returns JSON metadata { imageUrl, imageUrlV2, ... } — NOT raw image bytes.
    // imageUrl points at a deleted Supabase project; imageUrlV2 is the live mootech-v2 bucket.
    // timeout ทุกชั้น — บาง ganzhi ทำให้ engine/สตอเรจค้าง; ถ้าไม่ตัด request หน้าเว็บจะค้างการ์ดเปล่า
    // (ค้างจริง ไม่ error → onError ฝั่ง client ไม่ยิง fallback) ตัดที่ 8 วิให้ตอบ 502 เร็วแทน
    const meta = await fetch(`${base}/api/bazi/mascot/${encodeURIComponent(ganzhi)}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!meta.ok) {
      res.status(502).json({ error: `mascot failed (${meta.status})` })
      return
    }
    const info = (await meta.json()) as { imageUrl?: string; imageUrlV2?: string }
    const imageSrc = info.imageUrlV2 || info.imageUrl
    if (!imageSrc) {
      res.status(404).json({ error: "mascot image missing" })
      return
    }
    const upstream = await fetch(imageSrc, { signal: AbortSignal.timeout(8000) })
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: `mascot image failed (${upstream.status})` })
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
