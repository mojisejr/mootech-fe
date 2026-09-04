# Figma ↔ Code Parity Audit — Profile + Qi (Mumate)

> อ่านจริงจาก Figma ผ่าน **Figma MCP** (บัญชี `mootech co`) เมื่อ 2026-09-04
> ไฟล์ต้นทาง: `Mumate app_ final` key `g2tyfcBQNU7CNlHBxQr3PL` · หน้า **"- profile"** = node `55151:1995`
> ตรวจ 42 เฟรม (ข้าม `Home` = นอกขอบเขต, `Backup` = archive) เทียบกับ `features/v2-*`
> วิธี: get_screenshot ทุกเฟรม → เทียบโครง/โทเคน/ไอคอน/คำ กับคอมโพเนนต์ที่แมปไว้

## บทสรุปผู้บริหาร (อ่านอันเดียวพอ)

**~40 จาก 42 เฟรมต่างระดับ "โครงสร้าง" (STRUCTURAL) ไม่ใช่แค่ดีเทล.** โค้ดที่ทำไว้เป็น
ดีไซน์รุ่นก่อนหน้า/เรียบกว่า current Figma มาก — Figma ถูกทีมพัฒนาต่อหลังรอบ reskin ที่ระบุใน
build-plan. งานนี้จึงเป็น **"สร้างตามดีไซน์ใหม่เกือบทั้งชุด"** ไม่ใช่ขัดเงา.

### จุดต่างระดับ "ทั้งแอป" (global — แก้ทีเดียวกระทบทุกจอ)
1. **คำเรียกสกุลเงิน:** Figma ใช้ **"QI"** ทุกที่ · โค้ดใช้ **"ชี่" / "เหรียญ"** ปนกัน → ต้องรวมเป็นหนึ่ง
2. **ไอคอน:** Figma ใช้ icon tile/ภาพประกอบจริง · โค้ดใช้ **emoji** (🎯📋🤝🎁🔮✏️…) แทบทุกจอ
3. **ปุ่มหลัก:** Figma ใช้ **navy/sapphire** (`#0B305B`/`#1455A4`) · โค้ดใช้ **cyan** (`#1B9AAF`) เกือบหมด
4. **มุมการ์ด:** โค้ดหลายจอใช้ `rounded-[20px]` · Figma/kit = **`24px`**
5. **โทนแบนเนอร์สถานะ:** Figma มี banner **เขียว/ชมพู** (quota, streak-break, ธาตุ) ที่ kit ยังไม่มี
6. **ระบบ "ธาตุ" (element):** Figma ผูกทั้งแอปกับธาตุผู้ใช้ (ธาตุไม้/ทอง/ไฟ/ดิน/น้ำ + มาสคอต) · โค้ดยังไม่มี

### จุดต่างระดับ "ข้อมูล/ตรรกะ" (ไม่ใช่แค่ภาพ — อาจแตะ backend/flag)
- 🔴 **รางวัลชวนเพื่อนผิด:** โค้ด = **250/100 เหรียญ** · Figma = **50 QI (ผู้ชวน) / 30 QI (เพื่อน)** — ผิดทั้งเลขและหน่วย
- 🔴 **เงื่อนไขจ่ายรางวัล referral:** โค้ด "เมื่อเพื่อนสมัครผ่านโค้ด" · Figma "เมื่อเพื่อนกรอกวันเกิด+เช็คอินครั้งแรก"
- 🔴 **ราคาแก้วันเกิด:** โค้ด default `100` · Figma `150` (data-driven — ต้องเคาะเลขจริงที่ engine/flag)
- 🔴 **ส่งออกข้อมูล:** โค้ด = ดาวน์โหลด JSON ทันทีฝั่ง client · Figma = **ส่งไฟล์ไปอีเมล (async ภายใน 30 วัน, JSON+CSV)**
- 🟠 **deep-link คำเชิญ:** โค้ด `/invite/<code>` · Figma `mumate.co/i/<code>` (สั้น) — ต้องเลือกมาตรฐานเดียว

### ประเด็นเชิง "โครงสร้างผลิตภัณฑ์" ที่ต้องตัดสินใจ (โค้ดอาจตั้งใจทำต่าง)
- **`/v2/qi` : hub vs guide** — Figma เฟรม `qi-guide` เป็น **คู่มือ** (อ่านอย่างเดียว + ตารางเทียบราคา) แต่โค้ดทำเป็น
  **hub โต้ตอบ** (wallet+XP+ปุ่ม earn/spend สด). ต้องเลือก: แทนที่ด้วย guide, หรือเก็บ hub ไว้แล้วเพิ่ม guide แยกหน้า
