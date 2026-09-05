// BFF — /api/v2/sacred-map: แผนที่สถานที่ศักดิ์สิทธิ์ (engine เป็น source: มี data + verify + checkin)
//   GET ?element=&need=  → { ok, locations[], unavailable? }  (สถานที่ verified กรองตามธาตุ/ความต้องการ)
//   POST { id }          → เช็คอิน (+1) → { ok, checkinCount }
// Engine: {BAZI_BASE_URL}/api/sacred-map (+/checkin)
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const base = process.env.BAZI_BASE_URL
  if (!base) {
    res.status(200).json({ ok: true, locations: [], unavailable: true })
    return
  }
  try {
    if (req.method === "GET") {
      const element = typeof req.query.element === "string" ? req.query.element : ""
      const need = typeof req.query.need === "string" ? req.query.need : ""
      const qs = new URLSearchParams()
      if (element) qs.set("element", element)
      if (need) qs.set("need", need)
      const upstream = await fetch(`${base}/api/sacred-map${qs.toString() ? `?${qs}` : ""}`)
      const payload = await upstream.json().catch(() => ({ ok: true, locations: [], unavailable: true }))
      res.status(200).json(payload)
      return
    }
    if (req.method === "POST") {
      const id = String((req.body ?? {}).id ?? "").trim()
      if (!id) {
        res.status(400).json({ error: "id is required" })
        return
      }
      const upstream = await fetch(`${base}/api/sacred-map/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const payload = await upstream.json().catch(() => ({}))
      res.status(upstream.ok ? 200 : upstream.status).json(payload)
      return
    }
    res.status(405).json({ error: "Method not allowed" })
  } catch {
    res.status(200).json({ ok: true, locations: [], unavailable: true })
  }
}
