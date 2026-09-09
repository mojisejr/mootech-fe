-- 0020 — QI packs reprice + re-quantity (ตารางราคาพี่พล 2026-09): ราคา 35/99/249/499.
-- จำนวน QI ใหม่ 90/300/900/2,100 + โบนัส 0/45/260/816 อยู่ใน lib/payment/catalog.ts (QI_PACK_QTY/BONUS)
-- เครดิตจริงตอน grant — ไม่ใช่คอลัมน์ DB. package_code คงเดิม (QI_60/200/500/1200) ไม่ให้ charge เก่ากำพร้า.
-- ADDITIVE/idempotent — รันซ้ำได้. อัปเดต description ให้ตรงจำนวนใหม่ทุกแพ็ก.
UPDATE payment_package SET amount = 35::double precision,  description = 'แพ็ก 90 QI'                 WHERE package_code = 'QI_60';
--> statement-breakpoint
UPDATE payment_package SET amount = 99::double precision,  description = 'แพ็ก 300 QI + โบนัส 45'     WHERE package_code = 'QI_200';
--> statement-breakpoint
UPDATE payment_package SET amount = 249::double precision, description = 'แพ็ก 900 QI + โบนัส 260'    WHERE package_code = 'QI_500';
--> statement-breakpoint
UPDATE payment_package SET amount = 499::double precision, description = 'แพ็ก 2,100 QI + โบนัส 816'  WHERE package_code = 'QI_1200';
