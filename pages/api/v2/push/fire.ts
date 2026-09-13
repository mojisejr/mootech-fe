// POST /api/v2/push/fire — QStash ยิงมาครั้งเดียว ณ เวลาที่ผู้ใช้ตั้งเตือน (one-shot ต่อ reminder).
// ตรวจลายเซ็น QStash (Receiver) → mark reminder sent แบบ atomic (กันซ้ำกับ cron สำรอง/ยิงซ้ำ) →
// ส่ง web push ให้ทุกอุปกรณ์ของเจ้าของ reminder. ถ้า reminder ถูกลบ/ส่งไปแล้ว → no-op เงียบ ๆ
// (ไม่ต้อง cancel QStash ตอนลบ — endpoint นี้เช็คเอง).
//
// ⚠️ bodyParser ปิด: ต้องใช้ raw body ตรวจลายเซ็น QStash (upstash-signature header).
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { createDbRepo } from '@/lib/push/repo'
import { sendPush } from '@/lib/push/send'
import { buildReminderPayload } from '@/lib/push/payload'
import { qstashReceiver } from '@/lib/push/qstash'

export const config = { api: { bodyParser: false } }

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer))
  return Buffer.concat(chunks).toString('utf8')
}

const rowsOf = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? (r as Record<string, unknown>[]) : ((r as { rows?: Record<string, unknown>[] })?.rows ?? [])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }

  const raw = await readRawBody(req)

  // ตรวจลายเซ็น QStash — กันคนนอกยิง endpoint นี้เอง (fail closed: ไม่มี signing keys = ปฏิเสธ)
  const receiver = qstashReceiver()
  if (!receiver) return res.status(503).json({ ok: false, error: 'qstash not configured' })
  const signature = (req.headers['upstash-signature'] as string | undefined) ?? ''
  let valid = false
  try {
    valid = await receiver.verify({ signature, body: raw })
  } catch {
    valid = false
  }
  if (!valid) return res.status(401).json({ ok: false, error: 'bad signature' })

  let reminderId = ''
  try {
    reminderId = String((JSON.parse(raw) as { reminderId?: unknown }).reminderId ?? '')
  } catch {
    return res.status(400).json({ ok: false, error: 'bad body' })
  }
  if (!reminderId) return res.status(400).json({ ok: false, error: 'reminderId required' })

  try {
    // atomic claim: mark sent เฉพาะถ้ายังไม่ส่ง (กันซ้ำกับ cron สำรอง) + ต้องยังมี row อยู่ (ไม่ถูกลบ)
    const now = new Date().toISOString()
    const claimed = rowsOf(
      await db.execute(sql`
        UPDATE reminder SET sent_at = ${now}::timestamptz
        WHERE id = ${reminderId}
          AND sent_at IS NULL
          AND destinations::jsonb @> '["mumate"]'::jsonb
        RETURNING user_id AS "userId", reminder_date AS "reminderDate", yam_label AS "yamLabel", yam_window AS "window"
      `),
    )
    if (claimed.length === 0) {
      // ถูกลบ หรือ ส่งไปแล้ว → no-op (200 เพื่อไม่ให้ QStash retry)
      return res.status(200).json({ ok: true, skipped: 'gone-or-already-sent' })
    }
    const r = claimed[0] as { userId: string; reminderDate: string; yamLabel: string; window: string }

    const repo = createDbRepo(db)
    const subs = await repo.loadSubscriptions(r.userId)
    const payload = buildReminderPayload({ date: r.reminderDate, yamLabel: r.yamLabel, window: r.window })
    let sent = 0, gone = 0, failed = 0
    for (const s of subs) {
      try {
        const o = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload)
        if (o.status === 'ok') sent += 1
        else if (o.status === 'gone') { gone += 1; try { await repo.deleteSubscription(s.id) } catch { /* ignore */ } }
        else failed += 1
      } catch (e) {
        console.error('[push/fire] sendPush threw', e)
        failed += 1
      }
    }
    return res.status(200).json({ ok: true, devices: subs.length, sent, gone, failed })
  } catch (err) {
    console.error('[push/fire] failed', err)
    return res.status(500).json({ ok: false, error: 'fire failed' })
  }
}
