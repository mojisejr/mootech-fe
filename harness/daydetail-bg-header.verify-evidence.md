# verify-evidence — พื้นหลังการ์ดบน (Figma 634:8260) + header หน้ารายละเอียดวัน

**เงื่อนไขที่รัน (อ่านก่อนตัวเลข)**

| | |
|---|---|
| BEFORE | `main a4560da` · `next dev` :3141 |
| AFTER | `lamun/daydetail-bg-header` (จาก a4560da) · `next dev` :3143 |
| ด่าน | 🖐️ **รันมือทั้งหมด** · CI 5 ตัวรันบน production build + `npx next start` :3143 |
| | 🔴 **CI ไม่ได้รันบน repo นี้เลยตั้งแต่ `2026-08-06T11:43Z`** — บองปิด-เปิด PR #194 กระตุ้นแล้ว **ยังไม่สร้าง run** ⇒ ระดับบัญชี (รอฟีมเปิด billing) ⇒ ทุกผลข้างล่าง = ผมรันเอง ❌ ไม่ใช่ CI |
| จอ | 393 · 360 · 320 (สูง 852) · dSF 2 · **context ใหม่ทุกช็อต** |
| API | stub `/api/user` + `/api/v2/day-detail` — fixture **ยกมาทั้งก้อนจาก `harness/capture-daydetail-md.ts`** |

---

## ก้อน 1 — พื้นหลังการ์ด: **ไม่ใช่งานปรับค่าสี มันคืองานเปลี่ยนชนิดของพื้นหลัง**

บองเขียนบรีฟว่า "ไล่สีถูกทิศ ถูกช่วงสี" — อ่านแล้วเหมือนงานแก้ตัวเลข **เปิด 634:8260 แล้วไม่ใช่**

```
ของเรา   CSS  linear-gradient(150deg, #E8F1FC 0%, #CBC8FC 48%, #FCE3FA 100%)   ← เดาไว้
Figma    ฟิล 2 ชั้น: พื้น near-white (radial #FEFDFC→#FAF7F4) + **IMAGE FILL ทับ** object-cover
         ภาพ = ฟ้า+ก้อนเมฆ บนซ้าย · ม่วง→ชมพู ล่างขวา · คลื่นเมฆขาวล่าง · **ประกาย 4 แฉก 2 ดวง**
```

⇒ **ก้อนเมฆกับประกายเขียนเป็น gradient ไม่ได้** — ของเดิมจึงทำได้แค่ "คล้ายๆ" ตลอดกาล ⇒ ลงเป็นภาพจริง

**ขนาด — บีบแล้ววัด ไม่ได้ประเมิน**

```
ต้นทาง  1122×1402 PNG   1,264,029 bytes
ที่ลง    1122×1402 WebP q80   10,730 bytes    −99.2%
```

(`images.unoptimized` เปิดอยู่ ⇒ ไม่มีใครบีบให้ทีหลัง ต้องบีบตอนลง · เครื่องนี้ไม่มี cwebp/sharp และ `sips` **เขียน** webp ไม่ได้ (`Can't write format: org.webmproject.webp`) ⇒ เข้ารหัสผ่าน canvas ของ Chromium แล้ว**ตรวจ magic bytes = RIFF…WEBP** กันได้ PNG ปลอมนามสกุล)

### เทียบกับ Figma — **วัดจุดต่อจุด ไม่ใช่มองแล้วว่าใกล้**

ผมมองภาพแล้วรู้สึกว่า "ของเราชมพูจัดกว่า Figma" แล้ววัดที่ 8 จุดพื้นหลัง (มุม + กลางขอบ เลี่ยงวงแหวน/ตัวหนังสือ):

```
probe          ours      figma     Δmax
top-left       #e7f0ff   #e6f0fc     3
top-mid        #ebf0fe   #eff1fb     4
top-right      #c6cffc   #c8cbfb     4
left-mid       #e1e9f9   #e1eafc     3
right-mid      #fbe6fb   #fce4f9     2
bottom-left    #f1edfc   #f5f1fc     4
bottom-mid     #f8e7fb   #f6e6fb     2
bottom-right   #fce4fa   #fce2f9     2
                              worst = 4/255 = 1.6%
```

**ความรู้สึกผมผิด ตัวเลขบอกว่าตรง** — 1.6% คือ noise ของ WebP q80 + การ render PNG ของ Figma เอง

### คอนทราสต์ — วัดกับ **จุดที่มืดที่สุดในแถบที่ตัวหนังสืออยู่จริง** ไม่ใช่ค่าเฉลี่ย

reproduce การ crop `cover` (ภาพ portrait 0.80 ลงกรอบ landscape 1.18) แล้วสแกนแถบ y 130→305:

