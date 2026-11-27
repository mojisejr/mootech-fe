// BFF — /api/v2/daily-fortune-reminder: เวลาส่งแจ้งเตือน "ดวงประจำวัน" + สิทธิ์ของผู้ใช้ (ประชุม 24 พ.ย. 2569 ข้อ 6)
//   GET             → { ok, hour, minute, access: { allowed, daysLeft, reason } }
//   POST { time }   → ตั้งเวลา "HH:MM" (หรือ { hour, minute }) แล้วคืนเหมือน GET
// สวิตช์เปิด/ปิด "ดวงประจำวัน" ยังเป็นของ /api/notification-prefs (engine) ที่เดิม — ที่นี่เก็บ "ส่งกี่โมง" อย่างเดียว
// ตั้งเวลาเมื่อไหร่ก็ได้ แต่ "ส่งจริงหรือไม่" ตัดสินตอน cron ด้วยสิทธิ์ (Plus/Pro ทุกวัน · ฟรี 7 วันจากวันสมัคร)
// ไม่ล้าง last_sent_date ตอนเปลี่ยนเวลา — ส่ง 07:00 ไปแล้วแล้วเปลี่ยนเป็น 07:30 ต้องไม่โดนส่งซ้ำในวันเดียวกัน
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveRouteMember } from '@/lib/v2/resolve-user'
import {
  DEFAULT_DAILY_REMINDER_TIME,
  normalizeDailyReminderTime,
  parseDailyReminderTime,
  readDailyFortuneReminder,
  resolveDailyReminderAccess,
  upsertDailyFortuneReminder,
} from '@/lib/v2/daily-fortune-reminder'

type Body = { time?: unknown; hour?: unknown; minute?: unknown }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  const who = await resolveRouteMember(req, res)
  if (!who.ok) {
    res.status(who.status).json(who.body)
    return
  }
  const userId = who.userId

  try {
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Body
      const time =
        parseDailyReminderTime(body.time) ??
        (body.hour !== undefined || body.minute !== undefined ? normalizeDailyReminderTime(body) : null)
      if (!time) {
        res.status(400).json({ ok: false, error: 'เวลาไม่ถูกต้อง (HH:MM)' })
        return
      }
      await upsertDailyFortuneReminder(userId, time)
    }
    const [time, access] = await Promise.all([readDailyFortuneReminder(userId), resolveDailyReminderAccess(userId)])
    res.status(200).json({ ok: true, ...(time ?? DEFAULT_DAILY_REMINDER_TIME), access })
  } catch (err) {
    console.error('[v2][daily-fortune-reminder] failed', err)
    res.status(500).json({ ok: false, error: 'daily fortune reminder failed' })
  }
}
