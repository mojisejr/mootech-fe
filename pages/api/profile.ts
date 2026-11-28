// BFF — /api/profile: โปรไฟล์ของผู้ใช้ที่ล็อกอิน (anonId = user_id ของผู้เรียก จาก session — resolveRouteMember).
//   GET            → โปรไฟล์ + quota แก้วันเกิด { birthEditFreeUsed, birthEditPriceQi, pendingCorrection }
//   PATCH {…}      → แก้ชื่อ/เพศเสมอ; แก้วันเกิด → engine ตัดสินโควตาเอง (ฟรีครั้งแรก / หัก 150 QI → 409 ถ้าไม่พอ)
//   POST {reason}  → คำขอพิจารณาแก้วันเกิด (correction request)
// Engine: {BAZI_BASE_URL}/api/profile (pdf-dev 0041).
//
// 🔴 legacy backfill (บั๊ก prod 2026-09-07): ผู้ใช้เก่ามีวันเกิดอยู่ใน legacy `user.dob/time` (mootech-be) แต่
// engine `bazi_user_profile.birth_date` ว่าง → /account ขึ้น "กรอกวันเกิด" + หน้าแก้วันเกิดว่าง ทั้งที่หน้าหลัก
// รู้ธาตุแล้ว. GET ที่นี่จึง (1) เติม birthDate/birthTime จาก legacy ให้คำตอบครบทันที และ (2) ยิง PATCH ไป engine
// แบบ best-effort ให้ครั้งถัดไปไม่ต้องเติมอีก — engine ถือว่า "กรอกครั้งแรก" ไม่กินสิทธิ์ฟรี/ไม่หัก QI.
//
// 🔴 เพศมี 2 แหล่งเหมือนวันเกิด (ประชุม 24 พ.ย. ข้อ 5 — เคสใส่เพศผิดแล้วดวงกลับด้าน แก้แล้วไม่เปลี่ยน): engine
// `bazi_user_profile.gender` คือที่หน้าแก้โปรไฟล์เขียน แต่ตัวคำนวณทุกตัวอ่านเพศจาก legacy `user.gender`
// (lib/bazi-bridge/input.ts userRowToFeCalcInput — mergeEngineBirth ทับแค่วัน/เวลา). ค่าที่เขียนลง engine จึงต้อง
// เขียน legacy ด้วย และแถวโปรไฟล์ engine ถูกสร้างตอนตั้ง @name โดยไม่มีค่าเพศ → เพศใน engine มีได้ทางเดียว
// คือผู้ใช้เลือกเอง จึงถือเป็น "ค่าล่าสุดที่ผู้ใช้เลือก" และซิงก์กลับ legacy ได้เลย (GET ก็ซ่อยให้).
// แก้เพศฟรี ไม่ผูกโควตาแก้วันเกิด (engine คิด QI เฉพาะเมื่อวัน+เวลาเกิดเปลี่ยน).
import type { NextApiRequest, NextApiResponse } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import { baziFetch } from '@/lib/bazi/fetch'


type EngineProfile = { birthDate?: string | null; birthTime?: string | null; timeUnknown?: boolean | null; [k: string]: unknown }
type LegacyBirth = { birth: string; birthTime: string | null; timeUnknown: boolean }

/** ค่าที่ engine รับสำหรับเพศ (src/app/api/profile/route.ts) */
const GENDERS = new Set(["MALE", "FEMALE", "OTHER"])

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

/** เพศใน legacy `user` — ค่าที่ตัวคำนวณอ่านจริง ('' ถ้าไม่มีแถว/ยังไม่ได้ระบุ) */
async function legacyGender(userId: string): Promise<string> {
  try {
    const row = rowsOf(await db.execute(sql`SELECT gender FROM "user" WHERE user_id = ${userId} LIMIT 1`))[0]
    return typeof row?.gender === "string" ? row.gender : ""
  } catch {
    return ""
  }
}

/**
 * เขียนเพศที่ผู้ใช้เลือกลง legacy `user` ด้วย (เขียน engine อย่างเดียว = ดวงไม่เปลี่ยน) และล้าง destiny cache
 * เพราะ cache ผูกกับวันเกิด ไม่ผูกเพศ → แก้เพศอย่างเดียวแล้วยังโดนตอบดวงเดิม (ตัวอย่างเดียวกัน: /api/ops/birth).
 * best-effort ไม่ให้ล้มคำตอบ — engine เป็นแหล่งหลัก. คืน true เมื่อมีการเขียนจริง
 */
