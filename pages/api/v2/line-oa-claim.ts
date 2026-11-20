// BFF — POST /api/v2/line-oa-claim: แอด LINE OA ของ Mumate แล้วรับ 100 ชี่ (ครั้งเดียว · Kittipon 2026-11-18).
// เช็กจริงกับ LINE (Friendship API ด้วย access token ของ LINE Login ใน session) ก่อนจ่าย — กดรับโดยไม่แอดไม่ได้.
// ต้องการ: LINE Login channel ผูก (bot link) กับ OA ใน LINE Developers ไม่งั้น friendFlag = false เสมอ.
// ผล: 200 {ok, qi} · 400 {reason:"not_line"} ล็อกอินด้วยอย่างอื่น · 401 {reason:"relogin"} token LINE หมดอายุ
//     · 409 {reason:"not_friend"} ยังไม่แอด · engine capped (เคยรับแล้ว) ส่งผ่านตามเดิม
import type { NextApiRequest, NextApiResponse } from "next"
import { getToken } from "next-auth/jwt"
import { resolveRouteMember } from "@/lib/v2/resolve-user"
import { baziFetch } from "@/lib/bazi/fetch"

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
  const token = await getToken({ req })
  if (token?.provider !== "line" || typeof token.accessToken !== "string" || !token.accessToken) {
    res.status(400).json({ reason: "not_line", message: "รับได้เฉพาะบัญชีที่เข้าสู่ระบบด้วย LINE" })
    return
  }
  try {
    const fr = await fetch("https://api.line.me/friendship/v1/status", { headers: { Authorization: `Bearer ${token.accessToken}` } })
    if (fr.status === 401) {
      res.status(401).json({ reason: "relogin", message: "การเชื่อมต่อ LINE หมดอายุ — ออกจากระบบแล้วเข้าใหม่ด้วย LINE แล้วกดรับอีกครั้ง" })
      return
    }
    const f = (await fr.json().catch(() => null)) as { friendFlag?: boolean; message?: unknown } | null
    if (!fr.ok || !f) {
      // No token or member data in logs: the step, LINE's status and LINE's own error text (400 on staging, 2026-11-20).
      const lineSays = typeof f?.message === "string" ? f.message.slice(0, 160) : null
      console.error("[line-oa-claim] friendship check failed", { status: fr.status, parsed: Boolean(f), lineSays })
      res.status(502).json({ reason: "line_error", message: "เช็กกับ LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" })
      return
    }
    if (!f.friendFlag) {
      res.status(409).json({ reason: "not_friend", message: "ยังไม่ได้เพิ่ม Mumate เป็นเพื่อน — กดแอดไลน์ก่อน แล้วกลับมากดรับ" })
      return
    }
  } catch (e) {
    console.error("[line-oa-claim] friendship call threw", e instanceof Error ? e.name : "unknown")
    res.status(502).json({ reason: "line_error", message: "เช็กกับ LINE ไม่สำเร็จ ลองใหม่อีกครั้ง" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const upstream = await baziFetch(`${base}/api/qi/earn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: who.userId, code: "line_oa_add" }),
    })
    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) console.error("[line-oa-claim] qi earn answered", upstream.status)
    res.status(upstream.status).json(payload)
  } catch (e) {
    console.error("[line-oa-claim] qi earn threw", e instanceof Error ? e.name : "unknown")
    res.status(502).json({ error: "qi earn unreachable" })
  }
}
