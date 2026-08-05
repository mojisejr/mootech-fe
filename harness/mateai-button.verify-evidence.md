# EYE PROOF — ปุ่ม Mate AI: ปิดรูที่ "BG ทะลุกรอบ" + ลอยตามที่ Figma กำหนดไว้จริง

**Anchor:** `harness/run-mateai-button.ts` (27/27)
**PR:** feat/v2-nav-mateai · base = main (`4a6599b`)
**Ledger:** `harness/bug-ledger/` → `mateai-containment`
**Plan:** ❄️ FROZEN FINAL — `lamun-oracle/ψ/plans/2026-08-03_FROZEN-calendar-arc-zones-1-3.md` (Zone 1)

ANCHOR: harness/run-mateai-button.ts#mut-mateai-overflow

## ที่มา
ฟีม: *"ปุ่ม Mate AI ยังไม่สวย คำว่า Mate AI มันทำให้ BG ทะลุกรอบออกมา · มาสคอตเล็กลงหน่อยมั๊ย · ให้มีลอยขึ้นๆลงๆ (แต่เห็นแค่ส่วนนึงพอ ไม่ต้องลอยออกนอกกรอบ)"*
และคำสั่งกำกับ: *"เจาะลึกลงไปในแต่ละ component ของ frame ด้วยนะ เพราะที่เราต้องมานั่งปรับกันอยู่นี่ บางส่วนเกิดจากคุณ implement ไม่ตรงกับ design"*

⇒ ใบนี้ **ไม่ได้สร้างจาก screenshot** ทุกค่ามาจาก `get_design_context` + `get_motion_context` ที่ node `461:3303` โดยตรง

## 🔍 drift ที่เจอเมื่อเทียบกับ node จริง (ไม่ใช่เดา)

| | Figma (`461:3303` / `461:3020`) | main | ใบนี้ |
|---|---|---|---|
| กรอบ Mate AI | **`overflow-clip`** | `overflow-visible` | ✅ `overflow-hidden` |
| ป้าย Mate AI | `top: 3px` (ในกรอบ) | `-top-1` + แผ่นไลม์ `px-4` (กว้าง 87 บนกรอบ 74) | ✅ อยู่ในกรอบ ไม่มีแผ่น |
| gradient ตัวอักษร | `#1455A4 → #E913C5` | `#294DA7 → #D036A9` | ✅ `v3-sapphire → v3-mate-magenta` |
| ขอบ | `5px rgba(216,143,169,.4)` | `4px #EDCCD7` (ทึบ) | ✅ ตรง node + `bg-clip-padding` |
| blur | `6.8px` | default | ✅ `6.8px` |
| มาสคอต | `75.139×92` @ (1,9) | เท่ากัน | ✅ `56×67` @ top 12 (ฟีม สั่งย่อ) |
| การลอย | **มี track ใน Figma** | ไม่มี | ✅ ใช้ track นั้น |

### รากที่แท้จริงของ "ทะลุกรอบ"
ไม่ใช่ตำแหน่งป้ายผิดอย่างเดียว — **กรอบมันไม่ได้ตัด**. Figma กำหนด `overflow-clip` ไว้แต่แรก แต่โค้ดเปิด `overflow-visible`
⇒ แก้ที่โครงสร้าง: กรอบเป็น `overflow-hidden` ⇒ **ทั้ง ป้าย · มาสคอต · และตอนลอย ออกนอกกรอบไม่ได้อีกเลย** ไม่ใช่ขยับ px ให้ใบนี้ผ่าน

### แผ่นไลม์ใต้ป้าย — ตัดทิ้งอย่างตั้งใจ
Figma มีแผ่นไลม์จริง (`bg #E1FF00` · `rounded-t-18` · `px-24`) แต่ frame มันกว้าง 102 เริ่มที่ x=-14 บนกรอบกว้าง 74 ที่ **clip** ⇒ เป็นไลม์บนไลม์ที่ถูกตัด = **เรนเดอร์ออกมาไม่เห็นอะไรเลย** การทำมันขึ้นมาใหม่ = สร้างช่องให้หลุดกรอบอีกรอบเปล่าๆ

