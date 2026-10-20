// BFF — POST /api/v2/phone-charge { code }: หักสิทธิ์ดูเบอร์/รังผึ้ง โดย "credit ก่อน → แล้วค่อย QI".
// เจ้าของ 2026-09-15: grant เครดิต phone_reading/honeycomb_reading (ที่ /ops) แล้วต้องดูฟรีก่อนหัก QI.
// ลำดับ: มี credit (engine entitlements) → หัก credit 1 (/api/qi/credit-consume) = ฟรี ; ไม่มี → proxy /api/qi/spend (QI).
// สถานะ upstream ผ่านตรง ๆ (409 = QI ไม่พอ) ให้จอแยก "ไม่พอ" กับ "ระบบล้ม" ได้เหมือน qi-spend เดิม.
import type { NextApiRequest, NextApiResponse } from "next"
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { baziFetch } from '@/lib/bazi/fetch'

const CODES = new Set(["phone_reading", "honeycomb_reading"])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const memberId = who.userId
  const code = String((req.body ?? {}).code ?? "")
  if (!CODES.has(code)) {
    res.status(400).json({ error: "code is required" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    // 0) สิทธิ์ฟรีรายวัน — โควตา card ก้อนเดียวกับไพ่/เซียมซี (ฟรี 1 ครั้ง/วันรวมทุกฟีเจอร์ · gafiw 2026-10-20;
    //    สมาชิก PRO ไม่จำกัด) → ถ้าครั้งนี้ยังเป็น "ฟรี" หักโควตา card แล้วจบ ไม่แตะ QI
    const peek = await baziFetch(`${base}/api/qi/feature-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: memberId, feature: "card" }),
    })
    const pk = peek.ok ? ((await peek.json().catch(() => null)) as { nextSource?: string } | null) : null
    if (pk?.nextSource === "free") {
      const fc = await baziFetch(`${base}/api/qi/feature-consume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId: memberId, feature: "card" }),
      })
      const fr = fc.ok ? ((await fc.json().catch(() => null)) as { source?: string } | null) : null
      if (fr?.source === "free") {
        res.status(200).json({ ok: true, source: "free" })
        return
      }
      // แข่งกันหมดพอดี/หักไปทางอื่น — ถ้า engine หักเครดิต/QI ของไพ่ไปแล้ว ถือว่าจ่ายแล้ว
      if (fc.ok) {
        res.status(200).json({ ok: true, source: fr?.source ?? "card" })
        return
      }
    }
    // 1) มี credit ของฟีเจอร์นี้ไหม → หัก credit (ฟรี ไม่แตะ QI)
    const entRes = await baziFetch(`${base}/api/qi/entitlements?anonId=${encodeURIComponent(memberId)}`)
    if (entRes.ok) {
      const ent = (await entRes.json().catch(() => null)) as { credits?: Record<string, number> } | null
      if (Number(ent?.credits?.[code] ?? 0) > 0) {
        const cRes = await baziFetch(`${base}/api/qi/credit-consume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonId: memberId, kind: code }),
        })
        if (cRes.ok) {
          res.status(200).json({ ok: true, source: "credit" })
          return
        }
        // หัก credit ไม่ทัน (race/หมดพอดี) → ตกไปหัก QI ต่อ
      }
    }
    // 2) ไม่มี credit → หัก QI (เหมือน qi-spend เดิม; 409 = QI ไม่พอ)
    const upstream = await baziFetch(`${base}/api/qi/spend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: memberId, code }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "phone charge unreachable" })
  }
}
