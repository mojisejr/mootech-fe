// MuMate v2 · Vercel cron — daily fortune reminder (ประชุม MuMate 24 พ.ย. 2569 ข้อ 6).
// รันรายนาที: หาผู้ใช้ที่ตั้งเวลา "ดวงประจำวัน" ตรงนาทีนี้ (Asia/Bangkok) และยังไม่ส่งวันนี้ → ส่ง push
// โครงเดียวกับ manifest-morning: (1) claim แบบ atomic (mark last_sent_date ก่อน) แล้ว (2) ส่ง push นอก statement
// → at-most-once ต่อวัน (crash ได้แค่ "พลาด" ไม่ส่งซ้ำ).
//
// ก่อนส่งให้แต่ละคน ตรวจ 2 ชั้น — ของที่ "ไม่แน่ใจ" ไม่ส่งทั้งหมด:
//   สิทธิ์   Plus/Pro ทุกวัน · ฟรี 7 วันจากวันสมัคร (lib/v2/daily-fortune-access) — อ่านสิทธิ์ไม่ได้ = ไม่ส่ง
//   สวิตช์   "ดวงประจำวัน" ของ engine (GET /api/account/notification-prefs · ค่าเริ่มต้นเปิด) — ปิดอยู่ = ไม่ส่ง,
//           อ่านไม่ได้ = ไม่ส่ง (เคารพการปฏิเสธที่อาจมี เกินกว่าจะส่งก่อนแล้วค่อยขอโทษ)
// secret gate = ขอบเขตความปลอดภัยทั้งหมด (URL เป็น public ตอน deploy) · Method = GET (วิธีที่ Vercel เรียก cron)
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { createDbRepo } from '@/lib/push/repo'
import { sendPush } from '@/lib/push/send'
import { isAuthorized } from '@/lib/push/authorize'
import { buildDailyFortunePayload } from '@/lib/push/payload'
import { bkkDateOf } from '@/lib/v2/daily-fortune-access'
import { dailyFortunePrefOn, resolveDailyReminderAccess } from '@/lib/v2/daily-fortune-reminder'

// เวลาไทย = UTC+7 (ไม่มี DST). คืน { hour, minute, date } ตามเวลาไทย ณ ขณะนั้น
function bangkokNow(now: Date): { hour: number; minute: number; date: string } {
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return { hour: bkk.getUTCHours(), minute: bkk.getUTCMinutes(), date: bkkDateOf(now) }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method not allowed' })
  if (!isAuthorized(req.headers.authorization, process.env.CRON_SECRET)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }

  const now = new Date()
  const { hour, minute, date } = bangkokNow(now)

  // atomic claim+mark: mark last_sent_date = วันนี้ และคืน user_id ที่ถึงคิว (กันส่งซ้ำในวันเดียว / cron overlap)
  const claimed = (await db.execute(sql`
    UPDATE daily_fortune_reminder SET last_sent_date = ${date}
    WHERE hour = ${hour}
      AND minute = ${minute}
      AND (last_sent_date IS NULL OR last_sent_date <> ${date})
    RETURNING user_id AS "userId"
  `)) as unknown as Array<{ userId: string }>

  const repo = createDbRepo(db)
  const payload = buildDailyFortunePayload()
  let sent = 0
  let noDevice = 0
  let deletedSubscriptions = 0
  let failed = 0
  let notEntitled = 0
  let optedOut = 0
  let unknown = 0

  for (const row of claimed) {
    try {
      const access = await resolveDailyReminderAccess(row.userId, now)
      if (!access.allowed) { notEntitled += 1; continue }
      const prefOn = await dailyFortunePrefOn(row.userId)
      if (prefOn === false) { optedOut += 1; continue }
      if (prefOn === null) { unknown += 1; continue }
      const subs = await repo.loadSubscriptions(row.userId)
      if (subs.length === 0) { noDevice += 1; continue }
      let delivered = false
      for (const sub of subs) {
        const outcome = await sendPush(sub, payload)
        if (outcome.status === 'ok') delivered = true
        else if (outcome.status === 'gone') { await repo.deleteSubscription(sub.id); deletedSubscriptions += 1 }
      }
      if (delivered) sent += 1
    } catch {
      failed += 1 // แถวเดียวล้ม ไม่ล้มทั้ง batch (last_sent_date mark ไปแล้ว)
    }
  }

  return res.status(200).json({ ok: true, claimed: claimed.length, sent, noDevice, deletedSubscriptions, failed, notEntitled, optedOut, unknown })
}
