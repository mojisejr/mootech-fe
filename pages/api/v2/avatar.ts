// BFF — /api/v2/avatar: รูปโปรไฟล์ (edit-personal-info "เปลี่ยนรูปโปรไฟล์")
//   GET                     → bytes รูปของผู้ใช้ (จาก session — resolveRouteMember) | 404
//   POST {imageBase64,mime} → อัปโหลด (engine ย่อ 256px เก็บ base64) | 409 ยังไม่ตั้ง @name
// Engine: {BAZI_BASE_URL}/api/profile/avatar
import type { NextApiRequest, NextApiResponse } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { resolveRouteMember } from '@/lib/v2/resolve-user'


// รูป LINE จาก DB (user.picture_url) — fallback เมื่อ cookie-mumate-image ว่าง (ผู้ใช้เก่าที่ cookie ยังไม่มีรูป
// จากบั๊ก stale-read; DB ถูกเก็บไว้ครบเสมอ). คืน "" ถ้าไม่มี/พลาด — ไม่ให้ล้มทั้ง route.
async function linePictureFromDb(userId: string): Promise<string> {
  try {
    const rows = (await db.execute(sql`SELECT picture_url FROM "user" WHERE user_id = ${userId} LIMIT 1`)) as unknown as Array<{ picture_url?: string | null }>
    return String(rows[0]?.picture_url ?? "")
  } catch {
    return ""
  }
}

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const memberId = who.userId
  const base = process.env.BAZI_BASE_URL
  if (!base) {
    res.status(503).json({ error: "engine not configured" })
    return
  }
  try {
    if (req.method === "GET") {
      const upstream = await fetch(`${base}/api/profile/avatar?anonId=${encodeURIComponent(memberId)}`)
      if (!upstream.ok) {
        // ยังไม่ได้อัพโหลดรูปเอง → ใช้รูปตั้งต้นจาก LINE (cookie-mumate-image) เพื่อให้ทุกหน้าโชว์รูปเดียวกัน
        // ทำที่ชั้น server เพื่อให้จอ shell เรียก /api/v2/avatar ที่เดียว ไม่ต้องรู้ว่ามีรูปอัพโหลดหรือไม่
        const lineRaw = req.cookies["cookie-mumate-image"] ?? ""
        const lineUrl = (() => { try { return decodeURIComponent(lineRaw) } catch { return lineRaw } })()
        if (/^https:\/\//i.test(lineUrl)) {
          res.setHeader("Cache-Control", "private, max-age=0, must-revalidate")
          res.redirect(302, lineUrl)
          return
        }
        // cookie ว่าง (ผู้ใช้เก่า/บั๊ก stale-read) → อ่านรูป LINE จาก DB แทน จะได้ไม่ต้อง login ใหม่
        const dbUrl = await linePictureFromDb(memberId)
        if (/^https:\/\//i.test(dbUrl)) {
          res.setHeader("Cache-Control", "private, max-age=0, must-revalidate")
          res.redirect(302, dbUrl)
          return
        }
        res.status(upstream.status).json({ error: "ยังไม่มีรูปโปรไฟล์" })
        return
      }
      const contentType = upstream.headers.get("content-type") || "image/jpeg"
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.setHeader("Content-Type", contentType)
      res.setHeader("Cache-Control", "private, max-age=0, must-revalidate")
      res.status(200).send(buf)
      return
    }
    const body = (req.body ?? {}) as { imageBase64?: string; mime?: string }
    if (!body.imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" })
      return
    }
    const upstream = await fetch(`${base}/api/profile/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId: memberId, imageBase64: body.imageBase64, mime: body.mime }),
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: "avatar unreachable" })
  }
}
