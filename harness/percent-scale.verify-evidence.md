# EYE PROOF — PERCENT-SCALE · ด่านที่ ONE-NUMBER ทำแทนไม่ได้โดยโครงสร้าง

**Anchor:** `scripts/percent-scale.test.ts` (CI) + `harness/run-percent-scale.ts` (browser harvester)
**PR:** feat/percent-scale · **base:** main `21072a5` · **Ledger:** `harness/bug-ledger/percent-scale-cross-layer.json`
**Run:** `npx tsx scripts/percent-scale.test.ts` → **74 assertions ผ่าน** · `tsc` clean · `scripts/*.test.ts` **62/62**

ANCHOR: scripts/percent-scale.test.ts#mut-fraction-passes

---

## ทำไมต้องมีด่านนี้ ทั้งที่มี ONE-NUMBER อยู่แล้ว

`ONE-NUMBER` ยืนยันว่า tile · ประโยค · วงแหวน **แสดงเลขเดียวกัน** — แต่ทั้งสามอ่านจาก `detail.percent` **ตัวเดียวกัน**
⇒ scale รั่วที่แหล่ง = รั่วพร้อมกันทั้งสาม = **ยังตรงกัน = เขียว** (ผมพิสูจน์สดตอนรีวิว #175: `onePercentAgree('0.57%','0.57%','0.57%') === true`)

> **invariant ที่วัดความสอดคล้องระหว่างของที่มาจากแหล่งเดียวกัน ตรวจความผิดของแหล่งนั้นไม่ได้ โดยนิยาม**

`PERCENT-SCALE` ถาม**คนละแกน**: *"ตัวเลขนี้อยู่บนสเกลที่จอสมมติไว้ไหม"* + *"เลขที่จอทา ตรงกับเลขที่ API ส่งมาไหม"*

## ⏱ และมันต้องมาตอนนี้ ไม่ใช่ตอน M-B

แผนผูก `PERCENT-SCALE` ไว้กับ M-B เพราะ *"M-B คือรอบแรกที่เลขจริงถึงตาผู้ใช้"*
**เปิดโค้ดดูแล้วไม่จริง** — `useCalendarMonth` ยังเสิร์ฟ `mockCalendarMonth` และตัวที่ swap เป็น adapter คือ **G-0c (#186)**
⇒ **G-0c ทำให้ 31 ช่องกลายเป็นเลขจริงพร้อมกัน โดยไม่ต้องรอ UI เปลี่ยนอะไรเลย** ⇒ **ประตูคือ G-0c ไม่ใช่ M-B**

---

## โครงสร้าง — แยก "การตัดสิน" ออกจาก "การเก็บของ"

| ไฟล์ | ตอบคำถามอะไร | ใครรัน |
|---|---|---|
| `harness/percent-crosscheck.ts` | ให้เลข API กับเลขบนจอมา คู่นี้รับได้ไหม | **CI** (ผ่าน `scripts/percent-scale.test.ts`) |
| `harness/run-percent-scale.ts` | ไปเอา 2 ชั้นนั้นมาจากหน้าจริง | browser (มือ) |
| `features/v2-calendar/components/percent-display.ts` | ตัวจัดรูปแบบ + เกณฑ์ความเป็นไปได้ | ใช้ตอน render |

**ทำไมแยก**: browser รันได้แค่ใน `harness/` ซึ่ง **CI ไม่รัน** — กับดักเดียวกับที่ทำให้ด่านหน้าบริการ (#179) และ invariant แซฟไฟร์ ไม่มีใครเฝ้า
⇒ **การตัดสินย้ายไปอยู่ที่ที่ CI เอื้อมถึง** เหลือให้ browser ทำแค่หน้าที่เก็บของ

## 🔴 `—` ไม่ใช่ `0%`
`0.4083` ถ้าปัดเศษจะเป็น **`0%`** ซึ่ง**ไม่ได้ดูพัง** มันอ่านเป็น *"วันนี้แย่มากจริงๆ"*
**นั่นคือรูปทรงของความผิดที่อันตราย: ดูสมเหตุสมผล ไม่ใช่ดูประหลาด** ⇒ `—` บอกว่า*เราไม่รู้* · `0%` บอกว่า*วันนี้แย่*

## จุดที่เลขถึงตาผู้ใช้ — ต่อผ่านตัวจัดรูปแบบครบแล้ว
`MonthGrid` (ช่อง + aria) · `DayStrip` (แถบ + aria) · `CompatList` · `PredictionCards` · **`ScoreRing`** · `PersonalCalendarUpsell` (ประโยค + ช่องซ้าย)

**แยกข้อความออกจากเรขาคณิตชัดเจน** — ความกว้างแถบ `CompatList` และ arc ของ `ScoreRing` **ยังใช้ค่าดิบ** เพราะเป็นตัวเลขเชิงเรขาคณิต ไม่ใช่ข้อความ

> ⚠️ grep รอบแรกผมได้ 6 จุด **รอบสองเจอเพิ่ม 2 จุด — หนึ่งในนั้นคือ `ScoreRing` = วงแหวน เลขที่เด่นที่สุดบนการ์ด**
> ถ้าหยุดที่รอบแรก **เลขที่ผู้ใช้เห็นชัดที่สุดจะเป็นจุดเดียวที่ไม่มีตัวจัดรูปแบบคุ้ม**

---

## proof-of-teeth

| ฟัน | เปลี่ยนอะไร | ผลจริง |
|---|---|---|
| `mut-fraction-passes` | ยอมรับช่วง (0,1) | `SCALE-GUARD rejects 0.4083 (fraction leak)` ← **รูที่ ONE-NUMBER ปล่อยผ่าน** |
| `mut-round-fraction` | จัดรูปแบบค่าที่ใช้ไม่ได้ แทนคืน `—` | `HONEST-GAP 0.4083 → "—" (NOT "0") — 0` |
| `mut-floor-not-round` | `floor` แทน `round` | `rounds to nearest: 61.67 → 62 — 61` |
| `mut-empty-passes` | ถือว่า harvest ว่าง = ผ่าน | `ABORT-ON-EMPTY: no API side ⇒ not meaningful` |
| `mut-skip-implausible` | ไม่ตรวจค่า API ที่หลุดสเกล | `CROSS-LAYER flags an implausible API value` |
| `mut-tolerance` | ยอมให้คลาดเคลื่อนได้ | `catches an OFF-BY-ONE (67 where 67.91 must round to 68)` |

### 🦷 `mut-tolerance` **ไม่กัดในรอบแรก** — และนั่นคือของที่มีค่าที่สุดในใบนี้

ผมทดสอบแต่ **เคสรั่วแรงๆ** (API `80` → จอ `1`) ซึ่ง tolerance ก็ยังจับได้อยู่ดี
**สิ่งที่ tolerance กลืนจริงคือเลขที่ผิดนิดเดียว** — จอ `floor(67.91)` = `67` แทนที่จะปัดเป็น `68`
⇒ **บั๊กเดียวกับ `57` อยู่ข้าง `58` บนการ์ดใบเดียว** ซึ่งเป็นสิ่งที่ ruling H ของ ฟีม เกิดมาเพื่อกัน

> **ฟันที่ไม่กัด ไม่ได้แปลว่าฟันไม่ดี — มันแปลว่าเทสต์ครอบไม่ครบ**
> **ผมครอบความล้มเหลวที่เสียงดัง แต่ไม่ได้ครอบความล้มเหลวที่เงียบ** — และของที่หลุดขึ้น production ได้จริง มักเป็นอย่างหลังเสมอ

เพิ่มเคส off-by-one แล้ว → ตอนนี้กัดครบ **6/6**

## verify-the-instrument
ก่อนเชื่อการปฏิเสธใดๆ ด่านยิง **ค่าจริง 20 ค่า** จาก payload man-vs-day จริง (2 คน × 13 วัน) ให้ผ่านก่อน
**เกณฑ์ที่รับข้อมูลจริงไม่ได้ ทำให้การปฏิเสธทั้งหมดข้างล่างไร้ความหมาย**

---

## ผลรัน harvester วันนี้ — **ABORT ไม่ใช่ PASS**

```
harvested: 0 value(s) from the API · 31 painted on screen

⛔ ABORT — nothing to compare.
   api=0 screen=31
   Today this is EXPECTED: useCalendarMonth still serves mockCalendarMonth...
   This run refuses to print a pass rather than certify an unchecked screen.
```
**exit code = 2** (ไม่ใช่ 0)

⇒ **นี่คือฟันของไฟล์นี้เอง** — พิสูจน์ว่ามัน**ปฏิเสธที่จะรับรองจอที่ยังไม่ได้ตรวจ**
⇒ พอ **G-0c** ขึ้น harvest จะกลายเป็นของจริง**โดยไม่ต้องแก้ไฟล์นี้เลยสักบรรทัด**

---

## adversary sign-off

**ยังไม่มี** — ขอ **ตู๋ (static)** · **goo (runtime)** ลองแหก:
1. **ทำให้ scale รั่วโดยที่ `SCALE-GUARD` ยังเขียว** — ค่าที่อยู่นอกช่วง (0,1) แต่ยังผิดสเกล เช่นคูณ 10 แทน 100?
2. **ทำให้จอโชว์เลขที่ API ไม่เคยส่ง โดยที่ `CROSS-LAYER` ยังเขียว** — ผมจับคู่ด้วย `date` ถ้า date เพี้ยนล่ะ
3. **ทำให้ harvester เก็บของได้แต่เก็บผิดชั้น** — ถ้ามี API ตัวอื่นที่มี field `overallPercent` แต่ไม่ใช่ของจอนี้

## ⚪ ยังไม่ครอบ (A2)
- ⚪ **harvester ยังไม่เคยรันแบบมีของจริงให้เทียบ** — ต้องรอ G-0c · วันนี้พิสูจน์ได้แค่ว่ามัน **abort ถูกต้อง**
- ⚪ **`harness/*` ยังไม่อยู่ใน CI** — บองต่อ `run-calendar-month` เข้าไปแล้ว 1 ตัว · ตัวนี้ยังต้องรันมือ
- ⚪ **หน้ารายละเอียดวัน** (`useDayDetail`) ยัง mock ⇒ harvester อ่านได้แค่หน้าเดือน
- ⚪ **`—` ยังไม่เคยปรากฏบนจอจริง** เพราะ mock ให้ค่าที่ใช้ได้หมด — จะเห็นครั้งแรกตอนข้อมูลจริงมี null
