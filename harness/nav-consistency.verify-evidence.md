# EYE PROOF — เมนูล่าง v2: รวมให้สม่ำเสมอ + แก้ติดขอบจอ + Mate AI ตรง Figma

**Anchor:** `harness/run-nav-consistency.ts` (22/22, 3 teeth)
**PR:** feat/v2-nav-consistency · base = main (`08e1908`)
**Ledger:** `harness/bug-ledger/` → `nav-consistency`
**Plan:** ❄️ FROZEN v3 — `lamun-oracle/ψ/plans/2026-08-03_FROZEN-menu-consistency.md`

ANCHOR: harness/run-nav-consistency.ts#mut-mate-on-form

## ที่มา — ฟีม ตั้งข้อสังเกต 3 เรื่อง แล้วให้ไปสืบ
1. *"ทำไมเมนูไม่เหมือนกันทุกหน้า? เพราะ code per page ป่ะ?"*
2. *"บางจอ responsive ไม่ดี ติดขอบจอเลย"*
3. *"ปุ่ม Mate AI ขวาสุด ไม่เหมือนใน Figma ป่ะ?"*

**คำตอบข้อ 1 — ไม่มีหน้าไหน hard-code เลย ทุกหน้าใช้ shared component แต่ *มี shared 2 ตัว*:**

| | `v2-shell/Menubar` | `v2-home/CalendarMenu` | **Figma `461:3224`** |
|---|---|---|---|
| หน้าที่ใช้ | service · coming-soon · compat form · compat recent · shop | home · ปฏิทินทั้งหมด | — |
| ไอคอน | ✅ | ❌ | ✅ |
| **Mate AI** | ❌ | ✅ | ✅ |
| ทรง | pill ลอย 244px | เต็มจอ 368px | pill + Mate AI |
| safe-area | ❌ | ✅ | — |

⇒ รากไม่ใช่ "ไม่มี shared" แต่คือ **"shared สองอัน ไม่มีใครเป็นเจ้าของความจริง"** และ **ไม่มีตัวไหนตรง Figma ครบ**

## 🐛 bug-class ที่ anchor นี้เป็นเจ้าของ — **เนื้อหาถูกตัดใน `position: fixed` layer**
nav เป็น `fixed` ⇒ เวลามันกว้างเกินจอ **มันถูกตัด แต่ `document.scrollWidth` ไม่ขยาย**
⇒ **ด่าน overflow-x ทุกตัวที่เรามีอยู่รายงาน "สะอาด"** ขณะที่ผู้ใช้เห็น "น้าหลัก" (ห หาย) กับ Mate AI ครึ่งใบ
⇒ ตัววัดระดับ**หน้า**บอดกับเรื่องนี้เชิงโครงสร้าง — ต้องวัด **ตัว nav เอง**

### ตัวเลขก่อนแก้ (วัดจริง)
| จอ | ต้องการ | ผล |
|---|---|---|
| 393 / 375 | 368 | ✓ |
| **360** | 368 | 🔴 ตัดข้างละ 4px |
| **320** | 368 | 🔴 ตัดข้างละ 24px |

**ต้นเหตุระดับบรรทัด:** แท็บ `w-[58px]` ตายตัว · ปุ่ม CTA `min-w-0 flex-1` หดได้ ⇒ state ที่เป็นปุ่มรอด state แท็บพัง

## 🔍 "ดูดีๆ นะ บางหน้ามันกลายเป็นปุ่มเดียว" (คำเตือน ฟีม) — สืบแล้ว **เตือนถูก**
วัดครบ 4 state × 4 จอ: **พังแค่ state `default`** · `primary-cta`/`saved` รอด (ปุ่มหดได้) · **`form` ไม่มี Mate AI โดยเจตนา** (`menu-state.ts` verify กับ Figma แล้วว่า sheet บันทึกไม่มีเมนู)
⇒ **"Mate AI ทุกหน้า" ต้องไม่เหมารวม state 4** ไม่งั้นไปพังของที่ถูกอยู่แล้ว → จึงมีฟัน `mut-mate-on-form` กันไว้

## ✅ สิ่งที่แก้
1. **แท็บหดได้** ทั้ง 2 nav (`min-w-0 flex-1`) + **ฟอนต์ลดขั้น** 14 → 12 (<384) → 11 (<340) + ระยะแคบลง
   ⇒ **ไม่มีป้ายไหนถูกตัดเลย** (วัด: "หน้าหลัก" = 49.8px @14 แต่ @320 มีที่แค่ ~40px/แท็บ)
