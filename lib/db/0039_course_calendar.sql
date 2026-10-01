-- 0039 — คอร์สสอนใช้ปฏิทินจีน Mumate (ฟิว/พล 2026-10-01).
--   EP 1-7 ฟรีทุกคน · EP 8-13 ต้องมีสิทธิ์: สมาชิก Plus/Pro ที่ยังไม่หมดอายุ หรือ "เคยซื้อคอร์ส" (ตลอดชีพ)
--   แพ็กคอร์ส 2 แบบ = แพ็กเลนสมาชิก tier PLUS (settle เขียน member_subscription ตามปกติ — ไม่ต้องแก้โค้ดจ่ายเงิน)
--     COURSE_CAL_490 : คอร์ส + Plus 1 เดือน · COURSE_CAL_790 : คอร์ส + Plus 1 ปี
--   สิทธิ์คอร์สตลอดชีพอ่านจาก v2_payment (APPROVED + package_code COURSE_CAL_%, ไม่ถูก reverse) — ไม่มีตารางสิทธิ์แยก
--   ลิงก์วิดีโอ (YouTube unlisted) เก็บใน course_video — แก้จากหลังบ้าน /ops ของ engine
-- ADDITIVE ONLY · รันซ้ำได้ (idempotent).
INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
SELECT v.plan_code, v.package_code, v.description, v.buffer_day, v.amount, v.expire, v.max_user, v.tier_code, v.is_active
  FROM (VALUES
    ('MEMBER', 'COURSE_CAL_490', 'คอร์สสอนใช้ปฏิทิน Mumate + Mumate + 1 เดือน', 0::bigint, 490::double precision, '1M', 1::bigint, 'PLUS', true),
    ('MEMBER', 'COURSE_CAL_790', 'คอร์สสอนใช้ปฏิทิน Mumate + Mumate + 1 ปี',    0::bigint, 790::double precision, '1Y', 1::bigint, 'PLUS', true)
  ) AS v(plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
 WHERE NOT EXISTS (
   SELECT 1 FROM payment_package p WHERE p.package_code = v.package_code
 );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS course_video (
  course      text        NOT NULL,          -- 'calendar'
  ep          integer     NOT NULL,          -- 1..13
  video_url   text        NOT NULL,          -- ลิงก์ YouTube (watch?v= / youtu.be / embed)
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course, ep)
);
--> statement-breakpoint
-- โค้ด upsell ขั้นที่ 2 (flow ฟิว 2026-10-01): ไม่เอา 790 → เสนอ 790 ลด 10% = ฿711 · ใช้ได้เฉพาะ COURSE_CAL_790, คนละครั้ง.
-- หน้า /course/calendar แนบโค้ดนี้ใน ?code= ให้ checkout กรอกอัตโนมัติ. พัก/แก้ได้ที่ /ops เหมือนโค้ดอื่น.
INSERT INTO discount_code (id, code, kind, value, max_discount_satang, applies_to, starts_at, ends_at, max_use_total, max_use_per_user, status, used_count, created_by, created_at)
SELECT gen_random_uuid()::text, 'COURSEYEAR10', 'PERCENT', 10, NULL, ARRAY['COURSE_CAL_790'], NULL, NULL, NULL, 1, 'ACTIVE', 0, 'migration-0039', now()
 WHERE NOT EXISTS (SELECT 1 FROM discount_code WHERE lower(code) = 'courseyear10');
