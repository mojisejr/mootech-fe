// lib/v2/daily-fortune-reminder.ts — ฝั่ง DB ของแจ้งเตือน "ดวงประจำวัน" (server-only · ประชุม 24 พ.ย. ข้อ 6)
//   resolveDailyReminderAccess(userId) — สมาชิก (resolveSubscription) หรือฟรี 7 วันจากวันสมัคร (กติกา pure อยู่ใน daily-fortune-access.ts)
//   readDailyFortuneReminder / upsertDailyFortuneReminder / ensureDailyFortuneReminderRow — ตาราง daily_fortune_reminder (0042)
// ใช้ร่วมกันโดย cron (/api/cron/daily-fortune) และ API ตั้งเวลา (/api/v2/daily-fortune-reminder)
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { baziFetch } from '@/lib/bazi/fetch'
import { resolveSubscription } from '@/lib/v2/subscription'
import { dailyReminderAccess, parseSignupDate, type DailyReminderAccess } from './daily-fortune-access'

export const DEFAULT_DAILY_REMINDER_TIME = { hour: 7, minute: 0 } as const
export type DailyReminderTime = { hour: number; minute: number }

const rowsOf = (r: unknown): Record<string, unknown>[] => (Array.isArray(r) ? (r as Record<string, unknown>[]) : [])
const num = (v: unknown): number => (typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN)

export function normalizeDailyReminderTime(input: { hour?: unknown; minute?: unknown } | null | undefined): DailyReminderTime | null {
  if (!input) return null
  const hour = num(input.hour)
  const minute = num(input.minute)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  return { hour, minute }
}

/** "HH:MM" → เวลา · รูปแบบไม่ถูก → null (ไม่เดา) */
export function parseDailyReminderTime(text: unknown): DailyReminderTime | null {
  if (typeof text !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  return m ? normalizeDailyReminderTime({ hour: Number(m[1]), minute: Number(m[2]) }) : null
}

export async function readDailyFortuneReminder(userId: string): Promise<DailyReminderTime | null> {
  const r = rowsOf(await db.execute(sql`SELECT hour, minute FROM daily_fortune_reminder WHERE user_id = ${userId} LIMIT 1`))[0]
  return normalizeDailyReminderTime({ hour: r?.hour, minute: r?.minute })
}

/** ตั้งเวลา (ไม่มีแถว = สร้าง) — ไม่แตะ last_sent_date: เปลี่ยนเวลาหลังส่งวันนี้ไปแล้วต้องไม่โดนส่งซ้ำ */
export async function upsertDailyFortuneReminder(userId: string, time: DailyReminderTime): Promise<void> {
  await db.execute(sql`
    INSERT INTO daily_fortune_reminder (user_id, hour, minute, updated_at)
    VALUES (${userId}, ${time.hour}, ${time.minute}, now())
    ON CONFLICT (user_id) DO UPDATE SET hour = EXCLUDED.hour, minute = EXCLUDED.minute, updated_at = now()`)
}

/** ให้มีแถวเวลา 07:00 เมื่อยังไม่มี (ตอน subscribe push) — ไม่ทับเวลาที่ผู้ใช้ตั้งไว้ */
export async function ensureDailyFortuneReminderRow(userId: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO daily_fortune_reminder (user_id, hour, minute)
    VALUES (${userId}, ${DEFAULT_DAILY_REMINDER_TIME.hour}, ${DEFAULT_DAILY_REMINDER_TIME.minute})
    ON CONFLICT (user_id) DO NOTHING`)
}

/** สิทธิ์รับแจ้งเตือนของผู้ใช้คนนี้ ณ ขณะนี้ — อ่านสิทธิ์/วันสมัครไม่ได้ = ไม่อนุญาต (fail-closed) */
export async function resolveDailyReminderAccess(userId: string, now: Date = new Date()): Promise<DailyReminderAccess> {
  let isPaid: boolean | null = null
  try {
    isPaid = (await resolveSubscription(userId)).isPaid
  } catch {
    isPaid = null
  }
  if (isPaid === true) return dailyReminderAccess({ isPaid, signupAt: null, now })
  let row: Record<string, unknown> | undefined
  try {
    row = rowsOf(await db.execute(sql`SELECT create_at, onboarded_at FROM "user" WHERE user_id = ${userId} LIMIT 1`))[0]
  } catch {
    row = undefined
  }
  return dailyReminderAccess({ isPaid, signupAt: parseSignupDate(row?.create_at, row?.onboarded_at), now })
}

const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'

/** สวิตช์ "ดวงประจำวัน" ของผู้ใช้จาก engine (ค่าเริ่มต้นเปิด): true/false · อ่านไม่ได้ → null (ผู้เรียกถือว่าไม่ส่ง) */
export async function dailyFortunePrefOn(memberId: string): Promise<boolean | null> {
  try {
    const r = await baziFetch(`${BAZI_BASE}/api/account/notification-prefs?anonId=${encodeURIComponent(memberId)}`)
    if (!r.ok) return null
    const j = (await r.json().catch(() => null)) as { dailyFortune?: unknown } | null
    return typeof j?.dailyFortune === 'boolean' ? j.dailyFortune : null
  } catch {
    return null
  }
}
