-- 0028 — SINSAE booking (#3 ซินแสนุ้ย 2026-09-14): ขาย "จองปรึกษาซินแสตัวต่อตัว" ผ่านราง Omise/PromptPay v2
-- เดียวกับสมาชิก/ชี่ แต่ settle เป็นเลนของตัวเอง — v2_payment แถว APPROVED (tier_code='SINSAE') = หลักฐาน
-- การจอง; ไม่เขียน member_* และไม่เครดิตชี่ (ดู lib/payment/repo.ts settleAndProvision เลน SINSAE).
-- นัดวันเวลาจริงกับซินแสทางไลน์ (โปสเตอร์: "กดจองแล้วทักไลน์เพื่อยืนยันรอบ").
-- ADDITIVE ONLY (เดินตามกติกา 0016): ไม่มี DROP TABLE / DELETE ใด ๆ · รันซ้ำได้ (idempotent)
--
-- 🔴 CHECK เดิมเขียนตอน CREATE/0016 — migration รันซ้ำไม่แตะ; ต้อง "หลุด + คืน" อย่างมีเงื่อนไข
-- (DROP IF EXISTS + ADD ชื่อ constraint เดิม) โดยคง QI ไว้ด้วย แล้วเพิ่ม SINSAE
ALTER TABLE payment_package DROP CONSTRAINT IF EXISTS payment_package_tier_code_check;
ALTER TABLE payment_package
  ADD CONSTRAINT payment_package_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO','QI','SINSAE'));
--> statement-breakpoint
ALTER TABLE v2_payment DROP CONSTRAINT IF EXISTS v2_payment_tier_code_check;
ALTER TABLE v2_payment
  ADD CONSTRAINT v2_payment_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO','QI','SINSAE'));
--> statement-breakpoint
-- 3 แพ็กจอง — ราคาตามโปสเตอร์ 690/1,190/2,890 (แก้ที่ /ops ได้ทันทีไม่ต้อง deploy). expire เป็น '1D' เพราะ
-- คอลัมน์บังคับรูปแบบ ^\d+[DMY]$ — การจองไม่มีอายุ ค่านี้ถูกเมินในเลน settle ของ SINSAE · นาที = SINSAE_MINUTES
-- ใน lib/payment/catalog.ts. buffer_day 0, max_user 1 (ต่อการจอง 1 ครั้ง — ซื้อซ้ำได้เพราะไม่ผ่าน matrix สมาชิก).
INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
SELECT v.plan_code, v.package_code, v.description, v.buffer_day, v.amount, v.expire, v.max_user, v.tier_code, v.is_active
  FROM (VALUES
    ('MEMBER', 'SINSAE_30', 'จองซินแส Unlock! 30 นาที',    0::bigint,  690::double precision, '1D', 1::bigint, 'SINSAE', true),
    ('MEMBER', 'SINSAE_60', 'จองซินแส Deep Dive! 60 นาที', 0::bigint, 1190::double precision, '1D', 1::bigint, 'SINSAE', true),
    ('MEMBER', 'SINSAE_90', 'จองซินแส Level Up! 90 นาที',  0::bigint, 2890::double precision, '1D', 1::bigint, 'SINSAE', true)
  ) AS v(plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
 WHERE NOT EXISTS (
   SELECT 1 FROM payment_package p WHERE p.package_code = v.package_code
 );