- **`/v2/account` : เมนู vs แดชบอร์ด** — โค้ดเป็นหน้าเมนู 10 แถว(emoji) แต่ Figma เป็นแดชบอร์ดรวม
  (ธาตุ/การ์ด QI/เช็คอิน/ภารกิจ/เพื่อน/ฟีด). เมนู 10 แถวเป็นของที่โค้ด "คิดเพิ่ม" ไม่มีใน Figma
- **`/v2/settings`** — Figma เป็นลิสต์เรียบไม่มีไอคอน + section เกี่ยวกับ(ข้อกำหนด/ลิขสิทธิ์/เวอร์ชัน) ที่โค้ดไม่มี;
  โค้ดใส่การ์ดโปรไฟล์ด้านบน + emoji tiles ที่ Figma ไม่มี

---

## ตารางพาริตี้รายเฟรม (42)

Verdict: **S** = Structural · **C** = Cosmetic · **M** = Match | Priority P1(โครงสร้าง/สำคัญ) P2(ภาพเห็นชัด) P3(polish)

| # | เฟรม (node) | หน้า/ไฟล์ | V | P | จุดต่างหลัก |
|---|---|---|---|---|---|
| 1 | profile-and-qi-wallet (55399:4904) | /v2/account · AccountScreen | S | P1 | Figma แดชบอร์ดรวม(ธาตุ/QI card/เช็คอิน/ภารกิจ/เพื่อน/ฟีด) · โค้ดเป็นเมนู 10 แถว emoji |
| 2 | settings — UX v2 (55399:5049) | /v2/settings | S | P1 | ลิสต์เรียบ 6 หมวด+version+ลบถาวร · โค้ดใส่การ์ดโปรไฟล์+emoji tiles, ขาดหมวด QI/เกี่ยวกับ |
| 3 | Home (55399:5163) | — | — | — | นอกขอบเขต profile+qi (ยืนยันกับทีม) |
| 4 | buy-qi select pack (55399:5303) | /v2/qi/buy · QiBuyScreen | S | P1 | Figma radio 4 แพ็ก+bonus/savings+สรุปยอด+VAT+CTA · โค้ด 3 การ์ดลิงก์ไป checkout |
| 5 | buy-qi success (55399:5425) | v2-shop/ResultScreen | S | P1 | Figma balance-delta card + ใบเสร็จเต็ม · โค้ด tick+pill เดียว |
| 6 | check-in states (55399:5465) | /v2/qi/checkin · QiCheckinScreen | S | P2 | Figma การ์ดเดียวจบ+CTA เต็ม · โค้ดแยก hero+strip+ปุ่มจิ๋ว; โทน strip ต่าง |
| 7 | check-in states (55399:5535) | QiCheckinScreen | S | P1 | Figma 5 สถานะ(รวม streak-break+กู้คืน20QI, new-user) · โค้ดมีแค่ ready/done |
| 8 | check-in reward (55399:5704) | QiCheckinScreen | S | P1 | Figma toast +5 + celebration sheet +30 · โค้ดไม่มีทั้งคู่ |
| 9 | share-code (55399:5762) | /v2/qi/referral · ReferralHubScreen | S | P1 | Figma reward-split card+4 ช่องแชร์ · โค้ด 2 ปุ่ม; **รางวัลผิด 250/100 เหรียญ vs 50/30 QI** |
| 10 | share-code LINE preview (55399:5804) | ReferralHubScreen | C | P2 | Figma OG card mock · โค้ด bubble ข้อความล้วน; deep-link /i/ vs /invite/ |
| 11 | invite-landing (55399:5838) | /invite/[code] | S | P1 | Figma logo+hero+value-prop 3 ข้อ+LINE CTA+code chip · โค้ดจิ๋ว; **30 QI vs 100 เหรียญ** |
| 12 | account-login connected (55399:5885) | /v2/settings/connected · ConnectedScreen | S | P1 | Figma current+backup login list(+10 QI/วิธี) · โค้ดขาด backup list, ใส่ @name แทน |
| 13 | edit-birth-data (55399:5934) | /v2/settings/edit-birth · EditBirthScreen | S | P1 | Figma banner เขียว+dropdown ไทย+**จังหวัดเกิด**+disabled-until-dirty · โค้ด native input, ไม่มีจังหวัด |
| 14 | edit-birth quota used (55399:5976) | EditBirthScreen | S | P1 | Figma banner ชมพู+ฟิลด์ล็อก+ปลดล็อก150QI+balance preview · โค้ดฟิลด์ยังแก้ได้, price 100 |
| 15 | edit-birth correction sheet (55399:6015) | EditBirthScreen | S | P1 | Figma flow ผ่าน LINE(3 ขั้น) · โค้ด textarea ในแอป → POST |
| 16 | edit-personal-info (55399:6052) | /v2/settings/edit-profile · EditProfileScreen | S | P1 | Figma avatar+ชื่อที่แสดง(แก้ได้)+เพศ dropdown+อีเมล+การ์ดวันเกิดล็อก · โค้ดต่าง data model |
| 17 | my-plan (55399:6096) | /v2/account/plan · PlanScreen | S | P1 | Figma quota badges+upsell ฿318+ตัวเลือกแพ็ก(฿790/฿1,590) · โค้ดลิสต์ ✓ ธรรมดา |
| 18 | settings-notifications (55399:6173) | NotificationsScreen | S | P1 | Figma master+5 หมวด~12 toggle+ช่องทาง Push/LINE/Email · โค้ด 3 toggle+permission card |
| 19 | privacy-consent (55399:6275) | ConsentScreen | S | P1 | Figma 5 switch ราย purpose+note ชมพู+ประวัติ · โค้ดการ์ด PDPA ใบเดียว+ปุ่ม |
| 20 | privacy-data-export (55399:6335) | DataExportScreen | S | P1 | Figma **ส่งอีเมล async**(JSON+CSV,30 วัน)+info card+status · โค้ดดาวน์โหลด JSON ทันที |
| 21 | help-faq (55399:6380) | FaqScreen | S | P1 | Figma ค้นหา+จัดหมวด+CTA LINE · โค้ด accordion แบนจาก API |
| 22 | document-reader (55399:6439) | DocReaderScreen | S | P1 | Figma meta+TOC+ปุ่มล่าง(ยินยอม/แชร์) · โค้ดการ์ดบทความล้วน |
| 23 | account-deletion index (55399:6482) | /v2/settings/delete-account | S | P1 | Figma รวม 4 สถานะ+ขั้น **ส่งออกข้อมูลก่อนลบ** · โค้ดขาด export step |
| 24 | delete-01 what-you-lose (55399:6544) | delete-account | S | P1 | Figma ตาราง key→value ส่วนตัว(590 QI≈฿259,48 ดวง,8 เพื่อน)+note คืนเงิน · โค้ด `<ul>` generic |
| 25 | delete-02 alternatives (55399:6584) | delete-account | S | P1 | Figma 4 ทางเลือก+badge ตรงเหตุผล · โค้ดมี 2 แถว(แจ้งเตือน/FAQ) |
| 26 | delete-04 pending-recovery (55399:6629) | delete-account | S | P1 | Figma วงกลมนับถอยหลัง 29+การ์ด restore-preview · โค้ดการ์ดขาว+ปุ่ม cyan |
| 27 | delete-05b feedback (55399:6664) | delete-account | S | P1 | Figma เต็มจอ+checklist เหตุผล+textarea · โค้ด sheet textarea ล้วน |
| 28 | settings-language-sheet (55399:6705) | settings/index | C | P2 | Figma 2 ภาษา+✓+handle+note · โค้ด 3 ภาษา(+中文 เร็วๆนี้) pill |
| 29 | settings-text-size-sheet (55399:6722) | settings/index | S | P1 | Figma preview card+ลิสต์ขนาดจริง+✓ · โค้ด grid 4 ช่องขนาดเท่ากัน |
| 30 | settings-logout-dialog (55399:6746) | settings/index | S | P1 | Figma modal กลาง+body(590 QI ยังอยู่)+ปุ่มคู่ · โค้ด bottom sheet+ปุ่มซ้อน |
| 31 | settings sheets & dialogs (55399:6761) | settings/index | S | P1 | เฟรมรวมของ 28–30 |
| 32 | qi-history all (55399:6809) | /v2/qi/history · QiHistoryScreen | S | P1 | Figma month picker+สรุป 3 ค่า+tabs+จัดกลุ่มวัน+icon+เวลา+ยอดคงเหลือ · โค้ดลิสต์แบน |
| 33 | missions all (55399:6923) | /v2/qi/missions · MissionsScreen | S | P1 | Figma hero+countdown+3 กลุ่ม+ปุ่ม "ทำเลย"+เป้า 5 ธาตุ+1000QI · โค้ดการ์ดแบน ไม่มีปุ่ม |
| 34 | referral hub (55399:7106) | /v2/qi/referral · ReferralHubScreen | S | P1 | Figma hero+4 ช่องแชร์+3 สถิติ+การ์ด 5 ธาตุ+รายชื่อเพื่อน · โค้ดใส่ steps emoji+apply-code |
| 35 | qi-guide UX v2 (55399:7219) | /v2/qi · QiScreen | S | P1 | **Figma=คู่มือ · โค้ด=hub โต้ตอบ** (ตัดสินใจ hub/guide); โค้ด emoji tiles |
| 36 | spend-confirm-sheet (55399:7397) | QiSpendSheets | S | P2 | Figma handle+icon+breakdown 3 แถว+navy · โค้ด X-close+summary บรรทัดเดียว+cyan |
| 37 | insufficient-qi-sheet (55399:7424) | QiSpendSheets | S | P1 | Figma badge ขาด+3 คำแนะนำมีจำนวน · โค้ดข้อความ generic+2 ปุ่ม |
| 38 | empty-states all (55399:7462) | ProfileGate (+ราย screen) | S | P1 | Figma 4 empty(history/referral/bookmark/filter) · โค้ด ProfileGate คืน null |
| 39 | loading & error (55399:7506) | ProfileGate (+payment flow) | S | P1/P2 | Figma 5 สถานะ(processing/connecting/pay-fail/net-lost/server-err) · โค้ด skeleton+การ์ด fail เดียว |
| 40 | profile day-one 0 QI (55399:7563) | /v2/account · AccountScreen | S | P1 | Figma day-one gamified(ธาตุ/สะสมเพื่อน 0/5/empty ฟีด) · โค้ดแค่สลับ label เดียว |
| 41 | order-history (55399:7675) | /v2/orders · OrdersScreen | S | P1 | Figma summary+จัดกลุ่มเดือน+วิธีจ่าย+refund state · โค้ดลิสต์แบน |
| 42 | order-receipt (55399:7734) | /v2/orders/[id] · OrderReceiptScreen | S | P1 | Figma ฿ hero+breakdown(VAT/โบนัส/provider)+2 ปุ่ม · โค้ดแถวธรรมดา+ปุ่ม back |
| 43 | edit-birth quota states (55399:7784) | EditBirthScreen | S | P1 | เฟรมรวม 3 สถานะของ 13/14/15 |

