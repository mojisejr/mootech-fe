-- 0040 — แพ็กรวมคอร์ส (พล 2026-10-02): ข้อเสนอขึ้น "ก่อนจ่าย" แล้วจ่ายครั้งเดียว
--   landing → Upsell: เอา → COURSE_BUNDLE_790 (คอร์สปฏิทิน + Bazi Life Matrix + Mumate + 1 ปี)
--          → ไม่เอา → Downsell: เอา → COURSE_BUNDLE_689 (คอร์สปฏิทิน + Bazi Life Matrix + Mumate + 1 เดือน)
--          → ไม่เอา → COURSE_CAL_490 (คอร์สปฏิทิน + Mumate + 1 เดือน)
-- แพ็กหลังจ่ายของ 0039 (COURSE_MATRIX_UP_300 / COURSE_MATRIX_199) ปิดขาย — แถวยังอยู่ ใครซื้อไปแล้วยังได้สิทธิ์ครบ
-- ADDITIVE ONLY · รันซ้ำได้ (idempotent). ต้องรัน 0039 ก่อน.
INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
SELECT v.plan_code, v.package_code, v.description, v.buffer_day, v.amount, v.expire, v.max_user, v.tier_code, v.is_active
  FROM (VALUES
    ('MEMBER', 'COURSE_BUNDLE_790', 'คอร์สปฏิทิน + Bazi Life Matrix + Mumate + 1 ปี',    0::bigint, 790::double precision, '1Y', 1::bigint, 'PLUS', true),
    ('MEMBER', 'COURSE_BUNDLE_689', 'คอร์สปฏิทิน + Bazi Life Matrix + Mumate + 1 เดือน', 0::bigint, 689::double precision, '1M', 1::bigint, 'PLUS', true)
  ) AS v(plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
 WHERE NOT EXISTS (
   SELECT 1 FROM payment_package p WHERE p.package_code = v.package_code
 );
--> statement-breakpoint
UPDATE payment_package SET is_active = false WHERE package_code IN ('COURSE_MATRIX_UP_300', 'COURSE_MATRIX_199');
