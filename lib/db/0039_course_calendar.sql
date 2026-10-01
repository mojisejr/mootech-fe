-- 0039 — คอร์สออนไลน์ Mumate (ฟิว/พล 2026-10-01): "Win the Day" (คอร์สปฏิทิน) + "Bazi Life Matrix"
-- Funnel ตามเอกสาร sale page ของพล:
--   COURSE_CAL_490       ฿490  tier PLUS 1M  คอร์สปฏิทิน + Mumate + 1 เดือน (เลนสมาชิกปกติ)
--   COURSE_MATRIX_UP_300 ฿300  tier PLUS 1Y  upsell หลังจ่าย 490: Bazi Life Matrix + Mumate + 1 ปี (รวม 790)
--   COURSE_MATRIX_199    ฿199  tier COURSE   downsell: Bazi Life Matrix อย่างเดียว (รวม 689) — เลนใหม่ ไม่เขียน member_*
-- สิทธิ์คอร์สตลอดชีพอ่านจาก v2_payment (APPROVED + package_code, ไม่ถูก reverse) — ไม่มีตารางสิทธิ์แยก
-- ลิงก์วิดีโอ (YouTube unlisted) เก็บใน course_video — แก้จากหลังบ้าน /ops ของ engine
-- ADDITIVE ONLY · รันซ้ำได้ (idempotent).
ALTER TABLE payment_package DROP CONSTRAINT IF EXISTS payment_package_tier_code_check;
ALTER TABLE payment_package
  ADD CONSTRAINT payment_package_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO','QI','SINSAE','BOOK','COURSE'));
--> statement-breakpoint
ALTER TABLE v2_payment DROP CONSTRAINT IF EXISTS v2_payment_tier_code_check;
ALTER TABLE v2_payment
  ADD CONSTRAINT v2_payment_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO','QI','SINSAE','BOOK','COURSE'));
--> statement-breakpoint
INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
SELECT v.plan_code, v.package_code, v.description, v.buffer_day, v.amount, v.expire, v.max_user, v.tier_code, v.is_active
  FROM (VALUES
    ('MEMBER', 'COURSE_CAL_490',       'Win the Day คอร์สปฏิทิน Mumate + Mumate + 1 เดือน', 0::bigint, 490::double precision, '1M', 1::bigint, 'PLUS',   true),
    ('MEMBER', 'COURSE_MATRIX_UP_300', 'คอร์ส Bazi Life Matrix + Mumate + 1 ปี (upsell)',  0::bigint, 300::double precision, '1Y', 1::bigint, 'PLUS',   true),
    ('MEMBER', 'COURSE_MATRIX_199',    'คอร์ส Bazi Life Matrix (downsell)',                0::bigint, 199::double precision, '1D', 1::bigint, 'COURSE', true)
  ) AS v(plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
 WHERE NOT EXISTS (
   SELECT 1 FROM payment_package p WHERE p.package_code = v.package_code
 );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS course_video (
  course      text        NOT NULL,          -- 'calendar' | 'life-matrix'
  ep          integer     NOT NULL,          -- 1..15
  video_url   text        NOT NULL,          -- ลิงก์ YouTube (watch?v= / youtu.be / embed)
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course, ep)
);
