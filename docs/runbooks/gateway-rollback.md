# Runbook — สลับ / ถอย payment gateway (`PAYMENT_GATEWAY`)

**สถานะ 2026-09-13:** Omise = live และพิสูจน์แล้ว (owner) · Beam = กำลังต่อ (CIEL `mootech-fe-beam-gateway-001`) ·
ตัวเลือก: `lib/payment/select-gateway.ts` อ่าน `PAYMENT_GATEWAY` ต่อ request — `unset`/`omise` = พฤติกรรมเดิมเป๊ะ,
`beam` = Beam adapter, ค่าอื่น = **throw ตอน charge แรก** (ตั้งใจ: ไม่ยอมโอนเงินผ่าน provider ที่ไม่มีใครเลือก)

## ก่อน flip ไป Beam (ทำครั้งเดียว)
- migration `lib/db/0027_v2_payment_gateway.sql` ต้องอยู่บน prod แล้ว (owner apply มือ) — ตรวจ: `select column_name from information_schema.columns where table_name='v2_payment' and column_name='gateway'`
- webhook Beam ลงทะเบียนใน Lighthouse (production) ชี้ `https://bazichart.mumate.co/api/v2/payment/webhook-beam` events `charge.succeeded, charge.failed, refund.succeeded, refund.failed, payment_link.paid` · HMAC key อยู่ใน env `BEAM_WEBHOOK_HMAC_KEY`
- `BEAM_MERCHANT_ID`, `BEAM_API_KEY`, `BEAM_API_BASE=https://api.beamcheckout.com` อยู่ใน Vercel Production scope
- **ห้ามลบ** `OMISE_*` ใดๆ — route `/api/v2/payment/webhook` ของ Omise ยังรับ event ของ row เก่าต่อไป

## Flip (owner)
1. `purchase-pause.md` → ปิดขายชั่วคราว (หน้าต่าง ~3 นาที)
2. Vercel → Production env → `PAYMENT_GATEWAY=beam` → Redeploy
3. ยืนยัน: `POST /api/v2/payment/promptpay` ด้วยบัญชีทดสอบ → row ใหม่มี `gateway='beam'`, `charge_id` ขึ้นต้น `ch_`
4. เปิดขายคืน · เฝ้า log `[v2/payment/webhook-beam]` 30 นาที

## Rollback ไป Omise (ทุกเวลา)
1. ปิดขายชั่วคราว (`purchase-pause.md`)
2. Vercel → `PAYMENT_GATEWAY=omise` (หรือลบตัวแปร) → Redeploy
3. เปิดขายคืน
4. **row ของ Beam ที่ค้าง PENDING ยังปลอดภัย**: reconciler ถาม provider ตามคอลัมน์ `gateway` ของแต่ละ row (`pages/api/cron/reconcile-payment.ts`) และ route `webhook-beam` ยังเปิดรับ event → settle/revoke ของ Beam row ทำงานต่อแม้ deploy ปัจจุบันขายผ่าน Omise
5. เขียน CIEL closeout: เวลา, เหตุผล, row ที่ค้าง, สิ่งที่ยังไม่รู้

## สิ่งที่ห้ามทำ
- ห้ามลบ route webhook ของ provider ที่เพิ่งถอยออก จนกว่าจะไม่มี row `PENDING`/`APPROVED` อายุ < 180 วัน (refund window) ของ provider นั้น
- ห้าม flip วันเดียวกับการย้าย host (#637 P3) — เปลี่ยนทีละตัวแปร
