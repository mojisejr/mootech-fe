-- 0042 · daily_fortune_reminder — เวลาส่งแจ้งเตือน "ดวงประจำวัน" + ตัวกันส่งซ้ำ (ประชุม MuMate 24 พ.ย. 2569 ข้อ 6)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
-- 🔴 prod = Supabase — ให้ ฟีม รัน (CLAUDE.md). ADDITIVE ONLY ตารางใหม่ 1 ตัว ไม่แตะตารางเดิม · idempotent
--
-- หน้าที่: เก็บเฉพาะ "ส่งกี่โมง" และ "ส่งวันนี้แล้ว" — สวิตช์เปิด/ปิด "ดวงประจำวัน" อยู่ที่ engine
-- (bazi_notification_prefs.daily_fortune · ค่าเริ่มต้น true) จึงไม่เก็บสถานะซ้ำกับ engine ที่นี่
-- ใครมีแถว: ผู้ใช้ที่อนุญาต push แล้ว (มี push_subscription) — backfill ด้านล่างรันครั้งเดียว + จากนี้เพิ่มอัตโนมัติ
--   ตอน subscribe (pages/api/v2/push/subscribe) และตอนตั้งเวลา (pages/api/v2/daily-fortune-reminder)
--
-- ต้องทำเพิ่มบน prod (นอกจากรัน SQL นี้): cron ใน vercel.json มีในโค้ดแล้ว (รันทุกนาทีเท่า cron อื่น)
--   ใช้ CRON_SECRET + VAPID keys ชุดเดิมของ push-reminders

CREATE TABLE IF NOT EXISTS daily_fortune_reminder (
  user_id         varchar(36) PRIMARY KEY,
  hour            integer     NOT NULL DEFAULT 7,   -- ชั่วโมง 0-23 (Asia/Bangkok) ที่จะยิง
  minute          integer     NOT NULL DEFAULT 0,   -- นาที 0-59 (cron รันทุกนาที จึงยิงตรงนาทีที่ตั้ง)
  last_sent_date  varchar(10),                       -- YYYY-MM-DD (BKK) กันยิงซ้ำในวันเดียว / cron overlap
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- cron หาแถวที่ถึงเวลาด้วย (hour, minute) ทุกนาที — index คือ scan นั้นพอดี
CREATE INDEX IF NOT EXISTS idx_daily_fortune_reminder_due ON daily_fortune_reminder (hour, minute);
--> statement-breakpoint
-- backfill ครั้งเดียว: ผู้ใช้ที่สมัคร push ไว้แล้ว (ส่งถึงได้จริง) ให้มีแถวเวลา 07:00 — ไม่ทับใครที่มีแถวอยู่แล้ว
INSERT INTO daily_fortune_reminder (user_id)
SELECT DISTINCT user_id FROM push_subscription
ON CONFLICT (user_id) DO NOTHING;
