-- 0030 · manifest morning reminder opt-in (mootech-fe#359 ซินแสนุ้ย 2026-09-15)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). ADDITIVE ONLY —
-- one brand-new table, no ALTER/DROP on any existing table. Idempotent (IF NOT EXISTS) so a re-run on
-- dev is safe.
--
-- ต้องทำเพิ่มบน prod (นอกจากรัน SQL นี้):
--   1) เพิ่ม cron ใน vercel.json (มีในโค้ดแล้ว) → Vercel จะเรียก /api/cron/manifest-morning รายชั่วโมง
--   2) ตั้ง CRON_SECRET + VAPID keys (ใช้ตัวเดียวกับ push-reminders เดิม อยู่แล้ว)

CREATE TABLE IF NOT EXISTS manifest_reminder (
  user_id         varchar(36) PRIMARY KEY,
  enabled         boolean     NOT NULL DEFAULT false,
  hour            integer     NOT NULL DEFAULT 7,   -- ชั่วโมง 0-23 (Asia/Bangkok) ที่จะยิง
  minute          integer     NOT NULL DEFAULT 0,   -- นาที (โชว์เท่านั้น — cron ยิงระดับชั่วโมง)
  last_sent_date  varchar(10),                       -- YYYY-MM-DD (BKK) กันยิงซ้ำในวันเดียว
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- cron scans enabled rows whose hour matches the current BKK hour — partial index is exactly that scan.
CREATE INDEX IF NOT EXISTS idx_manifest_reminder_hour
  ON manifest_reminder (hour) WHERE enabled = true;
