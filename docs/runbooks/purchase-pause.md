# Runbook — หยุดรับเงินใหม่ชั่วคราว (purchase pause) โดยไม่ปิดทั้งเว็บ

**ใช้เมื่อ:** gateway เริ่มแปลก (webhook ไม่มา, settle ค้าง, refund พัง) แล้วต้องหยุดเลือดก่อนตัดสินใจ rollback ·
หรือระหว่างหน้าต่าง redeploy ตอน flip `PAYMENT_GATEWAY` (ดู `gateway-rollback.md`)

**ไม่ใช้ `MAINTENANCE_MODE`** — นั่นปิดทั้งเว็บ ส่วนนี้ปิดแค่ประตูเงิน · owner เคาะ 2026-09-13 (CIEL
`mootech-fe-beam-gateway-001` D3): ใช้ของที่มีอยู่ ไม่สร้าง flag ใหม่ จนกว่าการซ้อม rollback จะพิสูจน์ว่าคลิกเยอะเกินไป

## กลไก

`payment_package.is_active = false` ทำให้ `lib/payment/catalog.ts` ตอบ `UnsellablePackageError('not on sale')`
→ `/api/v2/payment/preview` ตอบ 400 `package is not available` → **ไม่มี charge ถูกสร้าง, ไม่มี discount hold, ไม่มี row**
(`charge-flow.ts` price ก่อนทุกอย่าง) · หน้าจอ `PackageCard` ซ่อนปุ่มซื้อเองจาก `is_active` เดียวกัน
· มีผล**ทันที** ไม่ต้อง deploy · ไม่กระทบ row ที่ PENDING อยู่แล้ว (webhook/reconciler ยัง settle ต่อได้)

## ขั้นตอน (คนที่มี `OPS_DASHBOARD_KEY`)

1. เปิด `/ops/packages` · login ด้วย ops key
2. ปิด `is_active` ของ **ทุก** package ที่ขายอยู่ — ตรวจรายการจริงจาก DB ก่อนทุกครั้ง (อย่าเชื่อรายการในไฟล์นี้):
   ```sql
   select package_code, tier_code, amount, is_active from payment_package where is_active order by tier_code, package_code;
   ```
   ณ 2026-09-13 คือ 4 tier package (`features/v2-shop/packages.ts`) + QI packs (`lib/payment/catalog.ts:19-54`, migration `0016`/`0017`)
3. ยืนยันจากนอก: `POST /api/v2/payment/preview` ด้วย package ใดก็ได้ต้องได้ 400 `package is not available`
4. บันทึกเวลา + เหตุผลลง `ops_audit_log` (ระบบเขียนให้เองทุก mutation) และแจ้งทีมใน Discord

## เปิดคืน

สลับ `is_active` กลับตามรายการที่จดไว้ในข้อ 2 · ตรวจ `preview` ตอบ 200 · ดู row PENDING ที่เกิดระหว่างปิด (ควรเป็น 0)

## ข้อจำกัดที่รู้

- หลายคลิก (≥ 5) — ถ้าตอนซ้อม rollback (slice 5) พบว่าเสี่ยงพลาด ให้เปิดใบเพิ่มปุ่ม "pause all" ที่จำสถานะเดิม (~40 บรรทัด)
- ไม่หยุด reconciler/webhook — **ถูกต้องแล้ว**: เงินที่จ่ายไปแล้วต้องได้ของ · ถ้าต้องหยุด settle ด้วย ใช้ `RECONCILE_ENABLED=off` (ต้อง redeploy) และรู้ว่าลูกค้าที่จ่ายจะรอ
- `/ops` ต้องมี `OPS_DASHBOARD_KEY` ตั้งอยู่ ไม่งั้นประตูปิดตาย (fail-closed) — เช็กก่อนวัน flip
