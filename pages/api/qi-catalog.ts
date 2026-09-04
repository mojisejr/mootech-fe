// BFF — GET /api/qi-catalog: รายการ "เส้น" ได้/ใช้แต้มทั้งหมดของระบบกิจกรรม Qi.
// ไม่มีข้อมูลผู้ใช้ → public (ไม่เช็ค cookie); จอใช้ตัวเลขจากตรงนี้เป็นหลักเสมอ (ที่มาเดียวของความจริง).
// Engine: GET {BAZI_BASE_URL}/api/qi/catalog (pdf-dev).
import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/qi/catalog`)
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "qi catalog unreachable" })
  }
}
