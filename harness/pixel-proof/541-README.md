# 541 — ดวงสมพงษ์ compatibility screens, Eye Truth frames

ถ่ายตอนปิด `mojisejr/mootech-fe#541` ข้อ ③ หลัง `#540` ย้ายเลนมาที่ FE

## สภาพที่ถ่าย ผูกกับผลทุกเฟรม

```
mootech-fe     41e5b08 (main หลัง #540)
เซิร์ฟเวอร์      next dev พอร์ต 3210    ❌ ไม่ใช่ production build (ดู mojisejr/mootech-fe#542)
BAZI_BASE_URL  https://bazi-sft-dataset.vercel.app  (main ของ bazi ไม่มี route นี้ ดู mojisejr/mootech-fe#544)
วิวพอร์ต        393 x 900 dpr 2        context ใหม่ทุกจอ ❌ ไม่ nav ในแอป
แถวข้อมูล       เขียนโดย POST /api/v2/matching/calculate ของจริง ❌ ไม่ใช่แถวที่ seed มือ
fixture        ลบครบหลังถ่าย ยืนยัน 0 แถวทั้ง 5 ตาราง
```

## แขนที่ถ่าย

```
B1-no-memberid-recent      ไม่มีคุกกี้ cookie-mumate-id → จอพูดว่า ยังไม่มีประวัติ และไม่ยิง API เลย
B2-with-memberid-recent    เพิ่มคุกกี้ตัวเดียว ทุกอย่างอื่นเหมือนกัน → API 200 คืน 2 แถว จอขึ้นครบ
                           ⇒ คู่นี้คือ positive control ของ mojisejr/mootech-fe#257

C-healthy-love             จอเลือกโปรไฟล์ ปุ่ม ดูผลลัพธ์เลย ป้าย เหลือ N ครั้ง
C-healthy-recent           ประวัติขึ้นครบ 2 รายการ กดเข้าได้
C-healthy-result           รายงานเต็ม A 82% 5 มิติ ตารางเสา รายคน

D-no-v2access-*            ถอนคุกกี้ v2_access → ทั้งสามจอยังตอบ 200 แต่เป็นหน้า passkey ของทีม
                           ⇒ negative control ที่พิสูจน์ว่าอ่านรหัสตอบกลับอย่างเดียวจะรายงานผ่านผิด

E-quota-1-ready            เลือกครบ ก่อนกด (โควตาเต็ม 100 แถว)
E-quota-2-after-press      กดแล้ว API 410 reason quota
                           🔴 ปุ่มขึ้น รออีก 56 วินาที เหนือข้อความ ใช้สิทธิ์ครบแล้วสำหรับปีนี้
                           ⇒ mojisejr/mootech-fe#545

F-system-1-ready           เลือกครบ ก่อนกด (BAZI_BASE_URL ชี้พอร์ตตาย)
F-system-2-after-press     กดแล้ว API 503 reason system → จอขึ้น ระบบขัดข้องชั่วคราว คนละชุดกับ E
```

## ที่ไม่ได้ถ่าย ❌ ห้ามอ่านว่าครอบแล้ว

```
· ความกว้างอื่นนอกจาก 393
· tier PLUS กับ PRO ถ่าย free อย่างเดียว
· production build ทุกเฟรมเป็น dev
· เครื่องจริง ไม่มีเลย
```

## ถ่ายใหม่ยังไง

`harness/541-capture-screens.mjs` `harness/541-control-memberid.mjs` `harness/541-love-arms.mjs`
ทั้งสามตัวรับค่าผ่าน env ⇒ `SESSION` `MEMBER_UID` `MID` `TAG` วิธี seed กับวิธีเอา session อยู่ใน
`mojisejr/mootech-fe#541` คอมเมนต์ของ bongbing
