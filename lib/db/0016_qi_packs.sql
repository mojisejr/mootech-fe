-- 0016 — QI packs (buy-qi ก้อน 1.6): ขายแพ็กชี่ผ่านราง Omise v2 เดียวกับสมาชิก แต่ settle เป็นเลน
-- ของตัวเอง (เครดิตชี่เข้า engine ไม่เขียน member_*) — ดู lib/payment/repo.ts settleAndProvision.
-- ADDITIVE ONLY (เดินตามกติกา 0007/0009): ไม่มี DROP TABLE / DELETE ใด ๆ
--
-- 🔴 CHECK ที่มีอยู่เดิมเขียนตอน CREATE เท่านั้น (0007:30 / 0009:37-40) — migration รันซ้ำไม่แตะมัน
-- จึงต้อง "หลุด + คืน" อย่างมีเงื่อนไข: DROP IF EXISTS + ADD พร้อมชื่อ constraint เดิม ทำให้รันซ้ำได้
-- (ครั้งที่สอง DROP ได้ แล้ว ADD ใหม่ — ผลลัพธ์ตรงกันเสมอ)
ALTER TABLE payment_package DROP CONSTRAINT IF EXISTS payment_package_tier_code_check;
ALTER TABLE payment_package
  ADD CONSTRAINT payment_package_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO','QI'));
--> statement-breakpoint
ALTER TABLE v2_payment DROP CONSTRAINT IF EXISTS v2_payment_tier_code_check;
ALTER TABLE v2_payment
  ADD CONSTRAINT v2_payment_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO','QI'));
--> statement-breakpoint
-- แพ็กชี่ 3 แพ็ก — ราคาชั่วคราว 59/129/299 (ผู้ใช้อนุมัติ 2026-09-03, รอทีมเคาะราคาจริงแล้วแก้ที่
-- ตาราง/ops ได้ทันที ไม่ต้องแตะโค้ด). expire เป็น '1Y' เพราะคอลัมน์บังคับรูปแบบ ^\d+[DMY]$ —
-- แพ็กชี่ไม่มีอายุ ค่านี้ถูกเมินในเลน settle ของ QI · จำนวนชี่ = QI_PACK_QTY ใน lib/payment/catalog.ts
INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
SELECT v.plan_code, v.package_code, v.description, v.buffer_day, v.amount, v.expire, v.max_user, v.tier_code, v.is_active
  FROM (VALUES
    ('MEMBER', 'QI_200',  'แพ็กชี่ 200 ชี่',  0::bigint,   59::double precision, '1Y', 1::bigint, 'QI', true),
    ('MEMBER', 'QI_500',  'แพ็กชี่ 500 ชี่',  0::bigint,  129::double precision, '1Y', 1::bigint, 'QI', true),
    ('MEMBER', 'QI_1200', 'แพ็กชี่ 1,200 ชี่', 0::bigint, 299::double precision, '1Y', 1::bigint, 'QI', true)
  ) AS v(plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
 WHERE NOT EXISTS (
   SELECT 1 FROM payment_package p WHERE p.package_code = v.package_code
 );
