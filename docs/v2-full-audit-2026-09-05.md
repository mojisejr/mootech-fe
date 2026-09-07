# v2 Full Audit — Figma × แอปจริง × Function (2026-09-05)

> ขอบเขต: 11 หน้าตามลิสต์ผู้ใช้ (แท็บ Pages ใน Figma `Mumate app_ final`) — Service, Calendar,
> Payment, Couple, Coworker, profile, Mumate AI, ดวงวัน, เสี่ยงเซียนเสี่ยงทาย, เสี่ยงไพ่ออราเคิลเคี้ยงคุง,
> เสี่ยงไพ่จิตวิญญาณแดนสวรรค์.
> วิธี: เดินแอปจริง `bazichart.mumate.co/v2` (login แล้ว) + อ่านโค้ด `mootech-fe` branch
> `feat/figma-parity-profile-qi` + ต่อยอดจาก `docs/figma-parity-audit.md` (audit profile+QI 42 เฟรม, 2026-09-04).

---

## 0. เรื่องต้องรู้ก่อน (สำคัญกว่าที่คิด)

1. **โค้ดหน้า `/v2` ไม่ได้อยู่ใน repo `bazi-sft-dataset`** (repo ที่เปิดคุยตอนแรก) — อยู่คนละ repo คือ
   **`mootech-fe`** (`github.com/mojisejr/mootech-fe`, branch `feat/figma-parity-profile-qi`). repo แรกเป็น
   **backend + engine + tooling**. เพราะฉะนั้น "แก้ใน dev" ของงานนี้ = แก้ที่ `mootech-fe`.
2. **แอป v2 = frontend อย่างเดียว** ยิง API หลายเส้นไปหา backend (engine ปาจื่อ/ดวง) ที่อยู่ repo อื่น
   (`pdf-dev`). ฟีเจอร์โหราศาสตร์จริง (ออราเคิล/จิตวิญญาณ/เสี่ยงทาย/ดวงวัน/แผนที่ศักดิ์สิทธิ์)
   **มี backend ทำงานได้แล้ว** แต่ frontend v2 ยังไม่ได้ต่อ.
3. Figma MCP list page ได้แค่ "Cover" — ต้องยิง node-id ตรง ๆ. node-id ของแต่ละหน้าเก็บไว้ที่
   `docs/figma-map.md` (บางหน้า) — หน้าโหมดเซียนยังไม่มี node-id ในแมพ ต้อง seed เพิ่มตอนลงมือ.

---

## 1. บทสรุปผู้บริหาร (อ่านอันเดียวพอ)

| กลุ่ม | จำนวน | สถานะ |
|---|---|---|
| ✅ Build + Function ทำงาน (verify แล้ว) | 6 | หน้าหลัก · Service hub · Couple · Coworker · Calendar · Mumate AI · Shop/Payment |
| 🟡 Build แล้วแต่ parity ยังค้าง | 1 คลัสเตอร์ | profile + QI (มี audit 42 เฟรม, กำลังไล่แก้ในbranch นี้) |
| 🔴 ยังไม่ build (เป็น "เร็วๆ นี้") ทั้งที่ backend มี | 7 | ออราเคิล · จิตวิญญาณ · เสี่ยงทาย · หนังสือเล่มเดียว · ซินแส · มานิเฟส · แผนที่ศักดิ์สิทธิ์ |
| ❓ ในลิสต์ Figma แต่ไม่มี route แยก | 1 | **ดวงวัน** — ถูกรวมไว้ในการ์ด day-detail ของ Calendar (ต้องเคาะว่าตรงกับหน้า Figma "ดวงวัน" ไหม) |

**ข้อสรุป 1 บรรทัด:** ฝั่ง "บริการหลัก" (สมพงศ์ · ปฏิทิน · แชท · ร้านค้า) **ทำงานครบและตรงโครง Figma**;
ช่องว่างใหญ่ที่สุดคือ **โหมดเซียนทั้งชุดยังเป็น placeholder "เร็วๆ นี้"** แม้ backend พร้อมแล้ว —
นี่คือ "ขาดตกบกพร่อง" ที่ผู้ใช้เห็นชัดที่สุด (การ์ดบนหน้าหลัก/บริการกดแล้วตัน).

