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

## ASSETS ที่ต้อง export จาก Figma (สำหรับ build นี้)
ตอนนี้ใช้ตัวแทน: icon domain = emoji (💼💰🤝📚) · BG = CSS gradient+radial clouds · มาสคอต hero = engine mascot ตาม dayGanzhi
1. icon แถบคะแนน ×3 (ใน FIXED — การ์ดน้ำเงิน แถวคะแนน) → `public/images/v2/destiny/ic-domain-{1..3}.png` @2x
2. มาสคอต 5 ธาตุ (SCROLLS → ธาตุของคุณ — ราตู้ไม้/ราทุจั่งไฟ/ราชูเป้ดิน/ราชินโลหะ/ราชัน้ำน้ำ) → `public/images/v2/destiny/el-{wood,fire,earth,metal,water}.png` @2x
3. BG01/BG04 (image fills ของเฟรม) — ใช้ CSS จำลองแล้ว ถ้าได้ไฟล์จริงจะสวยกว่า
4. art การ์ดน้ำเงิน (มาสคอตกลาง + กรอบ) — ตอนนี้ใช้ mascot จาก engine

วิธี export เร็วสุด (designer 1 คลิก/ชิ้น): เลือก layer → แผง Export → PNG @2x
(ทางเลือกอัตโนมัติ: restart session เพื่อโหลด Figma MCP tools แล้วใช้ get_image ตาม node-id)
