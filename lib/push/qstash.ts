// MuMate v2 · QStash one-shot scheduler for reminders (2026-09-13).
// แทน polling: ตอนบันทึกเตือน จอง QStash message "deliver ณ เวลาที่ตั้ง" → QStash ยิง POST มาที่
// /api/v2/push/fire ครั้งเดียวตรงเวลา → ส่ง web push ใบนั้น. ไม่ต้อง cron ทุกนาที.
//
// ต้องตั้ง env: QSTASH_TOKEN (publish) + QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY (verify).
// ถ้ายังไม่ตั้ง token → scheduleReminderPush เป็น no-op (ไม่ throw) — การบันทึกเตือนยังทำงานปกติ
// (แต่จะยังไม่มีตัวยิงจนกว่าจะตั้ง token หรือมี cron สำรอง).
import { Client, Receiver } from '@upstash/qstash'

function qstashClient(): Client | null {
  const token = process.env.QSTASH_TOKEN
  if (!token) return null
  return new Client({ token })
}

/**
 * จอง one-shot push ให้ reminder ยิง ณ fireAt (instant สัมบูรณ์). Idempotent ต่อ reminderId (deduplicationId)
 * → เรียกซ้ำ (retry/บันทึกทับ) ไม่สร้างงานซ้อน. best-effort: ล้ม/ไม่มี token → คืน null ไม่ throw.
 */
export async function scheduleReminderPush(args: { reminderId: string; fireAt: Date; origin: string }): Promise<string | null> {
  const client = qstashClient()
  if (!client) return null
  try {
    const res = await client.publishJSON({
      url: `${args.origin}/api/v2/push/fire`,
      body: { reminderId: args.reminderId },
      notBefore: Math.floor(args.fireAt.getTime() / 1000), // unix seconds — ส่งไม่ก่อนเวลานี้
      deduplicationId: `reminder:${args.reminderId}`, // จองซ้ำ reminder เดิม = อันเดียว
      retries: 3,
    })
    return (res as { messageId?: string })?.messageId ?? null
  } catch (e) {
    console.error('[qstash] scheduleReminderPush failed', e)
    return null
  }
}

/** Receiver สำหรับตรวจลายเซ็นของ QStash ที่ยิงเข้ามาที่ /api/v2/push/fire. null = ยังไม่ตั้ง signing keys. */
export function qstashReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentSigningKey || !nextSigningKey) return null
  return new Receiver({ currentSigningKey, nextSigningKey })
}