### 🎯 motion — ไม่ได้ประดิษฐ์
`get_motion_context` ที่ node นี้คืน:
```
y [0,-7,0] · scale [1,1.03,1] · rotate [0,-2,2,0] · 2s · cubic-bezier(.45,0,.55,1) · infinite
```
**เป็น track เดียวกับ sprite ดวงสมพงศ์ (#160) ทุกค่า** ⇒ ระบบมี "ท่าลอย" มาตรฐานชุดเดียว ⇒ ยก keyframe เดิมเป็น `.v3-float` แล้วใช้ทั้ง 2 ที่ (`.compat-sprite` เก็บเป็น alias — markup + anchor ของ #160 ไม่ต้องแตะ, Rule 1)
*(ค่าที่ผมเดาไว้ตอน frame คือ 4px — ของจริง 7px · นี่คือเหตุผลที่กฎใหม่บังคับให้เรียก motion context ก่อนเขียน)*

### ขนาดมาสคอต — คำนวณ ไม่ใช่ลองตาดู
asset จริง `202×240` ⇒ `contain` ในกล่อง `56×67` ได้ภาพ `56×66.5` (แทบไม่มีขอบว่าง)
`top 12 + 67 = 79` บน content box สูง `60` ⇒ **ถูกตัด 19px**
ลอยขึ้น 7 + สเกล 1.03 โตอีก ~1 ⇒ **ยังเหลือถูกตัด ~8–14px ทุกเฟรม** (anchor วัดจริง 4 จุดของรอบ: 8 / 11.8 / 14 / 11.2)
⚠️ **จงใจต่างจาก Figma**: Figma วาด 75px — ฟีม สั่งให้เล็กลง ⇒ 56px คือ **การเบี่ยงตามคำสั่งคน ไม่ใช่ drift** (บันทึกไว้ตรงนี้เพื่อไม่ให้รอบหน้าเข้าใจผิดว่าพลาด)
หมายเหตุ: กล่องเดิม 75px กว้างกว่า content box 66px ⇒ ตัวการ์ตูน**โดนเฉือนข้างละ ~4.5px**; ของใหม่วาดเล็กลงแต่ไม่โดนเฉือน จึงอาจ "รู้สึกว่าเห็นเยอะขึ้น" ทั้งที่ scale เล็กลง 25%

## Run command
```bash
set -a; . testenv/env/fe.env; set +a
./node_modules/.bin/next dev -p 3099
CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-mateai-button.ts        # 27/27
CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-nav-consistency.ts      # 22/22 (ตัวเดิม)
CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-compat-sprites.ts       # 11/11 (float refactor ไม่พัง #160)
```

## proof-of-teeth (`run-mateai-button.ts` → ✅ 27/27)

| 🦷 | ทำอะไร | ผล |
|---|---|---|
| `mut-mateai-overflow` | คืนรูปทรงของ main: `overflow:visible` + ป้ายมีแผ่นไลม์ `px-4` ที่ `-top-1` | **CAUGHT** — พิกเซลแปลกปลอม `below:103 left:66 right:72` |
| `mut-gradient-drift` | ทาสี gradient กลับเป็น `#294DA7 → #D036A9` ของ main | **CAUGHT** — TOKENS แดง |
| `mut-motion-runs-under-reduce` | บังคับ animation ให้วิ่งใต้ `prefers-reduced-motion` | **CAUGHT** — 1 animation |

### ⚠️ verify-the-instrument — ด่านรุ่นแรกของใบนี้ "ฟันไม่เข้า" ตัวเอง
รอบแรกผมวัดเฉพาะ **แถบบน/ล่าง** ของกรอบ แล้ว `mut-mateai-overflow` **ผ่านฉลุย 0 stray px**
เปิดพิกเซลดูจริงถึงเห็นว่า **ของที่หลุดออกไปคือด้านข้าง** (ป้าย `px-4` = 87px บนกรอบ 74px) ไม่ใช่ด้านบนอย่างที่ผมตั้งสมมติฐานไว้ตอน frame
⇒ ด่านที่ sample น้อยด้านกว่าที่บั๊กมี = **ว่างเปล่าในด้านที่ไม่ได้ sample** ⇒ เปลี่ยนเป็น **วงแหวนครบ 4 ด้าน** แล้ว teeth ถึงกัด
*(ตระกูลเดียวกับที่ `mut-nav-fixed-width` เคยไม่กัดใน #163 — วัดผิดชั้น/ผิดแกน)*

### proxy ladder — ทำไมถึงไม่จบที่ computed style
`overflow: hidden` เป็นแค่ **ตัวแทน** ของ "ไม่มีอะไรทาสีนอกกรอบ" · ground-truth คือพิกเซล
ยิ่งชัดที่เรื่องสีขอบ: computed เป็น `rgba(216,143,169,.4)` **ถูกตาม Figma เป๊ะ** แต่พื้นไลม์ทาลอดใต้ border (ค่า default ของ CSS) ⇒ **เรนเดอร์ออกมาเป็นสีเขียวขี้ม้า** ⇒ ค่าผ่าน แต่ภาพผิด
⇒ เพิ่มด่าน **อ่านพิกเซลบนเส้นขอบจริง** ต้องได้ `r > g` (ชมพู) · ได้ `rgb(236,205,214)` ✓ (บังเอิญเกือบเท่า `#EDCCD7` ที่ main ฮาร์ดโค้ดไว้ — แปลว่าค่านั้นคือ "พิกเซลที่ sample มาจากภาพ" ไม่ใช่ค่าจาก node)

## Pixel proof
- `before/after @393` (ทั้งแถบ + zoom กรอบ Mate AI) — ป้ายอยู่ในกรอบ · ขอบเป็นชมพูทั้ง 2 ฝั่งของแถบ · มาสคอตเล็กลงและยังถูกตัดครึ่งล่าง
- CONTAINMENT วัดที่ **4 เฟสของรอบ 2s × 4 ด้าน = 16 จุด** ทุกจุด `0 stray px`
- reduced-motion: หยุดนิ่ง + ยังไม่มีอะไรล้นกรอบ

## ไม่ regress
- `npx tsc --noEmit` ✅
- `scripts/*.test.ts` ✅ 52/52
- `run-nav-consistency.ts` ✅ 22/22 · `run-compat-sprites.ts` ✅ 11/11

### 🔧 แก้ anchor เก่าที่ปักค่าผิดไว้ (ไม่ใช่ลดด่าน)
`run-nav-consistency.ts` ปัก `Mate AI border = #EDCCD7` — ซึ่งคือ **สีที่ composite แล้ว** ไม่ใช่ค่าที่ node กำหนด ⇒ เปลี่ยนไปปัก `rgba(216,143,169,.4)` ตาม node และให้ `run-mateai-button.ts` ถือด่าน "ต้องเรนเดอร์เป็นชมพู" แทน
และ selector `span span` ของมัน **เลื่อนเป้าเงียบๆ** ไปโดนตัวห่อมาสคอตเมื่อลำดับลูกเปลี่ยน ⇒ เปลี่ยนไปอ้าง `data-testid` แทนตำแหน่ง

## 🚩 ตามจริง — สิ่งที่ยังพิสูจน์ไม่ได้ในเครื่อง
- วัดบน `/v2/menu-preview` (จอ dev) ไม่ใช่ทุกหน้าจริง — แต่ `Menubar` เป็น component เดียวทั้งแอปแล้วตั้งแต่ #164 และ `run-nav-consistency.ts` ไล่ทุกหน้าจริงอยู่แล้ว
- ยังไม่ได้ดูบนเครื่องจริง/Safari iOS — `backdrop-blur` + `bg-clip-padding` เป็นของที่ Safari เคยงอแง (A2)

## 🔴 rule compliance
- ไม่แตะ prod / ไม่มี secret / ไม่ force-push / PR เข้า main ไม่ self-merge
- Rule 1: keyframe เดิมไม่ถูกลบ — `.compat-sprite` ยังใช้ได้เหมือนเดิม

## adversary sign-off
**ผมพยายามหักล้างงานตัวเองด้วยอะไรบ้าง** (ไม่ใช่ติ๊กถูก):
1. ให้ tooth คืนรูปทรงของ main มาทั้งดุ้น → ด่านต้องแดง — **รอบแรกไม่แดง** จึงรู้ว่าเครื่องมือผมวัดผิดแกน แก้แล้วแดงพร้อมพิกัด
2. ลองเชื่อ computed style อย่างเดียว → เจอว่าสีขอบ "ถูกตามค่าแต่ผิดตามภาพ" ⇒ ต้องอ่านพิกเซล
3. ลองวัดเฟรมเดียว → ไม่พอ เพราะบั๊กอาจอยู่แค่ยอดโค้งของ animation ⇒ วัด 4 เฟส
4. ลองสมมติว่า "ย่อมาสคอต = เห็นน้อยลง" → **วัดแล้วไม่จริง** (ink เพิ่มขึ้นเพราะเดิมโดนเฉือนข้าง) ⇒ รายงานตามจริงแทนที่จะอ้างว่าเล็กลง

**ตู๋ / goo — ช่วยยิงตรงนี้**: (ก) มีทางไหนที่ content หลุดกรอบได้อีกโดยที่วงแหวน 4 ด้านไม่เห็น (เช่น `filter`/`drop-shadow` ที่ทาเลย padding box) (ข) `bg-clip-padding` + `backdrop-blur` บน Safari iOS จะให้ขอบคนละสีไหม
