// MuMate v2 · Vercel cron — manifest morning reminder (#359 ซินแสนุ้ย 2026-09-15).
// รันรายชั่วโมง: ยิง push ให้ผู้ใช้ที่ opt-in (manifest_reminder.enabled) และ hour == ชั่วโมงปัจจุบัน (Asia/Bangkok)
// และยังไม่ถูกยิงวันนี้. โครงเดียวกับ push-reminders: (1) claim แบบ atomic (mark last_sent_date ก่อน) แล้ว
// (2) ส่ง push นอก statement → at-most-once ต่อวัน (crash ได้แค่ "พลาด" ไม่ยิงซ้ำ).
//
// secret gate = ขอบเขตความปลอดภัยทั้งหมด (URL เป็น public ตอน deploy). Vercel ส่ง Authorization: Bearer
// <CRON_SECRET> อัตโนมัติเมื่อ set CRON_SECRET. Method = GET (วิธีที่ Vercel เรียก cron).
import type { NextApiRequest, NextApiResponse } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { createDbRepo } from "@/lib/push/repo"
import { sendPush } from "@/lib/push/send"
import { isAuthorized } from "@/lib/push/authorize"
import { buildManifestPayload } from "@/lib/push/payload"

// เวลาไทย = UTC+7 (ไม่มี DST). คืน { hour, date } ตามเวลาไทย ณ ขณะนั้น
function bangkokNow(now: Date): { hour: number; date: string } {
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const y = bkk.getUTCFullYear()
  const m = String(bkk.getUTCMonth() + 1).padStart(2, "0")
  const d = String(bkk.getUTCDate()).padStart(2, "0")
  return { hour: bkk.getUTCHours(), date: `${y}-${m}-${d}` }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method not allowed" })
  if (!isAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ ok: false, error: "unauthorized" })
  }

  const { hour, date } = bangkokNow(new Date())

  // atomic claim+mark: mark last_sent_date = วันนี้ และคืน user_id ที่ถึงคิว (กันยิงซ้ำในวันเดียว / cron overlap)
  const claimed = (await db.execute(sql`
    UPDATE manifest_reminder SET last_sent_date = ${date}
    WHERE enabled = true
      AND hour = ${hour}
      AND (last_sent_date IS NULL OR last_sent_date <> ${date})
    RETURNING user_id AS "userId"
  `)) as unknown as Array<{ userId: string }>

  const repo = createDbRepo(db)
  const payload = buildManifestPayload()
  let sent = 0
  let noDevice = 0
  let deletedSubscriptions = 0
  let failed = 0

  for (const row of claimed) {
    try {
      const subs = await repo.loadSubscriptions(row.userId)
      if (subs.length === 0) { noDevice += 1; continue }
      let delivered = false
      for (const sub of subs) {
        const outcome = await sendPush(sub, payload)
        if (outcome.status === "ok") delivered = true
        else if (outcome.status === "gone") { await repo.deleteSubscription(sub.id); deletedSubscriptions += 1 }
      }
      if (delivered) sent += 1
    } catch {
      failed += 1 // แถวเดียวล้ม ไม่ล้มทั้ง batch (last_sent_date mark ไปแล้ว)
    }
  }

  return res.status(200).json({ ok: true, claimed: claimed.length, sent, noDevice, deletedSubscriptions, failed })
}
