// POST /api/v2/push/test — ส่ง web-push "ทดสอบ" เข้าอุปกรณ์ของผู้ใช้ทันที (ข้าม cron/reminder ทั้งหมด).
// ใช้ debug ว่าปัญหา "แจ้งเตือนไม่เข้า" อยู่ที่ (ก) subscription/เบราว์เซอร์ หรือ (ข) cron/แพลน:
//   - ทดสอบเด้ง → subscription+เบราว์เซอร์โอเค → ปัญหาคือ cron (ความถี่/แพลน Vercel)
//   - ทดสอบไม่เด้ง → permission/subscription/เบราว์เซอร์ (เช่น Brave บล็อก push)
// identity = resolveSessionUserId (รวม MEMBER_ID fallback #391). ส่งไปทุก subscription ของผู้ใช้.
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { createDbRepo } from '@/lib/push/repo'
import { sendPush } from '@/lib/push/send'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  }
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  const repo = createDbRepo(db)
  let subs
  try {
    subs = await repo.loadSubscriptions(who.userId)
  } catch (e) {
    console.error('[push/test] loadSubscriptions failed', e)
    return res.status(500).json({ ok: false, error: 'โหลดอุปกรณ์ไม่สำเร็จ' })
  }
  if (subs.length === 0) {
    return res.status(200).json({ ok: true, devices: 0, sent: 0, noDevice: true, message: 'ยังไม่มีอุปกรณ์ที่รับแจ้งเตือน (subscribe ก่อน)' })
  }

  const payload = {
    title: '🔔 ทดสอบแจ้งเตือน MuMate',
    body: 'ถ้าเห็นข้อความนี้ = ระบบแจ้งเตือนบนเครื่องนี้ทำงานปกติ ✅',
    url: '/v2/calendar',
  }
  let sent = 0, gone = 0, failed = 0
  for (const s of subs) {
    try {
      const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload)
      if (r.status === 'ok') sent += 1
      else if (r.status === 'gone') { gone += 1; try { await repo.deleteSubscription(s.id) } catch { /* ignore */ } }
      else failed += 1
    } catch (e) {
      console.error('[push/test] sendPush threw', e)
      failed += 1
    }
  }
  return res.status(200).json({ ok: true, devices: subs.length, sent, gone, failed })
}