---

## 2. ตารางสถานะรายหน้า

Function: 🟢 ทำงาน · 🟡 บางส่วน · 🔴 ตัน/ไม่มี
Parity (เทียบ Figma): M=ตรง · C=ต่างผิว · S=ต่างโครง · —=ยังไม่เทียบละเอียด

| # | หน้า (Figma) | Route จริง | Func | Parity | สรุปช่องว่าง |
|---|---|---|---|---|---|
| 1 | หน้าหลัก (Home) | `/v2` | 🟢 | C | เนื้อหาครบ 7 โซน; commit ล่าสุดทำ daily-fortune parity ไปแล้ว |
| 2 | **Service** | `/v2/service` | 🟢 | C | catalog 13 การ์ด ครบ; การ์ด 7/13 กดแล้วไป "เร็วๆ นี้" |
| 3 | **Couple** (คู่รัก) | `/v2/service/compatibility/love` | 🟢 | M/C | flow สมพงศ์จริง (เลือก 1 คู่, quota) โครงตรง navy/24px |
| 4 | **Coworker** (เพื่อนร่วมงาน) | `/v2/service/compatibility/colleague` | 🟢 | M/C | เหมือน couple แต่ 3 ช่อง (จัดอันดับ) |
| 5 | **Calendar** (ปฏิทิน) | `/v2/calendar` · `/calendar/[date]` · `/notifications` | 🟢 | C | กริดเดือนมีเสาจีน+คะแนน+today+legend; การ์ดดวงวันด้านล่าง |
| 6 | **Payment** | `/v2/shop` · `/checkout` · `/qrcode` · `/result` (+`api/v2/payment/*`) | 🟢 | — | หน้าแพ็กเกจ Free/Plus + toggle รายเดือน/รายปี; PromptPay flow มีโค้ด |
| 7 | **profile** | `/v2/account` (+`settings/*`, `qi/*`, `orders/*`) | 🟡 | S | dashboard ใหม่ลงแล้ว (เช็คอิน 7 วัน/เพื่อน 5 ธาตุ/tier) แต่ยังขาด QI card/ธาตุ/ภารกิจ/ฟีดตาม Figma — ดู `figma-parity-audit.md` |
| 8 | **Mumate AI** (chat) | `/v2/chat` | 🟢 | C | Mate AI: มาสคอต+ทักทาย+ชิปแนะนำ+ไมค์+composer+disclaimer |
| 9 | **ดวงวัน** | — (ฝังใน Calendar day-detail) | 🟡 | ? | ไม่มี route/การ์ดแยกใน 13 catalog; ต้องเทียบหน้า Figma "ดวงวัน" ว่าตั้งใจให้เป็นจอเดี่ยวไหม |
| 10 | **เสี่ยงเซียนเสี่ยงทาย** | → `/v2/service/coming-soon` | 🔴 | — | **backend มี** (`fortune-sage/predict`) แต่ FE ตัน |
| 11 | **เสี่ยงไพ่ออราเคิลเคี้ยงคุง** | → `/v2/service/coming-soon` | 🔴 | — | **backend มี** (`oracle-cards/predict`+images) แต่ FE ตัน |
| 12 | **เสี่ยงไพ่จิตวิญญาณแดนสวรรค์** | → `/v2/service/coming-soon` | 🔴 | — | **backend มี** (`divine-cards/predict`+images) แต่ FE ตัน |

(บริการอื่นใน catalog ที่ก็ยังเป็น "เร็วๆ นี้": หนังสือเล่มเดียวในโลก · ซินแส · มานิเฟส · แผนที่ศักดิ์สิทธิ์
— แผนที่ศักดิ์สิทธิ์และมานิเฟสมี backend/ฟีเจอร์ในระบบเดิมแล้วเช่นกัน.)

---

## 3. รายละเอียด + หลักฐาน (รายหน้า)

