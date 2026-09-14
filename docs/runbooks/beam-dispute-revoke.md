# Runbook — chargeback / dispute บน Beam: ถอนสิทธิ์ด้วยมือ

**ทำไมต้องมี:** Beam **ไม่มี webhook หรือ API สำหรับ dispute/chargeback** (มีแค่ `TransactionType: CHARGEBACK` ใน ledger)
→ เงินถูกดึงคืนโดยที่ระบบเราไม่รู้ · สิ่งที่ระบบรู้เองมีแค่ `refund.succeeded` (revoke อัตโนมัติผ่าน `revokeByChargeId`)

## เมื่อเห็น chargeback ใน Lighthouse (Transactions → type CHARGEBACK)
1. จด `chargeId` (`ch_…`) และ `referenceId` (= `order_id` ของเรา)
2. หาแถว: `select id, user_id, package_code, tier_code, status, failure_code, gateway from v2_payment where charge_id = '<ch_…>' or order_id = '<referenceId>';`
3. ถอนสิทธิ์ด้วยเส้นทางเดียวกับ refund เต็มจำนวน — **อย่า** UPDATE ตารางเอง:
   - ทางที่ปลอดภัยสุด: ยิง webhook `refund.succeeded` จำลอง**เข้า prod ไม่ได้** (ต้องมี HMAC key จริง) → ใช้ script ฝั่ง server แทน:
     ```
     # บนเครื่องที่มี DATABASE_URL prod (owner เท่านั้น) — เรียก revokeByChargeId เต็มจำนวน
     npx tsx --env-file=.env.prod.local -e "import('./lib/payment/repo').then(m => m.revokeByChargeId('<ch_…>', { refundedSatang: <amount_satang ของแถว> }).then(console.log))"
     ```
     ผลที่ต้องเห็น: `revoked: true`, `failure_code = 'gateway_reversed'`, `member_subscription` ของแถวไม่ ACTIVE · QI pack: แถวถูก mark แต่ชี่ไม่ถูกดึงคืน (ตามนโยบายเดิม #484 slice 6)
   - ถ้า `shadowHandled === 'NEEDS_HUMAN'` → `member_payment` ต้องแก้มือ ตาม log ที่ฟังก์ชันพิมพ์
4. บันทึกใน `ops_audit_log` / CIEL closeout: chargeId, order, เวลา, ใครทำ, ผล
5. ถ้ามีมากกว่า 1–2 ครั้ง/เดือน → เปิดใบเพิ่มปุ่ม "revoke" ใน `/ops` (ยังไม่มีในตอนนี้ — ดู #605 G4 เรื่องสิทธิ์ของ `/ops` ก่อน)

## สิ่งที่ห้ามทำ
- ห้าม `DELETE` แถว `v2_payment` หรือ `member_subscription` — ประวัติไม่ถูกเขียนทับ (rollback contract ของ lane)
- ห้าม revoke บนแถวที่ `status <> 'APPROVED'` — ฟังก์ชันปฏิเสธเองอยู่แล้ว อย่าไป bypass
