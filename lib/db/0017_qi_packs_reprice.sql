-- 0017 — QI packs reprice + เพิ่มแพ็ก QI_60 (Figma buy-qi): ราคา 35/99/219/449.
-- ผู้ใช้อนุมัติ 2026-09-04 (แทนราคาชั่วคราว 59/129/299 ของ 0016). ADDITIVE/idempotent — รันซ้ำได้.
-- โบนัสรายแพ็ก (+20/+75/+250) อยู่ใน lib/payment/catalog.ts (QI_PACK_BONUS) เครดิตตอน grant, ไม่ใช่คอลัมน์ DB.
UPDATE payment_package SET amount = 99::double precision,  description = 'แพ็ก 200 QI + โบนัส 20'   WHERE package_code = 'QI_200';
--> statement-breakpoint
UPDATE payment_package SET amount = 219::double precision, description = 'แพ็ก 500 QI + โบนัส 75'   WHERE package_code = 'QI_500';
--> statement-breakpoint
UPDATE payment_package SET amount = 449::double precision, description = 'แพ็ก 1,200 QI + โบนัส 250' WHERE package_code = 'QI_1200';
--> statement-breakpoint
INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
SELECT 'MEMBER', 'QI_60', 'แพ็ก 60 QI', 0::bigint, 35::double precision, '1Y', 1::bigint, 'QI', true
 WHERE NOT EXISTS (SELECT 1 FROM payment_package p WHERE p.package_code = 'QI_60');
