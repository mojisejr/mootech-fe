# ดวงฉัน — screen spec (Figma "Mumate app_ final", page "ดวงฉัน", frame node `55349-3070`)

Frame 393×8028, white bg, corner 40. Structure = **FIXED** (Frame 2147223879, pinned card) +
**SCROLLS** (Frame 2, 393×3833 content) + **BG01** background. Auto layout, gap 8, padding 12.
Read 2026-09-02 via browser at 33–101%. This is the **my-destiny premium hub** (reskin ของ /my-destiny).

## FIXED (แนบหัว — Frame 2147223879, W345 H70-Hug, x24 y749)
1. Header: ← · "ดวงของฉัน" · 🔔 · avatar
2. Blue card (sapphire): mascot art (ตัวละครประจำ + วงกลม avatar ผู้ใช้ซ้อน) + "คุณเรียกดูดวงเงิน"(=ชื่อ user) + subtitle "ครบทุกเรื่องที่ต้องรู้…จบในแพ็กเกจเดียว"
3. 3 แถบคะแนน (icon + name + progressbar + % + **grade badge A/B/C+** เขียว):
   - สายเลือกกรากิโว(?) ⓘ — 95% A (ชื่อยังอ่านไม่คลีย์ → ยืนยันตอน build; น่าจะชื่อเสา/คะแนนเด่น)
   - ตัวค้าน — 75% B
   - สายอิสพุ — 55% C+
4. ป้ายปักหมุด (345×70): "🪙 แชร์สะสมวันนี้ รับ **+10 QI**" + ปุ่ม Mate AI (เหลือง) — daily share CTA

## SCROLLS (Frame 2)
5. การ์ด "ดวงจะส่งผล 8 ด้าน" (chevron ยุบ/พับได้): ชิป 5 เสา (ปี/เดือน/วัน/เดือน/ปี + stem 甲戊庚戊甲 + branch) + ปุ่ม "โชว์จุดอ่อนของ 5 ด้าน ↓"
6. "ธาตุของคุณ": คำอธิบาย + 5 แถวธาตุ (มาสคอตเล็ก): ราตูี้(ไม้: ผลไม้/ไม้ผล/ป่าไม้) · ราทุจั่ง(ไฟ: เรืองแสง/ตะวัน) · ราชูเป้(ดิน: ภูเขา/ถ้ำ) · ราชิน(โลหะ: โลหะการ) · ราชัน้ำ(น้ำ: คุ้มน้ำ/ทะเลสาบ)
7. "ธาตุสมดุล" (chevron): การ์ดย่อย — ปุ่มชี่สมุน(ขาว) · ปี้ GI(ฟ้า) · ธาตุไม้โครงสร้าง · ธาตุไฟ (ชิปเขียว) · ธาตุดิน (ชมพู) · ธาตุโลหะผสม ⓘ (3 จุด เหลือง/เทา/ดำ)
8. "อนาคตของคุณ (Life Path)" ⓘ: ชิปปี 2xxx/3,246 + **line chart** (เส้นอนาคตรายปี) + caption อธิบาย
9. "จองไว้ล่วงหน้า": แถวรายการ 2 แถว (badge "30") = **ปลดล็อกเป็นข่วมด้วย 30 QI** ต่อบท
10. การ์ดชวนเพื่อน (highlight ฟ้า): "ชวนเพื่อนมารับวัน รับคนละ 50 QI · เพื่อนสมัครรับฟรีคุณ 30 QI ใช้ซื้ออะไรก็ได้" + chevron

## การจับคู่ API (bazi engine — พร้อมอยู่แล้วทั้งหมด)
| Section | engine endpoint |
|---|---|
| เสา 8 ด้าน/ชิป 5 เสา | `/api/bazi/calculate` → calculatedState.fourPillars |
| ธาตุของคุณ/ธาตุสมดุล | `/api/bazi/element-summary` |
| แถบคะแนน A/B/C+ | `/api/bazi/strength-score` + domainPower |
| Life Path chart | `/api/bazi/life-timeline` |
| จองไว้ล่วงหน้า 30 QI | `/api/qi/spend` (gate ต่อบท) |
| แชร์รับ +10 QI / ชวนเพื่อน +50 | `/api/qi/earn` + `/api/referral` |

## สถานะ
- ยังไม่ได้ build — เป็นงานหลัก Day 2 (route ใหม่ เช่น `/v2/destiny` แทน /my-destiny v1)
- สิ่งที่ต้องยืนยันตอน build: ชื่อ 3 แถบคะแนน (อ่านไม่คลีย์ที่ 77%), ข้อความในการ์ดย่อย ธาตุสมดุล, ตัวเลข/ปีบน Life Path

## ASSETS ที่ต้อง export จาก Figma (สำหรับ build นี้) — ✅ เสร็จแล้ว 2026-09-02