*(รายละเอียดเต็มรายเฟรม: ดูไฟล์ working `audit-results-{A,B,C,D}-*.md` ใน scratchpad — ย้ายเข้ามาได้ถ้าต้องการ)*

---

## ลำดับการแก้ที่แนะนำ

### Layer 0 — ตัดสินใจก่อน (ต้องได้คำตอบก่อนลงมือ)
1. **คำเรียกสกุลเงิน:** เปลี่ยน "ชี่/เหรียญ" → **"QI"** ทั้งแอปไหม? (กระทบ copy หลายสิบจุด + เทสต์)
2. **รายการที่แตะ backend/flag** (รางวัล referral 50/30 QI, เงื่อนไขจ่าย, ราคาแก้วันเกิด 150, export ทางอีเมล) —
   FE ทำตาม Figma ได้เลย หรือรอ engine/ทีมยืนยันตัวเลข/กลไกก่อน?
3. **hub vs guide** ที่ `/v2/qi` และ **เมนู vs แดชบอร์ด** ที่ `/v2/account` — เก็บของเดิม, แทนที่, หรือทำทั้งสอง?
4. **ไอคอน/ภาพประกอบ + ระบบธาตุ:** มีชุด asset จาก designer ไหม (มาสคอต 12 นักษัตร×5 ธาตุ มีในไฟล์แล้ว) หรือให้ export จาก Figma?

