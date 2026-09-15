-- 0029 — BOOK order (#3 ซินแสนุ้ย 2026-09-15): ขายหนังสือ "Your Life Code" ผ่านราง Omise/PromptPay v2
-- เดียวกับสมาชิก/ชี่/SINSAE แต่ settle เป็นเลนของตัวเอง — v2_payment แถว APPROVED (tier_code='BOOK') = หลักฐาน
-- การซื้อ; ไม่เขียน member_* และไม่เครดิตชี่ (ดู lib/payment/repo.ts settleAndProvision เลน BOOK). รายละเอียด
-- จัดส่ง/ผู้สั่งเก็บใน book_order แล้วผูก charge_id ที่หน้า result หลังจ่ายสำเร็จ.
-- ADDITIVE ONLY (กติกา 0016/0028): ไม่มี DROP TABLE / DELETE · รันซ้ำได้ (idempotent).
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Apply BY HAND บน dev → prod (ฟีม/เจ้าของ). goo แตะ prod ไม่ได้.
--
-- CHECK เดิม (0016/0028) ต้อง "หลุด + คืน" อย่างมีเงื่อนไข (DROP IF EXISTS + ADD ชื่อเดิม) คง QI/SINSAE ไว้ + เพิ่ม BOOK
ALTER TABLE payment_package DROP CONSTRAINT IF EXISTS payment_package_tier_code_check;
ALTER TABLE payment_package
  ADD CONSTRAINT payment_package_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO','QI','SINSAE','BOOK'));
--> statement-breakpoint
ALTER TABLE v2_payment DROP CONSTRAINT IF EXISTS v2_payment_tier_code_check;
ALTER TABLE v2_payment
  ADD CONSTRAINT v2_payment_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO','QI','SINSAE','BOOK'));
--> statement-breakpoint
-- 2 แพ็กหนังสือ — ราคาเจ้าของเคาะ 2026-09-15: PDF 1,890 · เล่มปกอ่อน A5 พิมพ์สี + PDF 2,390 (รวมส่ง).
-- expire '1D' เพราะคอลัมน์บังคับ ^\d+[DMY]$ — การสั่งซื้อไม่มีอายุ ค่านี้ถูกเมินในเลน settle ของ BOOK.
-- แก้ราคา/เปิด-ปิดขายที่ /ops ได้ทันทีไม่ต้อง deploy. buffer_day 0, max_user 1 (ซื้อซ้ำได้ ไม่ผ่าน matrix สมาชิก).
INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
SELECT v.plan_code, v.package_code, v.description, v.buffer_day, v.amount, v.expire, v.max_user, v.tier_code, v.is_active
  FROM (VALUES
    ('MEMBER', 'BOOK_PDF',      'หนังสือ Your Life Code (ไฟล์ PDF)',                 0::bigint, 1890::double precision, '1D', 1::bigint, 'BOOK', true),
    ('MEMBER', 'BOOK_PHYSICAL', 'หนังสือ Your Life Code (เล่มปกอ่อน A5 พิมพ์สี + PDF)', 0::bigint, 2390::double precision, '1D', 1::bigint, 'BOOK', true)
  ) AS v(plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
 WHERE NOT EXISTS (
   SELECT 1 FROM payment_package p WHERE p.package_code = v.package_code
 );
--> statement-breakpoint
-- ตารางออเดอร์หนังสือ — ฟิลด์ตามฟอร์มจริง (forms.gle/Lf5f7HUdoj3TvKVk9). ADDITIVE, idempotent.
CREATE TABLE IF NOT EXISTS book_order (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          varchar(36) NOT NULL,
  email            text,
  full_name        text        NOT NULL,
  gender           text        NOT NULL,
  birth_date_be    text        NOT NULL,   -- วันเดือนปีเกิด (พ.ศ.) เป็นข้อความ
  birth_time       text        NOT NULL,
  format           text        NOT NULL,   -- PDF | PHYSICAL
  ship_name        text,
  ship_phone       text,
  ship_address     text,
  contact_channel  text        NOT NULL,   -- Facebook | Instagram | Line
  contact_account  text        NOT NULL,
  package_code     text        NOT NULL,   -- BOOK_PDF | BOOK_PHYSICAL
  amount_satang    integer,
  status           text        NOT NULL DEFAULT 'NEW',  -- NEW | PAID | DONE | CANCELLED
  charge_id        varchar(36),            -- ผูก v2_payment.charge_id หลังจ่ายสำเร็จ
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT book_order_format_check CHECK (format IN ('PDF','PHYSICAL')),
  CONSTRAINT book_order_status_check CHECK (status IN ('NEW','PAID','DONE','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS idx_book_order_user_id ON book_order (user_id);