### ✅ ทำงานดี (ยืนยันด้วยการเดินจริง)
- **หน้าหลัก `/v2`** — 7 โซน: header(ทักทาย/ธาตุ/อัพเกรด/แจ้งเตือน/avatar) · การ์ดดวงวันนี้ (เกรด B- 58% +
  เหมาะ/ควรเลี่ยง + เปิดปฏิทินของฉัน) · แบนเนอร์มานิเฟส · ดวงสมพงค์(คู่รัก/เพื่อนร่วมงาน) · โหมดเซียน(3 การ์ด+
  หนังสือเล่มเดียว) · ดูดวงกับซินแส · เรียน Bazi 499. ไม่มี stub.
- **Service `/v2/service`** — การ์ด 13 รายการ (couple/coworker/one-book/oracle/spirit/sian/sinsae/manifest/
  calendar/sacred-map/shop + 2 ซ่อน). โครงตรง Figma 333:7519.
- **Couple / Coworker** — เข้า flow `CompatibilityScreen` จริง: การ์ดโปรไฟล์เรา + ช่องเลือกคู่ (1 / 3) +
  quota "เหลือ 2 ครั้ง" + ปุ่ม disabled จนเลือกครบ + "ดูดวงสมพงศ์ล่าสุด". navy + 24px ตาม kit.
- **Calendar** — กริดเดือน แต่ละวันมีเสาจีน (戊寅/己卯…) + %คะแนน + สีตามเกรด (≥60/40-59/<40) + วันนี้ไฮไลต์ +
  legend + การ์ดสรุปดวงวัน (เกรดวงกลม + ข้อความ). โหลดผ่าน skeleton → เต็ม. ตรง spec Calendar (grade card/ยามมงคล).
- **Mumate AI `/v2/chat`** — "Mate AI · พร้อมคุย" + มาสคอต + บับเบิลทักทาย + ชิป(ดวงวันนี้/สมพงศ์/เลขนำโชค) +
  ไมค์ STT + composer + disclaimer. (Figma node 55271-8612)
- **Shop/Payment `/v2/shop`** — "เลือกแพ็คเกจที่ใช่" + toggle รายเดือน/รายปี(คุ้มกว่า 2 เดือน) + Mumate Free(฿0,
  รายการสิทธิ์) + Mumate + (badge คุ้มค่าที่สุด). มี `checkout`/`qrcode`/`result` + `api/v2/payment/{charge,
  promptpay,status,webhook,preview}`.

### 🟡 profile + QI (`/v2/account` + settings/qi/orders)
- หน้า account ปัจจุบัน = **dashboard ใหม่แล้ว** (ไม่ใช่เมนู 10 แถว emoji เวอร์ชันเก่า): เช็คอินต่อเนื่อง 0/7 วัน +
  strip วัน + ปุ่ม "เช็คอินวันนี้ รับ +5 QI" + "ครบ 7 วันรับโบนัส +30 QI" · เพื่อน 0 คน (ครบ 5 ธาตุ 1,000 QI) ·
  Mumate Free + อัปเกรด · avatar initial "ผ".
- **ยังค้างตาม `figma-parity-audit.md`** (42 เฟรม, ส่วนใหญ่ verdict S/P1): QI wallet card, ระบบธาตุเต็ม,
  ภารกิจ/ฟีด, my-plan upsell, orders/receipt breakdown, settings (หมวด about/version/ลบถาวร), consent 5-switch,
  data-export ทางอีเมล, delete 4 ขั้น + export step, missions/history จัดกลุ่ม, referral hub, empty/error states.
  → คลัสเตอร์นี้ "กำลังทำ" อยู่แล้วใน branch นี้ (commit ล่าสุด: consent/email/province/streak-restore,
  notifications 6-group, element card, QI coin).

### 🔴 โหมดเซียน = "เร็วๆ นี้" ทั้งชุด (ช่องว่างเด่นสุด)
- กดการ์ด (หน้าหลัก zone โหมดเซียน / หน้า Service) → `/v2/service/coming-soon?service=...` →
  หน้า placeholder "เร็วๆ นี้ · <ชื่อบริการ> · บริการนี้ยังไม่เปิดให้ใช้งาน...".