### Layer 1 — Foundation (global, เสี่ยงต่ำ, กระจายทุกจอ) — เริ่มได้ทันที
- `kit.tsx`: การ์ด radius → 24px, ปุ่มหลัก → navy, เพิ่ม banner tone เขียว/ชมพู, เพิ่ม IconTile รองรับไอคอนจริง
- สร้าง helper คำว่า "QI" + ระบบธาตุ (ถ้าตอบข้อ 1/4 แล้ว)

### Layer 2 — จอหลัก (ตามลำดับคุณค่า)
ก้อนชี่ (buy/checkin/missions/history/guide/sheets) → โปรไฟล์(hub/plan/orders/receipt) →
ตั้งค่า/ความเป็นส่วนตัว → ลบบัญชี → referral/invite → empty/error states

### Layer 3 — ยืนยันผล
ถ่ายรูป Figma vs หน้าจริง (dev) เทียบทีละเฟรม, อัปเดต Verdict เป็น M, รันเทสต์

---

## วิธีอ่านเฟรมจาก Figma (สำหรับรอบต่อ ๆ ไป)
- fileKey `g2tyfcBQNU7CNlHBxQr3PL` · page node `55151:1995`
- `get_screenshot(fileKey, nodeId, maxDimension=760)` → คืน URL → `curl` มาดู
- `get_metadata(fileKey, nodeId)` → subtree XML (โทเคน/ขนาด/ชื่อ layer)
- MCP page-list โชว์แค่ "Cover" — ต้องเข้าด้วย node-id ตรง ๆ (เฟรมอยู่บน main ไม่ใช่ branch)
