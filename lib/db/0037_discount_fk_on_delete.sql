-- ให้ลบโค้ดส่วนลด "ที่ยังไม่ถูกใช้จ่ายจริง" ได้ แม้มี quote/รายการชำระทดสอบอ้างอิงอยู่ (เอ็ม 2026-09-28).
-- เปลี่ยนพฤติกรรม FK ตอนลบ discount_code:
--   · payment_quote.code_id / v2_payment.code_id → ON DELETE SET NULL  (เก็บรายการชำระไว้ แค่ปลดลิงก์โค้ด)
--   · discount_redemption.code_id → ON DELETE CASCADE  (ลบประวัติ preview/reserve ที่ค้างไปด้วย)
-- ไม่แตะข้อมูลการจ่ายจริง: โค้ดที่ used_count>0 (มีคนจ่ายสำเร็จ) แอปยังกันไม่ให้ลบอยู่ (deleteDiscount).
-- idempotent: drop FK เดิมตามชื่อจริง (หาแบบ dynamic) แล้ว add ใหม่พร้อม ON DELETE. รันซ้ำได้.

-- discount_redemption.code_id → CASCADE
DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c FROM pg_constraint con
  WHERE con.conrelid = 'discount_redemption'::regclass AND con.contype = 'f'
    AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'discount_redemption'::regclass AND attname = 'code_id')];
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE discount_redemption DROP CONSTRAINT %I', c); END IF;
END $$;
--> statement-breakpoint
ALTER TABLE discount_redemption
  ADD CONSTRAINT discount_redemption_code_id_fkey
  FOREIGN KEY (code_id) REFERENCES discount_code (id) ON DELETE CASCADE;
--> statement-breakpoint

-- payment_quote.code_id → SET NULL
DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c FROM pg_constraint con
  WHERE con.conrelid = 'payment_quote'::regclass AND con.contype = 'f'
    AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'payment_quote'::regclass AND attname = 'code_id')];
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE payment_quote DROP CONSTRAINT %I', c); END IF;
END $$;
--> statement-breakpoint
ALTER TABLE payment_quote
  ADD CONSTRAINT payment_quote_code_id_fkey
  FOREIGN KEY (code_id) REFERENCES discount_code (id) ON DELETE SET NULL;
--> statement-breakpoint

-- v2_payment.code_id → SET NULL
DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c FROM pg_constraint con
  WHERE con.conrelid = 'v2_payment'::regclass AND con.contype = 'f'
    AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'v2_payment'::regclass AND attname = 'code_id')];
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE v2_payment DROP CONSTRAINT %I', c); END IF;
END $$;
--> statement-breakpoint
ALTER TABLE v2_payment
  ADD CONSTRAINT v2_payment_code_id_fkey
  FOREIGN KEY (code_id) REFERENCES discount_code (id) ON DELETE SET NULL;