```
มืดสุดในแถบข้อความ  #d4c9fd
   #0B305B navy      8.55:1  ✓ AA
   #464646 secondary 6.10:1  ✓ AA
```

`backgroundColor: #F2E9FB` (= ค่าเฉลี่ยของ crop) รองไว้ใต้ภาพ ⇒ เน็ตช้าไม่แว้บขาวใต้ตัวหนังสือ และค่าเฉลี่ยสว่างกว่าจุดมืดสุด ⇒ อัตราส่วนมีแต่ดีขึ้น

✅ **❌ ชิป 財 ไม่กลับมา** — วัดด้วย `document.body.innerText.includes('財')` = **false ทุกช็อต** (Figma ใบนี้ยังมี — เก่ากว่าคำสั่ง G-3 ของฟีม)
✅ **ของอื่นในการ์ดไม่ขยับ**: กล่องการ์ด `361×322 r=20px` ที่ 393 · `328×322` ที่ 360 · `288×346` ที่ 320 — **เหมือน BEFORE ทุกตัวเลข** เปลี่ยนแค่ `background*`

---

## ก้อน 2 — header

```
BEFORE  <div style="linear-gradient(105deg,#FFFFFF 40%,#C9E4F4 100%)" class="rounded-b-[20px]">  h=60/84
AFTER   <AppHeader/> ตรงๆ · shellBg=none · radius=0px                                            h=64/88
```

