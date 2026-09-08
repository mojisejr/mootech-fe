-- 0018 — เปิดขาย "Mumate Pro รายเดือน" (V2_PRO_MONTHLY): ฿199/เดือน, on sale.
-- ADDITIVE data change (UPDATE เท่านั้น ไม่มี schema change / ไม่มี DROP). แถวถูกสร้างไว้แล้วโดย 0009
-- (is_active=false, amount=0). เปิดขายจริง = flip is_active + ตั้งราคา — period '1M' มีอยู่แล้ว ⇒ ซื้อแล้ว
-- ได้ subscription 1 เดือน (start_at=วันนี้, expire_at=+1 เดือน) ผ่าน provision.ts อัตโนมัติ.
-- 🔴 เกี่ยวกับเงินจริง → operator (ฟีม) เป็นคน apply บน prod. (V2_PLUS_MONTHLY ยังปิดไว้เหมือนเดิม)
UPDATE payment_package
   SET amount = 199, is_active = true
 WHERE package_code = 'V2_PRO_MONTHLY';
