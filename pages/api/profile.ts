// BFF — /api/profile: โปรไฟล์ของผู้ใช้ที่ล็อกอิน (anonId = cookie-mumate-id).
//   GET            → โปรไฟล์ + quota แก้วันเกิด { birthEditFreeUsed, birthEditPriceQi, pendingCorrection }
//   PATCH {…}      → แก้ชื่อ/เพศเสมอ; แก้วันเกิด → engine ตัดสินโควตาเอง (ฟรีครั้งแรก / หัก 100 ชี่ → 409 ถ้าไม่พอ)
//   POST {reason}  → คำขอพิจารณาแก้วันเกิด (correction request)
// Engine: {BAZI_BASE_URL}/api/profile (pdf-dev 0041).
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PATCH" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  if (!UUID_RE.test(rawId)) {
    res.status(401).json({ code: "not_authenticated" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await fetch(`${base}/api/profile`, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body:
        req.method === "GET"
          ? undefined
          : JSON.stringify({ ...(req.body ?? {}), anonId: rawId }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "profile unreachable" })
  }
}