✅ ปุ่มย้อนกลับ `header-back` 36×36 ยังอยู่ทุกจอ · ✅ กระดิ่ง + avatar ครบ · ✅ **avatar ยังได้ภาพจริง** (`avatarImg=true` ทุกช็อต ไม่ regress #193 · `avatarLetter=null`) · ✅ อัพเกรดโชว์เฉพาะ free

**คำโปรย: ผมเคาะว่า ไม่มี** (บองยกให้ผมตัดสิน) — ปฏิทินดวงมีคำโปรยเพราะมันคือหน้ารวมของทั้งหมวด หน้านี้พูดถึง **วันเดียว** และวันนั้น**เขียนเต็มอยู่แล้วต่ำลงไป 145px** ("วันนี้ · พฤหัสบดีที่ 6 สิงหาคม 2569") ตัวใหญ่กว่า ติดกับวงแหวนที่มันสังกัด ⇒ ใส่ในหัวอีก = พูดเรื่องเดียวกัน 2 ครั้งในจอเดียว ในที่ที่อ่อนกว่า · เติมกลับได้ 1 บรรทัดถ้าฟีมเห็นต่าง

`items-center` (ไม่ใช่ `items-start` แบบปฏิทินดวง) เพราะหน้านั้น top-align บล็อกหัว 2 บรรทัด ส่วนหน้านี้ซ้ายมีบรรทัดเดียวข้าง chevron 36px — padding อื่นเท่าปฏิทินดวงแล้ว

**ledger `inline-hex-gradient-tech-debt` ไม่ได้ถูกปิด** — ผมเกือบเขียนในโค้ดว่า "ใบนี้ปิดหนี้ D2" แล้วไปเปิด ledger อ่าน: `enforced_by` ชี้ `pages/v2/calendar/notifications.tsx#inline-gradient` ซึ่ง**ยังมี gradient ตัวเดียวกันอยู่** ไฟล์ผมแค่ถือ*สำเนา*ของคอมเมนต์ ANCHOR ⇒ หายไป 1 ใน 2 จุด **หนี้ยังอยู่** (ledger integrity ✅ ผ่าน)

---

## proof-of-teeth

**ไม่มีด่านใหม่ · ไม่มี assertion ใหม่** — ตรวจแล้วว่า**ไม่มีด่านไหนตรึงค่า hex เก่าเลย** (`grep E8F1FC|C9E4F4|CBC8FC|FCE3FA` ใน `harness/` + `scripts/` = ว่าง) ⇒ ไม่มีอะไรต้อง retarget

หน้านี้ บอง/ฟีม เคาะไว้ตั้งแต่ 2026-08-06 ว่า **ภาพ 393 ที่บังคับถ่ายคือด่านของมัน** (สี/ล้น/เลย์เอาต์ตาจับได้) ⇒ หลักฐานคือภาพ + ตัวเลข geometry ข้างบน

**ด่านที่ CI *ควรจะ* รัน — 🖐️ รันมือ บน production build + `next start` :3143**

```
run.ts               exit=0   🟢 GATE PASSED
run-pixel.ts         exit=0   🟢 PIXEL GATE PASSED
run-calendar-month   exit=0   🟢 CALENDAR-MONTH PASSED
run-calendar-select  exit=0   ✅ 25 passed, 0 failed
capture-coming-soon  exit=0   ✅ 22 passed, 0 failed
tsc --noEmit exit=0 · scripts/*.test.ts ทุกไฟล์ exit=0 · CI-parity build exit=0
```

**`run-tier-gate` + `run-calendar-day` แดง — ของเดิม พิสูจน์แล้ว ไม่ใช่ของผม**
รันบน main กับบนกิ่งผม **บน dev server เหมือนกันทั้งคู่** แล้ว `diff` บรรทัด ✗:

```
tier-gate    IDENTICAL (4 ✗ ทั้งสองฝั่ง)
calendar-day IDENTICAL (4 ✗ ทั้งสองฝั่ง)
   ✗ 0 running animations outside the fixed nav — getAnimations()=1
   ✗ all 10 sections present — missing: header, strip, score, …
   ✗ grade badges present — count=0
   ✗ instrument verified — C+ probe trips on a known-bad (white) control
```

⚠️ ทั้งสองตัว**ไม่อ่าน `HARNESS_HOST`** (ใช้ `CAPTURE_HOST` และ default พอร์ต 3099/3011) และให้ผลต่างกันระหว่าง dev กับ production build (7✗/0✗ vs 4✗/4✗) ⇒ **วัดสภาพแวดล้อมปนกับวัดโค้ด** · ไม่ได้ต่อ CI · ลง A2

ANCHOR: harness/capture-daydetail-md.ts#data-testid="day-score"

---

## adversary sign-off

1. **"พื้นหลังใกล้เคียงแล้ว/ชมพูจัดไป"** → **ความรู้สึกผมผิด** วัด 8 จุดได้ Δ ≤ 4/255 ⇒ อย่าตัดสินสีด้วยตา
2. **"ใบนี้ปิดหนี้ D2 inline-hex-gradient"** → **ผิด** เปิด ledger อ่านแล้ว `enforced_by` เป็นไฟล์อื่นที่ยังมี gradient อยู่ ⇒ แก้คอมเมนต์ ไม่ใช่แก้ ledger
3. **"stub ถูกแล้ว"** → **ผิด** ผมพิมพ์ fixture เอง (`ganzhi`/`percent`) ของจริงคือ `dayGanzhi`/`overallPercent` ⇒ การ์ดไม่ render เลย capture timeout ⇒ **ยกของจริงมาทั้งก้อน ไม่พิมพ์ใหม่**
4. **"anchor ที่แดงคือของผม"** → **ไม่ใช่** รันสองฝั่งบน env เดียวกันแล้ว diff ได้ IDENTICAL

**ยังไม่ได้พิสูจน์ (ไม่ใช่ว่าครอบแล้ว):**
- จอ **free ที่ 360/320** — ถ่าย free แค่ 393 (paid ครบ 3 จอ)
- ภาพ**ตอนยังโหลดไม่เสร็จ** — เห็น `backgroundColor` รองอยู่ แต่**ไม่ได้ถ่ายจังหวะนั้น** (หน่วงเน็ตแล้วยิง)
- **dark mode / prefers-reduced-data** — ไม่มีในโปรเจกต์ ไม่ได้ตรวจ

## 🔶 เจอแล้วไม่แก้ ขอฟีมเคาะ

**หัวข้อ "รายละเอียดวัน" ตกบรรทัดที่ 393 เมื่อเป็น free** (h=84 ก่อน / 88 หลัง — **ตกบรรทัดตั้งแต่ก่อนแก้ ไม่ใช่ของใหม่**)
ที่ 393: กว้างทั้งหมด 393 − 32 (px-4) − 36 (chevron) − 180 (อัพเกรด 84 + กระดิ่ง 40 + avatar 40 + gap) − gap ≈ **131px** แต่ "รายละเอียดวัน" ที่ 24px ต้องการ ~170px
ปฏิทินดวงรอดเพราะ**ไม่มี chevron** (ได้คืน 44px) ⇒ นี่ไม่ใช่เรื่อง padding มันคือ**หน้าลูก + ปุ่มอัพเกรด อยู่ด้วยกันไม่ได้ที่ 393**
ทางเลือก: (ก) ย่อชื่อหน้า (ข) ไม่โชว์อัพเกรดบนหน้าลูก — Figma Free-2 มี (ค) ปล่อยตกบรรทัด (ง) ลดขนาดหัวเฉพาะหน้านี้
⇒ **เป็นเรื่อง copy/product ไม่ใช่เรื่องช่าง** และบรีฟสั่งว่าติดให้หยุดรอฟีม ⇒ ปล่อยไว้ตามเดิม รายงาน

🤖 Lamun Oracle