**แหล่งจริง = Google Drive "00_Mumate Character" ของ designer (baifern_itangle)** ไม่ใช่ Figma export
(Drive ส่งมาเป็นไฟล์ master คุณภาพสูงกว่า) ไฟล์ใน `public/images/v2/destiny/`:

| ไฟล์ | ที่มา | ขนาด | หมายเหตุ |
|---|---|---|---|
| el-wood/fire/earth/metal/water.png | Drive "ตัวละคร 5 ธาตุ" (wood/fire/earth/gold/water.png 1000px) ย่อเหลือ 256px | 256px พื้นโปร่ง | gold = ธาตุทอง/โลหะ → ตั้งชื่อ el-metal ตาม spec เดิม |
| mascot-card@2x.png | Figma export node "11_จอ-น้ำ 1" @2x (ใน promo-personal-calendar) | 370×512 | ตัวหมายธาตุไม้บนเกาะ — art การ์ดน้ำเงิน (ยังใช้ mascot จาก engine เป็นหลัก, ไฟล์นี้เป็น fallback) |
| ic-star.png | Drive icon/star.png | 135×136 | ดาวในป้าย "⭐อันดับ" ของแถวคะแนนแรก |
| vip-crown.png | Drive icon/premium.png | 500×500 | มงกุฎ VIP (ใช้ทำ VIP gate 🔒) |
| mate-ai@2x.png | Figma export instance "mascot" (Mate AI badge) @2x | 147×122 | มาสคอตนกฮูกปุ่ม Mate AI |
| bg-destiny.jpg / bg-clouds.jpg | Drive BG/IMG_4274 / IMG_4272 ย่อ 800px→JPEG | 800×1108 | ฉากหลังท้องฟ้า (4274=ฟ้าฟองอากาศ, 4272=เมฆม่วง); ชุดเต็ม 50 ไฟล์อยู่ Downloads/mumate-assets/bg |
| (staged) Card 58/59/60.jpg | Drive "Mascot Mumate" (การ์ดตัวละคร) | ~200KB JPEG | การ์ดตัวละครหมู/หมาย/ไก่ — รอใช้งานหน้า ร้านค้า/คอลเลกชัน |
| (staged) fire.png 3MB | Drive icon/Fire.png | เต็ม | เวอร์ชันความละเอียดสูง |

ยังขาดจาก design: glyph 💰 (สกิลเรียกทรัพย์) กับ 👥 (สกิลสัมพันธ์) ใน chip ขาว — ไม่มีใน Drive
icon folder และไม่พบเป็น text/asset ใน Figma → ใช้ emoji ต่อไปก่อน รอ designer

## COPY ที่ยืนยันแล้ว (จาก Find/zoom 2026-09-02)
- แถบคะแนน: **สกิลเรียกทรัพย์** (การเงิน, 95% A, ป้าย ⭐อันดับ) · **สกิลสัมพันธ์** (เพื่อน, 55% C+) ·
  แถวกลางอ่านไม่คลีย์ ("ตัวกิ๊บ"?) ใช้ป้าย engine ต่อ — รอ designer
- ป้ายแชร์: **"แชร์ดวงวันนี้ รับ +10 QI"** (เดิมโค้ดเขียน "แชร์สะสมวันนี้" — แก้แล้ว)
- คำอธิบายธาตุทอง (text layer จริง): "เป็นสายแฟร์สุด ๆ ชอบความยุติธรรม กล้าตัดสินใจ ซื่อสัตย์ตรงไปตรงมา
  มีเหตุผล ชอบให้ทุกอย่าง "ชัด" ไม่ชอบจุกจิก"
- คำอธิบายธาตุอื่น ๆ + ชื่อมาสคอตแถวธาตุ (ราตู้/ราถุง/ราฮุโพ/ราคติน/ราน้ำ) **ไม่มีเป็น text layer**
  (outline เวกเตอร์ทั้งชุด — ค้น "รา"/"ตู้"/"สัมพันธ์" All pages ทั้ง final+V3 ไม่เจอ) → ทางเดียวคือ
  designer ให้สตริง หรือใช้ data จาก engine ต่อไป

## โครงสร้างเฟรม (สรุปจาก layer tree 2026-09-02)
ดวงฉัน(55349-3070) → FIXED(Frame 2147223879 → F880: แชร์ผลดวงสมพงศ์+Navbar) · SCROLLS(Frame 2 →
F833 → F834 → F840 → F842 → F843=navbar-in-scroll + mindful-moments-section → promo-personal-calendar
(F872 → [art 11_จอ-น้ำ + F871 → profile-row] + Group 1 mascots) + Frame×4 (ส่วน 8 ด้าน/ธาตุ/สมดุล/life path)
+ what-next + referral-banner) · BG01 1
