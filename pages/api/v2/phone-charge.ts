// BFF — POST /api/v2/phone-charge { code }: หักสิทธิ์ดูเบอร์/รังผึ้ง โดย "credit ก่อน → แล้วค่อย QI".
// เจ้าของ 2026-09-15: grant เครดิต phone_reading/honeycomb_reading (ที่ /ops) แล้วต้องดูฟรีก่อนหัก QI.
// ลำดับ: มี credit (engine entitlements) → หัก credit 1 (/api/qi/credit-consume) = ฟรี ; ไม่มี → proxy /api/qi/spend (QI).
// สถานะ upstream ผ่านตรง ๆ (409 = QI ไม่พอ) ให้จอแยก "ไม่พอ" กับ "ระบบล้ม" ได้เหมือน qi-spend เดิม.
import type { NextApiRequest, NextApiResponse } from "next"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODES = new Set(["phone_reading", "honeycomb_reading"])

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
  if (!CODES.has(code)) {
    res.status(400).json({ error: "code is required" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    // 1) มี credit ของฟีเจอร์นี้ไหม → หัก credit (ฟรี ไม่แตะ QI)
    const entRes = await fetch(`${base}/api/qi/entitlements?anonId=${encodeURIComponent(rawId)}`)
    if (entRes.ok) {
      const ent = (await entRes.json().catch(() => null)) as { credits?: Record<string, number> } | null
      if (Number(ent?.credits?.[code] ?? 0) > 0) {
        const cRes = await fetch(`${base}/api/qi/credit-consume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonId: rawId, kind: code }),
        })
        if (cRes.ok) {
          res.status(200).json({ ok: true, source: "credit" })
          return
        }
        // หัก credit ไม่ทัน (race/หมดพอดี) → ตกไปหัก QI ต่อ
      }
    }
    // 2) ไม่มี credit → หัก QI (เหมือน qi-spend เดิม; 409 = QI ไม่พอ)
    const upstream = await fetch(`${base}/api/qi/spend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: rawId, code }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "phone charge unreachable" })
  }
}
