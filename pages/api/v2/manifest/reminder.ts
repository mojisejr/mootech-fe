// GET/POST /api/v2/manifest/reminder — opt-in แจ้งเตือนมานิเฟสต์รายเช้า (#359 ซินแสนุ้ย 2026-09-15).
// เก็บฝั่ง server (ตาราง manifest_reminder) แทน localStorage เดิม เพื่อให้ cron รายชั่วโมงอ่านไปยิง push ได้.
// ผูกกับ session user_id เสมอ (resolveSessionUserId) — คำขอไม่ระบุ user, อ่าน/เขียน scope ด้วย user_id นั้น.
import type { NextApiRequest, NextApiResponse } from "next"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { manifestReminder } from "@/lib/db/schema"
import { resolveSessionUserId } from "@/lib/v2/resolve-user"

interface ReminderBody {
  enabled?: boolean
  time?: string // "HH:MM"
  hour?: number
  minute?: number
}

// parse "HH:MM" → {hour,minute} (clamp ให้อยู่ในช่วง); ไม่ถูกต้อง = null
function parseTime(t: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })
  const userId = who.userId

  try {
    if (req.method === "GET") {
      const rows = await db.select().from(manifestReminder).where(eq(manifestReminder.userId, userId)).limit(1)
      const r = rows[0]
      // ไม่มีแถว = ยังไม่เคยตั้ง → ค่าเริ่มต้น ปิด / 07:00
      return res.status(200).json({
        ok: true,
        enabled: r?.enabled ?? false,
        hour: r?.hour ?? 7,
        minute: r?.minute ?? 0,
      })
    }

    if (req.method === "POST") {
      const body = (req.body ?? {}) as ReminderBody
      const enabled = body.enabled === true
      // เวลา: รับ "HH:MM" ก่อน ไม่งั้น hour/minute ตรง ๆ; ค่าเสียใช้ default 07:00
      let hour = 7
      let minute = 0
      if (typeof body.time === "string") {
        const t = parseTime(body.time)
        if (!t) return res.status(400).json({ ok: false, error: "รูปแบบเวลาไม่ถูกต้อง (HH:MM)" })
        hour = t.hour
        minute = t.minute
      } else if (typeof body.hour === "number") {
        if (!Number.isInteger(body.hour) || body.hour < 0 || body.hour > 23) return res.status(400).json({ ok: false, error: "hour ต้องอยู่ 0-23" })
        hour = body.hour
        minute = Number.isInteger(body.minute) && body.minute! >= 0 && body.minute! <= 59 ? body.minute! : 0
      }

      // upsert หนึ่งแถวต่อผู้ใช้; เปลี่ยนเวลา = ล้าง last_sent_date เพื่อให้เวลาใหม่มีผลวันนี้ได้
      await db
        .insert(manifestReminder)
        .values({ userId, enabled, hour, minute, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [manifestReminder.userId],
          set: { enabled, hour, minute, lastSentDate: null, updatedAt: new Date() },
        })
      return res.status(200).json({ ok: true, enabled, hour, minute })
    }

    res.setHeader("Allow", "GET, POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  } catch (err) {
    console.error("[manifest/reminder] failed", err)
    return res.status(500).json({ ok: false, error: "reminder failed" })
  }
}
