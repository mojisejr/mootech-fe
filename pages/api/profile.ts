// BFF — /api/profile: โปรไฟล์ของผู้ใช้ที่ล็อกอิน (anonId = cookie-mumate-id).
//   GET            → โปรไฟล์ + quota แก้วันเกิด { birthEditFreeUsed, birthEditPriceQi, pendingCorrection }
//   PATCH {…}      → แก้ชื่อ/เพศเสมอ; แก้วันเกิด → engine ตัดสินโควตาเอง (ฟรีครั้งแรก / หัก 150 QI → 409 ถ้าไม่พอ)
//   POST {reason}  → คำขอพิจารณาแก้วันเกิด (correction request)
// Engine: {BAZI_BASE_URL}/api/profile (pdf-dev 0041).
//
// 🔴 legacy backfill (บั๊ก prod 2026-09-07): ผู้ใช้เก่ามีวันเกิดอยู่ใน legacy `user.dob/time` (mootech-be) แต่
// engine `bazi_user_profile.birth_date` ว่าง → /account ขึ้น "กรอกวันเกิด" + หน้าแก้วันเกิดว่าง ทั้งที่หน้าหลัก
// รู้ธาตุแล้ว. GET ที่นี่จึง (1) เติม birthDate/birthTime จาก legacy ให้คำตอบครบทันที และ (2) ยิง PATCH ไป engine
// แบบ best-effort ให้ครั้งถัดไปไม่ต้องเติมอีก — engine ถือว่า "กรอกครั้งแรก" ไม่กินสิทธิ์ฟรี/ไม่หัก QI.
import type { NextApiRequest, NextApiResponse } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type EngineProfile = { birthDate?: string | null; birthTime?: string | null; timeUnknown?: boolean | null; [k: string]: unknown }
type LegacyBirth = { birth: string; birthTime: string | null; timeUnknown: boolean }

const rowsOf = (r: unknown): Record<string, unknown>[] => (Array.isArray(r) ? r : ((r as { rows?: Record<string, unknown>[] })?.rows ?? []))

/** วันเกิดจาก legacy `user` (user_id = anonId เดียวกัน) — null ถ้าไม่มี/รูปแบบไม่ตรง */
async function legacyBirth(userId: string): Promise<LegacyBirth | null> {
  try {
    const row = rowsOf(await db.execute(sql`SELECT dob, "time", is_remember_time FROM "user" WHERE user_id = ${userId} LIMIT 1`))[0]
    const dob = row?.dob
    const birth = dob instanceof Date ? dob.toISOString().slice(0, 10) : typeof dob === "string" ? dob.slice(0, 10) : ""
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null
    const remember = row?.is_remember_time !== false
    const t = typeof row?.time === "string" ? row.time.slice(0, 5) : ""
    const birthTime = remember && /^\d{2}:\d{2}$/.test(t) ? t : null
    return { birth, birthTime, timeUnknown: !birthTime }
  } catch {
    return null
  }
}

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
    const url =
      req.method === "GET"
        ? `${base}/api/profile?anonId=${encodeURIComponent(rawId)}`
        : `${base}/api/profile`
    const upstream = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body:
        req.method === "GET"
          ? undefined
          : JSON.stringify({ ...(req.body ?? {}), anonId: rawId }),
    })
    const payload = (await upstream.json().catch(() => ({}))) as { profile?: EngineProfile | null }

    if (req.method === "GET" && upstream.ok && !payload.profile?.birthDate) {
      const legacy = await legacyBirth(rawId)
      if (legacy) {
        // profile null = ยังไม่เคยตั้ง @name ฝั่ง engine (ผู้ใช้เก่าก่อน v2) — สังเคราะห์โปรไฟล์ขั้นต่ำให้จอ v2 มีวันเกิดใช้
        const baseProfile: EngineProfile = payload.profile ?? { displayName: null, firstName: null, lastName: null, gender: null, email: null, birthProvince: null, hasAvatar: false, avatarUpdatedAt: null }
        payload.profile = { ...baseProfile, birthDate: legacy.birth, birthTime: legacy.birthTime, timeUnknown: legacy.timeUnknown, birthSource: "legacy" }
        // backfill engine — best-effort, ไม่รอ ไม่ทำให้คำตอบนี้ล้ม (engine ตอบ 409 ถ้ายังไม่มีแถวโปรไฟล์ — ปล่อยผ่าน)
        void fetch(`${base}/api/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonId: rawId, birth: legacy.birth, birthTime: legacy.birthTime, timeUnknown: legacy.timeUnknown }),
        }).catch(() => {})
      }
    }

    // A1: แก้วันเกิดสำเร็จฝั่ง engine → sync กลับ legacy `user` (dob/time/is_remember_time) ด้วย
    // เพราะ destiny/chat ยังอ่านจาก user table อยู่ — ไม่งั้นแก้แล้วธาตุไม่เปลี่ยน. best-effort ไม่ให้ล้มคำตอบ
    if (req.method === "PATCH" && upstream.ok) {
      const birth = typeof req.body?.birth === "string" ? req.body.birth : ""
      if (/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
        const timeUnknown = req.body?.timeUnknown === true
        const bt = typeof req.body?.birthTime === "string" ? req.body.birthTime : ""
        const time = timeUnknown || !/^\d{2}:\d{2}$/.test(bt) ? null : bt
        try {
          await db.execute(
            sql`UPDATE "user" SET dob = ${birth}, "time" = ${time}, is_remember_time = ${!timeUnknown} WHERE user_id = ${rawId}`,
          )
        } catch {
          /* legacy sync best-effort — engine เป็นแหล่งหลักแล้ว (mergeEngineBirth) */
        }
      }
    }

    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "profile unreachable" })
  }
}