- โยงจาก `features/v2-service/services.ts`: `oracle-kiang`, `spirit-heaven`, `sian`, `one-book`, `sinsae`,
  `manifest`, `sacred-map` = `comingSoonHref(...)`.
- **แต่ backend พร้อม**: `oracle-cards/predict` (+images), `divine-cards/predict` (+images),
  `fortune-sage/predict`, และฟีเจอร์ sacred-map/manifest มีในระบบเดิม. งานที่เหลือคือ **build จอ FE ตาม Figma
  + ต่อ API** (งานใหญ่ต่อหน้า — เข้า backlog ตามที่ตกลง).

### ❓ ดวงวัน
- ในแอปจริงไม่มีจอ/การ์ด "ดวงวัน" แยก — เนื้อหา "ดวงประจำวัน" ปรากฏใน (ก) การ์ดดวงวันนี้บนหน้าหลัก และ
  (ข) การ์ดสรุปใต้ปฏิทิน (`/v2/calendar/[date]` / `api/v2/day-detail`).
- ต้องเทียบกับหน้า Figma "ดวงวัน" ว่าตั้งใจให้เป็น **จอเดี่ยว** (แบบ man-vs-day: ดวงเรา × เสาวัน) หรือแค่การ์ด.
  ถ้าเป็นจอเดี่ยว = ช่องว่าง (ไม่มี route). — ต้องเคาะกับทีม/ดู Figma frame ก่อนตัดสิน.

---

## 4. จุดเล็กที่แก้ได้ (safe) — ข้อเสนอ

