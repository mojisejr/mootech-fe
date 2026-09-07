# Figma parity audit (design-context) — 2026-09-07

> ต่างจาก `figma-parity-audit.md` (2026-09-04) ที่เทียบจาก screenshot: รอบนี้ดึง `get_design_context` + `get_variable_defs`
> ผ่าน Figma MCP (account mootech co · file `g2tyfcBQNU7CNlHBxQr3PL`) แล้วเทียบตัวเลข/สี/copy กับโค้ดจริง
> Verdict: **M** ตรง · **C** ต่างผิว · **S** ต่างโครง
>
> ⚠️ ข้อจำกัด: (1) `get_metadata` บนเฟรมใหญ่ในไฟล์นี้คืนแค่ตัวเฟรม ห้ามใช้เป็นหลักฐานว่า "ว่าง"
> (2) เฟรม Home `333-6545` ที่ agent ดึงอาจเป็นเวอร์ชันเก่ากว่าที่ prod ใช้ (prod มีโหมดเซียน/หนังสือแล้ว) — ตรวจกับทีมดีไซน์ว่าเฟรม Home ตัวจริงคือ `55399:5163`
> (3) Chat `55271-8612` และ Couple's `480-4548` ดึงจาก agent ไม่ได้ (MCP "nothing selected") — Couple's ดึงแยกแล้วใน §Batch 1C ด้านล่าง

## 0. Design tokens (get_variable_defs: 333-6545 + 55399:4904 + 776:8693)

| Token (Figma) | ค่า | ใน `tailwind.config.ts`? |
|---|---|---|
| Primary/Sapphire | `#1455A4` | ✅ `v3-sapphire` |
| Primary/Lime Yellow | `#E1FF00` | ✅ `v3-lime` |
| Primary/Pacific Cyan | `#1B9AAF` | ✅ `v3-cyan` |
| Primary/Pumpkin Spice | `#FF6800` | ✅ `v3-pumpkin` |
| Text/Oxford Navy | `#0B305B` | ✅ `v3-navy` |
| Text/Secondary | `#464646` | ✅ `v3-text-body` |
| Text/Title Color | `#1F2937` | ✅ `v3-text-price` |
| Pastel/Ghost White | `#ECF0FD` | ✅ `v3-ghost-white` |
| Pastel/Lemon Chiffon | `#F9F4F0` | ✅ `v3-lemon-chiffon` |
| Grade bg 70-79 | `#F0F8F0` | ✅ `v3-grade-b-bg` |
| **text/muted** | `#8C8C8C` | ❌ (`v3-text-muted` = `#71717A`) |
| **border/default** | `#E6E1DD` | ❌ (ใกล้สุด `v3-border-warm` `#E0DEDB`) |
| **bg/subtle** (profile ground) | `#F6ECF0` | ❌ hardcode ใน AccountScreen/ConsentScreen |
| **brand/bg** | `#EAF3FF` | ❌ hardcode |
| **qi/earn-bg** / **qi/earn-text** | `#E3F8D1` / `#63B05F` | ❌ hardcode ×5 |
| **qi/spend-text** | `#E08586` | ❌ |
| danger/text | `#A83238` | ❌ |
| สีธาตุ/<ธาตุ>/ตัวอักษร | ไม้ `#2E7D32` · ไฟ `#E53935` · ดิน `#8D6E63` · ทอง `#818181` · น้ำ `#1B9AAF` | ✅ ใช้ใน `features/v2-service/chart-table.ts` (2026-09-07) |
| สีธาตุ/<ธาตุ>/พื้นหลัง | `#E8F5E9` · `#FCE4EC` · `#F9F4F0` · `#EEEEEE` · `#ECF0FD` | ✅ เดียวกัน |
| Fonts | IBM Plex Sans Thai ทุกระดับ (9–32px) | `font-ibm` มี แต่ใส่ที่ root ไม่กี่จอ |

## Batch 1 — flow ดวงสมพงศ์ (section 720-25501 + Couple's 480-4548) — ทำเองด้วย design context