async function syncLegacyGender(userId: string, gender: unknown): Promise<boolean> {
  if (typeof gender !== "string") return false
  const value = gender.toUpperCase()
  if (!GENDERS.has(value)) return false
  try {
    if ((await legacyGender(userId)) === value) return false
    await db.execute(sql`UPDATE "user" SET gender = ${value} WHERE user_id = ${userId}`)
  } catch {
    return false /* legacy sync ล้ม — engine บันทึกแล้ว ครั้งถัดไป (GET) จะลองซิงก์ให้อีก */
  }
  try { await db.execute(sql`DELETE FROM "bazi_destiny_cache" WHERE user_id = ${userId}`) } catch { /* ตารางอาจยังไม่มี */ }
  return true
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PATCH" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const memberId = who.userId
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  try {
    const url =
      req.method === "GET"
        ? `${base}/api/profile?anonId=${encodeURIComponent(memberId)}`
        : `${base}/api/profile`
    const upstream = await baziFetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body:
        req.method === "GET"
          ? undefined
          : JSON.stringify({ ...(req.body ?? {}), anonId: memberId }),
    })
    const payload = (await upstream.json().catch(() => ({}))) as { profile?: EngineProfile | null }

    if (req.method === "GET" && upstream.ok) {
      const empty: EngineProfile = { displayName: null, firstName: null, lastName: null, gender: null, email: null, birthProvince: null, hasAvatar: false, avatarUpdatedAt: null }
      // profile null = ยังไม่เคยตั้ง @name ฝั่ง engine (ผู้ใช้เก่าก่อน v2) — สังเคราะห์โปรไฟล์ขั้นต่ำให้จอ v2 มีวันเกิดใช้
      if (!payload.profile?.birthDate) {
        const legacy = await legacyBirth(memberId)
        if (legacy) {
          payload.profile = { ...(payload.profile ?? empty), birthDate: legacy.birth, birthTime: legacy.birthTime, timeUnknown: legacy.timeUnknown, birthSource: "legacy" }
          // backfill engine — best-effort, ไม่รอ ไม่ทำให้คำตอบนี้ล้ม (engine ตอบ 409 ถ้ายังไม่มีแถวโปรไฟล์ — ปล่อยผ่าน)
          void baziFetch(`${base}/api/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ anonId: memberId, birth: legacy.birth, birthTime: legacy.birthTime, timeUnknown: legacy.timeUnknown }),
          }).catch(() => {})
        }
      }
      // เพศ: engine มีค่า = ผู้ใช้เลือกล่าสุด → legacy ยังไม่ตรงก็ซิงก์ให้ (ซ่อมคนที่เคยแก้แล้วดวงไม่เปลี่ยน)
      //       engine ยังไม่มีค่า → โชว์ค่าจาก legacy ซึ่งเป็นค่าที่คำนวณจริง ไม่ให้ช่องว่างจนผู้ใช้กดเลือกผิดโดยไม่รู้
      const chosen = typeof payload.profile?.gender === "string" ? payload.profile.gender : ""
      if (chosen) {
        await syncLegacyGender(memberId, chosen)
      } else {
        const legacy = await legacyGender(memberId)
        if (legacy) payload.profile = { ...(payload.profile ?? empty), gender: legacy }
      }
    }

    // A1: แก้วันเกิดสำเร็จฝั่ง engine → sync กลับ legacy `user` (dob/time/is_remember_time) ด้วย
    // เพราะ destiny/chat ยังอ่านจาก user table อยู่ — ไม่งั้นแก้แล้วธาตุไม่เปลี่ยน. best-effort ไม่ให้ล้มคำตอบ
    if (req.method === "PATCH" && upstream.ok) {
      const birth = typeof req.body?.birth === "string" ? req.body.birth : ""
      if (/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
        const timeUnknown = req.body?.timeUnknown === true
        const bt = typeof req.body?.birthTime === "string" ? req.body.birthTime : ""
        // `user.time` is NOT NULL: an unknown time is '' (what BE always wrote), never NULL — a NULL here
        // failed the whole UPDATE silently (mumate-be-retirement-001 slice 1, plan 0.3 "latent FE bug").
        const time = timeUnknown || !/^\d{2}:\d{2}$/.test(bt) ? "" : bt
        try {
          await db.execute(
            sql`UPDATE "user" SET dob = ${birth}, "time" = ${time}, is_remember_time = ${time !== ""} WHERE user_id = ${memberId}`,
          )
        } catch {
          /* legacy sync best-effort — engine เป็นแหล่งหลักแล้ว (mergeEngineBirth) */
        }
      }
      // เพศแก้ได้ฟรีและไม่ผูกโควตา แต่ต้องถึง legacy `user` ด้วย ดวงถึงจะคำนวณตามเพศใหม่
      await syncLegacyGender(memberId, req.body?.gender)
    }

    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "profile unreachable" })
  }
}