2. **Mate AI แยกเป็น component กลาง** `v2-shell/MateAIButton` — ไม่ก๊อป (การก๊อปจะยิ่งทำให้ราก 2-ตัวแย่ลง) แล้วทั้ง 2 nav เรียกตัวเดียวกัน
3. **สี Mate AI ตรง Figma** — ของเดิม**สลับกัน**: พื้น gradient + ป้ายทึบ → ที่ถูกคือ **พื้นไลม์ `#E1FF00` + ป้ายไล่สี `#294DA7`→`#D036A9`** ขอบ `#EDCCD7`
4. **Menubar ได้ Mate AI + safe-area** ⇒ 5 หน้าที่เคยไม่มี ตอนนี้มีครบ
5. **ไม่แตะ**: state `primary-cta`/`saved`/`form` · **หน้าผลสมพงศ์** (Figma ไม่มีเมนู — ยืนยันจาก crop ท้ายเฟรม `636:18819` = ว่างเปล่า)

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app next dev -p 3104
CAPTURE_HOST=http://localhost:3104 npx tsx harness/run-nav-consistency.ts   # 22/22
```

## proof-of-teeth (run-nav-consistency.ts → ✅ 22/22)
| invariant | result |
|---|---|
| 4 state × **8 ความกว้าง (320–430)** — ไม่ล้นจอ + **ป้ายไม่ถูกตัด** | ✓ ทั้ง 32 ช่อง |
| Mate AI: มีใน default/primary-cta/saved · **ไม่มีใน `form`** | ✓ |
| 5 route จริง — มี nav + Mate AI + 4 แท็บ | ✓ |
| route service/calendar — พอดี @393/360/320 | ✓ |
| **หน้าผลสมพงศ์ — ไม่มีเมนู (มติ ฟีม + Figma)** | ✓ |
| Mate AI: พื้นไลม์ (ไม่ใช่ gradient) · ขอบ `#EDCCD7` · ป้ายเป็น gradient จริง (โปร่ง + clip:text + กล่อง > 0) | ✓ |
| 🦷 `mut-nav-fixed-width` | **CAUGHT** |
| 🦷 `mut-page-missing-nav` | **CAUGHT** |
| 🦷 `mut-mate-on-form` | **CAUGHT** |

## 🔬 verify-the-instrument — **เครื่องมือผมเองมีรู และเจอตอนรัน**
ฟัน `mut-nav-fixed-width` **ไม่กัด** ในเวอร์ชันแรกของ probe: ผมวัดแค่ `nav.children` ⇒ แท็บที่ถูกปักความกว้างจะ**ล้นอยู่ข้างใน pill** โดยกล่องของ nav ไม่ขยับเลย — **คือ bug-class เดียวกับที่ anchor นี้อ้างว่าเป็นเจ้าของ แต่ลึกลงไปอีกชั้น**
แก้: union กล่องของ **leaf จริง** (แท็บ + Mate AI) + จับ container ที่ clip เนื้อหาตัวเอง ⇒ ฟันกัดทันที
*(ถ้าไม่ทดสอบฟัน anchor นี้จะเขียวแบบว่างเปล่า)*

## Pixel proof
- `harness/pixel-proof/nav-320-before.png` — ก่อนแก้ @320: "น้าหลัก" + Mate AI โดนตัด
- `harness/pixel-proof/nav-default-320-after.png` — หลังแก้ @320: ป้ายครบ 4 คำ Mate AI เต็มใบ
- `harness/pixel-proof/nav-mate-ai-after.png` — ปุ่ม Mate AI @4x: พื้นไลม์ + ป้ายไล่สี ตรง Figma

## ไม่ regress
`tsc` ✓ · `scripts/*.test.ts` ✓ · ledger ✓ · **`npm run build` (CI placeholder env)** ✓ · `run-calendar-flow` ✅ PASS
**หมายเหตุตามจริง:** `run-shared-topbar` / `run-service-hub` ล้มด้วย `ReferenceError: React is not defined` — **ล้มบน `main` เหมือนกัน** (ผมรันเทียบแล้ว) ⇒ เป็นของเดิม ไม่ใช่ผลจาก PR นี้ · ไม่ได้ซ่อน ไม่ได้แก้ในใบนี้ (นอก scope)

## 🚩 ยังไม่ปิด (จะเป็น PR2 ตามที่ ฟีม เคาะทาง ก)
ยังมี **2 component** อยู่ — ใบนี้แก้อาการ + แชร์ปุ่ม Mate AI แล้ว แต่ยังไม่รวมเป็นตัวเดียว (การรวมต้องแตะ **home** จึงแยกใบ). `CalendarMenu` ยังไม่มีไอคอนบนแท็บ (Figma มี) — เก็บไว้ PR2

## 🔴 rule compliance
ไม่แตะ `pages/matching/**` · `constants/api/api-user-matching-*` (git diff 0) · ไม่ push main · ไม่ self-merge

## adversary sign-off
Cross-oracle, RUN-PROVEN — ผมไม่เซ็นรับรองตัวเอง
- **ตู๋ — ⏳ PENDING.** จุดโจมตี: (1) ป้ายถูกตัดจริงไหมที่จอแคบ → assert `scrollWidth<=clientWidth` ทุกแท็บ 8 ความกว้าง ลองหาความกว้างที่หลุด; (2) probe บอดอีกไหม → ผมเจอเองว่ามันบอดชั้นเดียว แก้แล้ว ลองหาชั้นที่ 3; (3) เผลอยัด Mate AI ใส่ `form` → `mut-mate-on-form` กัด; (4) home เปลี่ยนไปเกินที่ตั้งใจไหม (ฟีม คุ้มครอง home) → เปลี่ยนเฉพาะความกว้างแท็บ/ฟอนต์ที่จอแคบ + ปุ่ม Mate AI ที่แชร์; (5) forbidden paths → 0 ไฟล์
- **ฟีม** — เคาะ (ก) + "Mate AI ทุกหน้า" + หน้าผลไม่เอาเมนู; สี Mate AI เป็นค่าที่ sample จาก node ขอให้ดูด้วยตาตอน merge
- **goo** — `menu-state.ts`/`CalendarShell` เป็นของคุณ ผมไม่แตะ contract หรือ state machine เลย แค่ทำให้ตัว render หดได้ + ใช้ปุ่มกลาง