| เฟรม | จอ | สถานะ 2026-09-07 |
|---|---|---|
| 720:25502 / 27747 / 27969 ฟอร์มเพื่อนร่วมงาน | CompatibilityScreen | แก้แล้ว: profile-row h74 (ตัวเรา #ECF0FD pl12 pr24 · คนอื่น #F9F4F0 pl10 pr16 · ว่าง #F9F4F0 + chevron), avatar ตัวย่อ #DAE2FF/#3758F9, ปุ่มหลัก #1455A4 + ตัว #E1FF00 bold (disabled #DDD) · ชิปบทบาทเป็นของเพิ่มตามสไลด์ 9 (ไม่มีใน Figma) |
| 720:25691 ชีทเพิ่มเพื่อน | AddFriendSheet | **ยังไม่แก้** — Figma: handle 44×5 #E5E3E0 · title 20 bold · ฟิลด์ pill r100 h52 border #E5E7EB · แถว วว/ดด/ปปปป dropdown · "จำไม่ได้" checkbox 24 · กล่อง "ปลอดภัย 100%" (glass, border #E9EAEB, r16, p24) · แถวอัพโหลดรูป #ECF0FD r24 · ปุ่ม บันทึก (disabled #DDD) · "หรือเชื่อมต่อบัญชี" + 3 opt (Facebook #1A78F2 / Invite #1B9AAF / Contacts #8C6BD9, h64 r24) |
| 720:29221 / 32490 / 26015 ผลเพื่อนร่วมงาน | WorkResultScreen | แก้แล้ว (เขียนใหม่ทั้งจอ): hero #1455A4 r22 + แถวอันดับในการ์ด (พื้น TIER_SOFT, avatar 40 + badge 22, วันเกิด, bar h10, badge เกรด w48) · toggle แอดวานซ์ (#ECF0FD r50 p16) = โชว์ตารางดวงจีน · Pill Tabs (#ECF0FD p8 r50, active #1455A4/#E1FF00) · การ์ดคนที่เปิด (ชิปธาตุ+วันเกิด) · คำอ่าน = facets ของบทบาท หัว การงาน/ธุรกิจ/การเงิน + ไอคอน 56 #EAF0FA (asset จาก Figma) · ปุ่มลอย บันทึก PDF (#1B9AAF, เร็ว ๆ นี้) / แชร์ (#1455A4, Web Share) |
| 758:3239 / 758:2527 / 776:9730 ตารางดวงจีน | ChartTableCard | แก้แล้ว: การ์ด #ECF0FD/#F9F4F0 p16 r14 · 5 คอลัมน์ py7 r10 · glyph 16 สีธาตุ · ปุ่ม #D4DDFC + border #1455A4 medium 14 · วัยจร/ปีจร bg #294F74 r24 cell 80×130 |
| 636:18819 ผลคู่รัก | CompatibilityResultScreen ฯลฯ | ดู §1C ด้านล่าง — **ยังไม่แก้** |

### 1C ผลคู่รัก 636:18819 — delta

| element | Figma | โค้ด | V |
|---|---|---|---|
| hero | การ์ด #1455A4 r22 px16 pt34 pb24 gap28 · donut 90px (track/progress, ตัว lime) · headline + สรุป · profile-row ×2 (avatar 64 ring #E1FF00, ชื่อ, วันเกิด) คั่นด้วย HeartConnector (p12 r100, หัวใจ 20) · มาสคอต 2 ตัว + sprite ธาตุ | CompatResultHero (mascot cards) | ต้องเทียบต่อ |
| toggle แอดวานซ์ + Pill Tabs | #ECF0FD r50 p16 · tabs ภาพรวม / ความเข้ากัน / ทำนายพื้นฐาน (active #1455A4 / #E1FF00 16 bold) | CompatResultTabs (4 แท็บ ภาพรวม/รายมิติ/ตารางดวงจีน/รายคน, สไตล์ต่าง) ไม่มี toggle | S |
| ความเข้ากัน 5 ด้าน | การ์ด r16 py24 px16 gap24 เงา(10,48,92,.06) · header 18 bold + ⓘ 19 · แถว: ไอคอน 56 #EAF0FA r10 + label 16 #464646 + Tag (⭐ จุดแข็ง #2E7D32 / ⚠️ ต้องดูแล #B71C1C, 14) + bar h10 #EAECEF fill สีเกรด + % 14 + badge w48 · กล่องเหตุผลพื้นตามเกรด (px12 py10 r16, 14) | CompatDimensionCard | ต้องเทียบต่อ |
| คำทำนายพื้นฐาน | การ์ด r20 py24 px16 gap16 เงา(26,38,77,.12) · pc ตัวเรา #ECF0FD px16 py18 r20 (avatar 40 ring lime, ชื่อ 15, วันเกิด 14, มาสคอต 51×70) + เส้นคั่น + เนื้อ 14 + "อ่านเพิ่ม" #1B9AAF 14 + ลูกศร · pc เขา #F9F4F0 + ชิปธาตุ + 3 ย่อหน้า 13 | CompatPersonDetail (bullet nisai) | S |
| ตารางดวงจีน | เหมือน 776:9730 (ปฏิกิริยาธาตุ chips 56 r16 glyph 24 + ChartTableCard ×2) | ทำแล้ว (ChartTableCard) · หัว section "ตารางดวงจีน" 18 bold + chevron | M/C |
| ปุ่มลอย | บันทึก PDF / แชร์ + Mate AI (เหมือน work) | ไม่มี | S |

## Batch 2 — audit โดย agent (design context) — ยังไม่แก้

### Home — 333-6545 → `features/v2-home/components/V2HomeScreen.tsx`
| Element | Figma | Code | V |
|---|---|---|---|
| Type ramp | IBM Plex Sans Thai 14/16/20/24 | `font-ibm` ใส่แค่ 2 จุด ที่เหลือ inherit default | S |
| Compat card CTAs | ชิป "ดวงคู่รัก" + "ดูดวงเพื่อนร่วมงาน" + ปุ่ม "ดู" | มีแค่ "ดูบริการทั้งหมด" | S |
| Oracle/เสี่ยงไพ่ block | มี 3 การ์ด | (agent บอกไม่มี — แต่ prod มี: ต้องเช็คว่าเฟรมเก่า) | ? |
| หนังสือเล่มเดียวในโลก + ซื้อเลย | มี | (prod มี — เช็คเฟรม) | ? |
| Pajeu card copy | "เรียนปาจื่อ … 265 บาท" | "เรียนอ่านดวง … 499 บาท" (ฟีมสไลด์ 2 = 499 ⇒ โค้ดถูก เฟรมเก่า) | — |
| Radii / pastel tiles | 16/24/100 · `#E0FFC4 #C1E6F8 #ECD9FB #FBD9E7 #91D8D2 #F1FF75` | ตรง | M |

### Service hub — 333-7519 → `ServiceHubScreen.tsx` / `ServiceCard.tsx`
| Element | Figma | Code | V |
|---|---|---|---|
| การ์ด 12 ใบ r24 p24 gap8 · title 18 bold · desc 14 medium · CTA "ดูดวงเลย" cyan | ตรง | M |
| Healing Circles | มี | ซ่อน (ไม่มี art) — ยอมรับแล้ว | S (known) |

### Calendar month — 368-9750 → `pages/v2/calendar.tsx`, `MonthGrid.tsx`
| Element | Figma | Code | V |
|---|---|---|---|
| สีช่องวัน | **10 ขั้นตามเกรด** (`#F1F8E8/#8BC34A`, `#F0F8F0/#66BB6A`, `#EDF7ED/#43A047`, `#F9FBE7/#CDDC39`, `#FFF3E0`, `#FFF0E1/#F57C00`, `#FFEBEE`, `#FCE4EC/#B71C1C`) | 3 ระดับ (`#E2F4F6/#0B7A8C`, `#FEF1E0/#B47E35`, `#FEE7E4/#CD3D2E`) | **S** |
| geometry ช่องวัน r11 py4 gap2 · 13 bold / ganzhi 8 / % 12 | ตรง | M |
| legend r5 9px · วันพระ ring #9D85DA | ตรง | M |
| Date selector r14 | r15 | C |

### Calendar day detail — 375-11286 → `pages/v2/calendar/[date].tsx` + `day-detail/*`
| Element | Figma | Code | V |
|---|---|---|---|
| ขนาดตัวอักษร | 16 เป็นหลัก · หัว section 18 | ใช้ text-sm/xs (14/12) เกือบทั้งจอ | C→S |
| 8 ประตู tile | `#EAF0FA` + สถานะ `#FDECE9`/`#F1EFFA` | `#F5F7FB`, `#FEF1E0` | C |

### Calendar notifications sheet — 636-10221 → `SaveSheet.tsx`, `pages/v2/calendar/notifications.tsx`
| Element | Figma | Code | V |
|---|---|---|---|
| header | teal #1B9AAF เต็มกว้าง · title 24 bold ขาว · close chip #1190A5 40 r44 | ครีม/lemon ไม่มี teal, ไม่มี close chip | **S** |
| sheet | #F9F4F0 r-t28 pt32 pb120 gap18 | การ์ด r20 บน lemon | C |
| status card | navy #0B305B เงา 0/8/20 · "ตั้งแจ้งเตือนแล้ว · 2 ยาม" + "เพิ่มลง Google ปฏิทิน เรียบร้อย" | ไม่มีบรรทัด Google | **S** |
| push-preview mock (Mumate "M" chip, ⏰ ยามมงคลเริ่มแล้ว) | มี | ไม่มี | **S** |
| Google Calendar event preview + chip "📅 Google ปฏิทิน · จาก Mumate" | มี | ไม่มี | **S** |

### Checkout — 402-21464 → `features/v2-shop/*`
สรุปการ์ด/ฟิลด์/CTA/Secured-by ตรง (M) · method picker: Figma Credit · Bank Transfer · Cash App / โค้ด Credit · PromptPay · Bank Transfer (ตั้งใจ localize) C

### Profile / QI — 55399:4904 → `AccountScreen.tsx`
| Element | Figma | Code | V |
|---|---|---|---|
| ground #F6ECF0, ธาตุ card, balance hero, streak 7 ช่อง, earn cards | ตรง | M |
| แถวเพื่อน | **avatar stack 4 วง 34px + badge 3/5 + "เพื่อนของคุณ 8 คน / เก็บครบ 5 ธาตุรับ 1,000 QI · ยังขาดไฟและทอง"** | แถวข้อความอย่างเดียว | **S** |
| row Mumate Pro | #F7F0FC · "เดือนนี้จ่ายค่า QI ไป ฿318 / Pro ฿199 ใช้ไม่จำกัด ประหยัด ฿119" + badge แนะนำ | ไม่มีบรรทัดประหยัด | **S** |

### Settings — 55399:5049 → `pages/v2/settings/index.tsx`
ครบทุกหมวด/แถว · ต่างผิว: list r18 + border #E6E1DD (โค้ด #E9EAEB) · muted #8C8C8C (โค้ด #71717A) — C

### ยังไม่ audit
Chat 55271-8612 · Payment page 375-20340 · 634-8194 · profile ย่อย 55399:5303 / 6809 / 6923 / 7106 / 7219 · โหมดเซียน 3 จอ · my-destiny 626-2004

## ลำดับแก้ที่แนะนำ (S ก่อน ตามที่ผู้ใช้เห็นบ่อย)
1. ปฏิทินเดือน: สเกลสี 10 ขั้นตามเกรด
2. ฟอนต์ IBM Plex Sans Thai ที่ root ทุกจอ v2
3. ชีทแจ้งเตือน: teal header + close chip + status card Google + push-preview + event preview
4. ผลคู่รัก 1C (hero donut/heart, tabs 3 แท็บ + toggle, การ์ด 5 ด้าน มี tag+กล่องเหตุผล, คำทำนายพื้นฐาน + อ่านเพิ่ม, ปุ่ม PDF/แชร์)
5. Account: avatar stack เพื่อน + badge 3/5 · แถว Pro ประหยัด ฿
6. AddFriendSheet ตาม 720:25691
7. Day detail ขนาดตัวอักษร 16/18
8. tokens ที่ hardcode → tailwind (`#8C8C8C #E6E1DD #F6ECF0 #EAF3FF #E3F8D1 #63B05F #E08586 #A83238`)