> โค้ดสะอาด ไม่มี TODO/FIXME ค้าง และช่องว่างส่วนใหญ่เป็น "โครงสร้าง/ฟีเจอร์" ไม่ใช่บั๊กผิว
> รายการด้านล่างเป็นของที่ "เล็กและปลอดภัยพอจะแก้ได้" — รอเคาะก่อนบางข้อเพราะแตะ product decision
>
> **⚠️ ข้อค้นพบสำคัญ:** โค้ด v2 มีวินัยสูงมาก และ "จุดต่างผิว" ที่เห็นหลายอันเป็น **การตัดสินใจที่ตั้งใจไว้
> (เจ้าของ = ฟีม) พร้อมคอมเมนต์กำกับเหตุผล** ไม่ใช่ความผิดพลาด เช่น:
> `DailyFortuneCard.tsx` จงใจ **ไม่** ทำการ์ดดวงวันนี้บนหน้าหลักให้ตรง Figma (ระบุชัดว่าเป็นคำถามของฟีม
> ห้ามแก้เองใน PR ที่ไม่เกี่ยว) · การสะกด "ซินแส" (#7) จงใจต่าง Figma ตามคำสั่งฟีม · ชื่อไฟล์ ปฎิทิน จงใจ.
> ⇒ **ไม่มี "จุดเล็ก" ที่ควรลงมือแก้เองฝ่ายเดียวโดยไม่ถามเจ้าของ** ในรอบนี้ — รายการ S1–S3 จึงเป็น
> *ข้อเสนอให้เคาะ* ไม่ใช่สิ่งที่ผมแก้ไปแล้ว. (แก้ได้ทันทีเมื่อคุณ/ฟีมชี้ว่าอันไหนเอา)

| ลำดับ | จุด | ประเภท | ความเสี่ยง | หมายเหตุ |
|---|---|---|---|---|
| S1 | ดวงวัน: ถ้าเป็นแค่การ์ด → เพิ่ม anchor/ลิงก์จากหน้าหลักการ์ดดวงวันนี้ ไป `/v2/calendar/[today]` ให้กดดูรายละเอียดได้ | UX เล็ก | ต่ำ | ต้องเช็กว่าปัจจุบันกดได้ไหม |
| S2 | โหมดเซียนที่มี backend: เปลี่ยน copy "เร็วๆ นี้" ให้ตรงจริง หรือใส่ ETA (ถ้าทีมอยากคงตันไว้) | copy | ต่ำ | ต้องถามทีมว่าจะคงหรือ build |
| S3 | ยืนยันหน่วยเงิน "QI" สม่ำเสมอทุกจอ (audit ข้อ global #1) | copy global | กลาง | recent commit "unify coins→qi" ทำไปแล้วบางส่วน — ควรกวาดซ้ำ |

*(ตัวที่แตะ backend/flag เช่น รางวัล referral, ราคาแก้วันเกิด, export ทางอีเมล — อยู่ใน `figma-parity-audit.md`
§ "ตัดสินใจก่อน" ไม่รวมในรอบ "แก้เล็ก" นี้.)*

---

## 5. ลำดับความสำคัญที่แนะนำ (ถัดไป)

1. **ปิดคลัสเตอร์ profile+QI** ให้ครบตาม `figma-parity-audit.md` (กำลังทำอยู่แล้ว — จบก้อนนี้ก่อน).
2. **ตัดสินใจโหมดเซียน**: build จริง (มี backend แล้ว, คุ้มสุดเริ่มที่ ออราเคิล/จิตวิญญาณ/เสี่ยงทาย เพราะ engine
   พร้อม) หรือคงเป็น "เร็วๆ นี้" อย่างเป็นทางการ. ถ้า build → เรียงตามคุณค่า/ความพร้อม asset.
3. **เคาะ "ดวงวัน"**: จอเดี่ยวหรือการ์ด — แล้วอุด route ถ้าจำเป็น.
4. Parity รอบเก็บผิว (radius 24px, navy button, banner tone) ให้ครบทั้งแอปหลัง 1-2 เสร็จ.

---

## 6. เทียบ Figma รายส่วนแบบละเอียด (ยกเว้น 3 โหมดเซียน) — เพิ่ม 2026-09-05

> ดึงเฟรม Figma จริง (node ที่โค้ดอ้างอิงเอง) มาวางเทียบภาพต่อภาพกับแอปจริง.
> V = M ตรง · C ต่างผิว/คำ · S ต่างโครง · 🔴 พัง.

### 🔴 ดวงฉัน `/v2/destiny` (Figma 55349-3070) — **พบบั๊ก crash + แก้แล้ว**
- **อาการ:** เปิดหน้าแล้ว **จอว่าง** (error-boundary) — **React error #31** (render object เป็น child) ใน `<ul><li>`.
- **ต้นตอ:** `element-summary` ของ engine คืน `advice` เป็น **array ของ object** `{key,label,text}` แต่โค้ด type
  ไว้เป็น `string[]` แล้ว render `<li key={t}>{t}</li>` → โยน object ตรง ๆ ⇒ crash ทั้งหน้า. (`traits` เป็น string ปกติ)
- **แก้แล้ว** (`features/v2-destiny/components/DestinyScreen.tsx`): เพิ่ม type `AdviceItem = string | {key,label,text}`
  + render เป็น `label: text` (รองรับทั้ง string และ object). `npx tsc --noEmit` ผ่านสะอาด.
  → **รอ deploy เพื่อยืนยันบนโปรดักชัน** (โครงหน้าใหญ่มาก 393×3834: hero/คะแนนธาตุ/ตารางดวงจีน 8 ช่อง/ธาตุ 5 ตัว/
  ทำนายพื้นฐาน/อาชีพเด่น/สิ่งศักดิ์สิทธิ์/Life Path/ดูดวงเพิ่มเติม — parity รายชิ้นต้องตรวจซ้ำหลังหน้ากลับมา render).

### ตารางเทียบรายส่วน

| ส่วน | Figma node | V | จุดต่างที่เจอจริง |
|---|---|---|---|
| **หน้าหลัก** | 333-6545 | **C** | (1) โซนโหมดเซียน 3 การ์ด: Figma = **ไอคอนภาพประกอบ(มาสคอต)** · live = **ไอคอนแบน**(หัวใจ/กระเป๋า) · (2) โซนเรียน: live "เรียนอ่านดวง / เรียน Bazi ออนไลน์ / **499** บาท" · Figma "เรียนปาจื่อ / เรียนปาจื่อออนไลน์ / **265** บาท" |
| **Service hub** | 333-7519 | **M** | ตรงมาก (11 การ์ดเรียงตรง, ภาพประกอบครบ, desc ตรง). ต่างเดียว: Healing Circles Figma มี(การ์ดที่ 12) · live ซ่อน (ยังไม่มีไฟล์ภาพ — ตั้งใจ) |
| **Couple** | 480-4549 | **C** | (1) แถวเลือก: Figma "เลือกเพื่อน / คู่รัก" + **มี chevron dropdown** · live "เลือกคู่รัก" ไม่มี chevron · (2) live เพิ่ม "เหลือ 2 ครั้ง" (quota) ที่ Figma ไม่มี — น่าจะตั้งใจ |
| **Coworker** | 720-27747 | **M/C** | ใช้คอมโพเนนต์เดียวกับ couple, 3 ช่องตาม Figma. โครงตรง (จุดต่างเดียวกับ couple) |
| **Calendar** | 368-9750 | **M** | ตรงมาก: grid+เสาจีน+%+สีเกรด, today ไฮไลต์ navy, วันพระวงม่วง, legend, การ์ดดวงวัน(ring lime + ganzhi chip + วันพระ + 2 คอลัมน์ + ปุ่ม "ดูรายละเอียดวันนี้"). *ควร verify ปุ่ม CTA + ganzhi chip ปรากฏใน live* |
| **Payment/Shop** | 636-11973 | **C** | Figma 3 tier: **Free ฿0 / Plus ฿790 / Pro ฿1,590** + toggle + promo banner(คอร์สฟรี ฿499, คูปอง Life Code Book ฿500). live เห็น Free+Plus ชัด. *ควร verify live มี Pro tier + promo banners ครบ*; คำ feature Free ต่างเล็กน้อย |
| **Mumate AI (chat)** | 55271-8612 | **C** | โครงตรง แต่ **copy ต่างชัด**: greeting persona (Figma "มูมเทะไอ...ค่ะ" · live "มิวมาแล้วจ้า...ค่า") · ลิงก์บน (Figma "ดูบทสนทนาย้อนหลัง" · live "ดูสิ่งที่มิวน้อยทำได้") · ชิป (Figma ความรัก/เสนอมงคล · live ความสมพงศ์/เลขนำโชค). **โค้ดระบุว่า copy live ไม่พบใน Figma รอ designer ยืนยัน** (known) |
| **ดวงฉัน (destiny)** | 55349-3070 | 🔴→แก้ | ดูด้านบน — crash แล้วแก้; parity รายชิ้นตรวจซ้ำหลัง deploy |
| **profile + QI** | 55399:* | S | มี audit แยก 42 เฟรมใน `figma-parity-audit.md` (ส่วนใหญ่ S/P1 กำลังไล่แก้ในbranch นี้) |

### สรุปคำตอบ "ครบดีตรงหรือยัง" (ยกเว้น 3 โหมดเซียน)
- **ตรงดี (M):** Service hub · Calendar — โครง+เนื้อหา+ภาพตรง Figma
- **ตรงโครง ต่างผิว/คำ (C) — แก้เก็บได้เร็ว:** หน้าหลัก(ไอคอนโหมดเซียน+copy โซนเรียน) · Couple/Coworker(chevron) · Shop(verify Pro/promo) · Chat(copy รอ designer)
- **มีปัญหา (แก้แล้ว):** ดวงฉัน/destiny — crash React #31 → แก้ในโค้ดแล้ว รอ deploy
- **ยังเป็นงานโครงสร้าง (S):** profile+QI (มี audit + แผนแยก)

---

## ภาคผนวก — Figma node-ids ที่รู้แล้ว (จาก `docs/figma-map.md` + audit)
- File: `g2tyfcBQNU7CNlHBxQr3PL` (Mumate app V3 / _final) · page `- profile` = `55151:1995`
- Service `333-7244` · Calendar `333-4409` · Payment `375-20340` · Couple(legacy) `480-4548` · Welcome `298-475`
- Mumate AI chat frame `55271-8612` · profile+QI 42 เฟรม `55399:*` (ดู `figma-parity-audit.md`)
- **ยังไม่มี node-id ในแมพ**: หน้าโหมดเซียน (ออราเคิล/จิตวิญญาณ/เสี่ยงทาย/ดวงวัน) — ต้อง seed เพิ่มตอน build
