# EYE PROOF — Zone 4: ประตู free/paid (คนไม่จ่ายเงินเห็นของ paid ครบทุกอย่างมาตลอด)

**Anchor:** `harness/run-tier-gate.ts` (60/60)
**PR:** feat/v2-tier-gate · base = main (`5ecadcc`)
**Ledger:** `harness/bug-ledger.json` → `tier-gate`
**Plan:** ❄️ FROZEN — `lamun-oracle/ψ/plans/2026-08-04_FROZEN-zone4-tier-gate.md`

ANCHOR: harness/run-tier-gate.ts#mut-paid-leak

## รูที่ปิด

`pages/v2/calendar/[date].tsx` บน main มีคำว่า `tier` / `isPaid` / `useV2Tier` **0 บรรทัด** ⇒ ทุกคนที่เปิดหน้า
รายละเอียดวันเห็น `ความเข้ากัน 5 ด้าน` · `คำทำนายรายด้าน` · `โหมดแอดวานซ์` (+ 4 section ที่อยู่หลัง toggle)
ซึ่ง Figma กำหนดให้เป็นของ paid ล้วน · `useV2Tier` ที่ goo ส่งมา (#169) merged แล้วแต่ **caller 0 ที่**

| จอ | free (Figma) | paid (Figma) | main | หลังใบนี้ |
|---|---|---|---|---|
| `/v2/calendar` | pill + การ์ดฟ้า promo | ไม่มีทั้งคู่ | ไม่มี tier | ✅ |
| `/v2/calendar/[date]` | pill + การ์ด upsell · **ไม่มี** 3 section | 3 section · ไม่มี pill/upsell | 🔴 ทุกคนเห็นของ paid | ✅ |
| `/v2/service` | pill | *(ไม่มี frame)* | pill โชว์ทุกคน hardcode | ✅ (`~ อนุมาน` — ดูล่าง) |
| home | pill | ไม่มี | ✅ ถูกอยู่แล้ว | **ไม่แตะ** |

## get_design_context ก่อนเขียน — และมันแก้ข้อสันนิษฐานที่ผิดไป 3 เรื่อง

1. **การ์ด promo หน้าเดือน กับ การ์ด upsell หน้ารายวัน เป็นคนละใบ** (`375:10991` ≠ `375:13285`)
   handoff รอบก่อนเดาว่าใบเดียวกัน — ผิด ใบหน้าเดือนไม่มีปุ่ม ไม่มี 2 ช่องเทียบ ไม่มีบรรทัด ฿99
2. **motion เป็นคนละ track** — มาสคอต 6 ตัวบน upsell ตรงกับ `.v3-float` ที่ชิปไปแล้วใน #166 เป๊ะ
   (`y-7 · scale 1.03 · ±2° · 35/70`) แต่เหรียญบนการ์ดหน้าเดือนเป็น `y-6 · scale **1.05** · ±3° · 25/50/75`
   ⇒ เพิ่ม keyframe ตัวที่ 2 (`v3-float-wide`) แทนที่จะยืมของเดิม (= ประดิษฐ์ค่า motion เอง)
3. **paint order เป็นส่วนหนึ่งของดีไซน์** — Figma วาดสไปรท์ 2 ตัวก่อนเนื้อหา อีก 4 ตัวหลัง มาสคอตไฟจึงอยู่
   **หน้า** ปุ่มไลม์ ผมวางรวมชั้นเดียวไว้ข้างหลัง → ไฟหายไปทั้งตัว **โดยที่ด่านเขียวหมด**

## asset — ไม่ต้อง commit รูปใหม่สักไฟล์

ฟีม เคาะว่า commit ชุด `2-0N` เข้า repo ได้ แต่ **คำถามผมตั้งบนสมมติฐานที่ผิด**: ผมเดาจากขนาดพิกเซลที่เท่ากันเป๊ะ
ว่า `2-0N` คือ "ชุดที่ 2 ของตัวเดิม" พอ**เปิดดูภาพจริง**เทียบกับ asset ที่ Figma ส่งมา ปรากฏว่าการ์ด 2 ใบนี้ต้องใช้
**มาสคอตธาตุ 5 ตัว + ตัวนักษัตร + เหรียญ** ซึ่งคนละตัวกับ `2-0N` (ที่เป็นมาสคอต Mu สีฟ้าตัวเดิม 5 ท่า)
และของที่ต้องใช้ **มีอยู่ใน repo ครบแล้ว**:

| Figma | ไฟล์ที่มีอยู่แล้ว |
|---|---|
| m1–m5 (ไม้ ไฟ ทอง ดิน น้ำ) | `public/images/v2/compat/sprite-{wood,fire,metal,earth,water}.png` |
| `01_ชวด-ไม้ 1` | `public/images/v2/characters/01_ชวด-ไม้.png` (ชื่อตรงกับ layer เป๊ะ) |
| ดาว/เหรียญทอง | `public/images/v2/zone2/coin.png` |
| มาสคอต Mu บน upsell | `public/images/v2/mascot/01-nav.png` (crop เดียวกับ navbar) |

⇒ **repo ไม่โตขึ้นเลย** · ไฟล์ 7 ตัวที่ค้างใน working tree ยังไม่แตะ (ไม่ใช่ของใบนี้ · Rule 1)

## 🔴 บั๊กที่ด่าน DOM ทั้งชุดมองไม่เห็น — server ตอบว่า "free" ให้ทุกคน

หน้าพวกนี้เป็น SSR และฝั่ง server `useCookies` ไม่มีคุกกี้ ⇒ `userId = ''` ⇒ `computeTier` ตอบว่า
"ไม่มีบัญชี = ไม่ใช่คนจ่ายเงินแน่นอน" (ถูกในฐานะ pure function, ผิดสนิทในฐานะคำตอบของ server)

```
curl -H "Cookie: <session จริง>" /v2/calendar   →  HTML มี data-testid="calendar-promo"
                                                    HTML มี data-testid="header-upgrade"
```

**คนจ่ายเงินได้ HTML ที่มีการ์ดขายของติดมาด้วย** แล้ว React ก็โยน hydration mismatch ทับอีกชั้น
ด่าน Playwright ทุกตัว**เขียว** เพราะกว่าจะไปดู client ก็ re-render ทับไปแล้ว — **เห็นได้จากภาพ screenshot เท่านั้น**

แก้ที่ `features/v2-shell/hooks/useClientTier.ts` (ของผมเอง ไม่แตะ hook ของ goo): เชื่อ tier ต่อเมื่อ mount แล้ว
⇒ server กับ client render แรกตรงกันเสมอ · เพิ่ม invariant **SSR-NEUTRAL** ที่อ่าน **ไบต์บนสาย** ไม่ผ่านเบราว์เซอร์

> **ส่งต่อ goo แล้ว**: จะย้าย guard เข้าไปใน `useV2Tier` เองไหม (กัน consumer คนถัดไปเหยียบซ้ำ) เป็นการตัดสินใจของเขา

## เลข ๆ เดียว (ฟีม เคาะ · คำถาม H)

Figma เขียน `57%` ในประโยค แต่เขียน `75%` ในช่องซ้ายของการ์ดใบเดียวกัน — ฟีม ตัดสินว่า **ยุบเป็นเลขเดียว**
⇒ ทั้งประโยค ทั้งช่อง ทั้งวงแหวน ผูก `detail.percent` ตัวเดียวกัน · invariant `ONE-NUMBER` ยึดไว้

## ความกว้างการ์ด (ฟีม เคาะ · คำถาม I)

Figma วาดการ์ดฟ้า 345 บนคอลัมน์ที่ padding 16 ⇒ ขอบขวาเหลือ 32 เยื้องข้างเดียวใบเดียวในจอ
ฟีม ตัดสินว่าเป็นมือลั่น ⇒ ทำเต็ม 361 · ของประดับ **anchor จากขอบขวา** ไม่ใช่ซ้าย จะได้กอดมุมเดิม
invariant `PROMO-EDGE` วัดกับตารางเดือนจริง: `16 vs 16` · `377 vs 377`

## CLS — วัดจริง เลือกจากตัวเลข ไม่ใช่จากความรู้สึก

tier มาหลัง first paint เสมอ (client fetch) ⇒ ทดสอบ 3 ทาง วัดทุกทาง:

| ทาง | free | paid |
|---|---|---|
| ปล่อยการ์ดโผล่ทีหลัง | **0.164** | 0.018 |
| จองที่ไว้ให้การ์ด (invisible) | 0.038 | **0.143** ← ย้ายความเจ็บไปหาคนจ่ายเงิน |
| **ไม่ทาสีเนื้อหาจนกว่าจะรู้ tier** ← เลือกอันนี้ | **0.021** | **0.001** |

ทางที่เลือกคือทางเดียวที่**ไม่มีใครโดน** — layout shift ต้องมีของที่ทาสีไปแล้วขยับ ถ้ายังไม่ทาก็ไม่มีอะไรขยับ
ราคาคือรอ 1 fetch ก่อนเนื้อหาโผล่ · spinner อยู่นอก flow จึงไม่ทำให้อะไรเลื่อน
หน้ารายละเอียดวันได้ **0.005 / 0.000**

⚠️ **ระหว่างทางผมเขียน invariant ผิดเอง**: ตอนแรกวัดเป็น *delta free−paid* → พอ paid แย่ลง 8 เท่า
ตัวเลข delta **ติดลบ = ผ่าน** ⇒ เปลี่ยนเป็นเพดานของ **แต่ละ tier แยกกัน** (ด่านที่เขียวได้ทั้งที่จอใครสักคนแย่ลง ไม่ใช่ด่าน)

## Run command

```bash
set -a; . testenv/env/fe.env; set +a; ./node_modules/.bin/next dev -p 3099
CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-tier-gate.ts        # 54/54
CAPTURE_HOST=http://localhost:3099 OUT=/tmp/shots npx tsx harness/capture-tier-gate.ts
```

## proof-of-teeth (`run-tier-gate.ts` → ✅ 60/60)

ฟันทุกซี่ต้องกัดจริงก่อนถึงจะเชื่อด่าน — รันจริงทุกตัว ไม่ใช่เขียนไว้เฉยๆ

| 🦷 mutant | ทำอะไร | ผล |
|---|---|---|
| `mut-paid-leak` | เรนเดอร์ `CompatList` แบบไม่มีเงื่อนไข (= สภาพ main วันนี้) | ✅ `GATE-FREE · paid sections ABSENT` แดง (`day-compat-list=true`) + ลาม unknown 2 ทาง |
| `mut-upsell-on-paid` | เรนเดอร์ upsell แบบไม่มีเงื่อนไข | ✅ `GATE-PAID · no upsell` แดง + `slow · never showed the upsell on the way` แดง |
| `mut-null-as-free` | `isPaid !== true` แทน `=== false` | ✅ `GATE-UNKNOWN · errored/slow · no upsell / no pill` แดง 4 ตัว |
| `mut-two-numbers` | ฮาร์ดโค้ด 75 ในช่องซ้าย | ✅ `ONE-NUMBER` แดงทั้งคู่ (`tile=75 sentence=71`) |
| `mut-borrowed-motion` | ให้เหรียญใช้ `.v3-float` แทน `.v3-float-wide` | ✅ `MOTION-TRACK` แดง (`compat-sprite-float`) |
| `mut-ssr-free` | ใช้ `useV2Tier` ตรงๆ แทน wrapper | ✅ `SSR-NEUTRAL` แดงทั้ง 3 ตัว |
| `mut-buried-sprites` | ย้ายสไปรท์ชั้นหน้าไปหลังเนื้อหา (z-20 → z-0) | ✅ `PAINT-ORDER` แดง (`1/923` จาก `748/923`) |
| `mut-ssr-paid-leak` 🆕 | เรนเดอร์ `CompatList` แบบไม่มีเงื่อนไข แล้วอ่าน **ไบต์บนสายของหน้ารายวัน** | ✅ `SSR-NEUTRAL · day · day-compat-list` แดง |

## 🔧 ซ่อมเครื่องมือ 3 รอบ — ฟันที่ไม่กัด แปลว่าด่านเปราะ ไม่ใช่บั๊กไม่มีจริง

1. **`MOTION-TRACK` เคยเป็นด่านเปล่า** — มันเลือก `.v3-float-wide` ตรงๆ ⇒ พอ mutant เปลี่ยน class
   selector ก็ไม่เจออะไรเลย = **error ไม่ใช่ fail** ⇒ เปลี่ยนไปอ่าน animation ที่ *กำลังวิ่งจริง* ในลูกของ node นั้น
2. **`PAINT-ORDER` ล้ม negative control 2 รอบ** — ทั้งสองรอบพลาดเรื่องเดียวกัน คือไปสุ่มพิกเซลที่**ปุ่มไม่ได้ทาสี**
   (ปุ่มเป็นแคปซูล ไฟอยู่ตรงปลายโค้ง) รอบแรกสุ่มจุดเดียว รอบสองนับพิกเซลไฟทั้งกรอบทับซ้อน — ฝังสไปรท์แล้ว
   ยังเหลือไฟ 114 px ⇒ กัดไม่ลงทั้งคู่
   ⇒ รอบสาม **หาพื้นที่วัดจากของจริง**: ซ่อนสไปรท์ ถ่ายรูปปุ่ม เก็บเฉพาะพิกเซลที่เป็นไลม์ = พื้นที่ที่ปุ่มทาจริง
   แล้วเอาสไปรท์กลับมาถามว่าพิกเซลชุดนั้นหายไปกี่จุด · **748/923 → 1/923** แยกขาด
3. **`slow` เคยทำให้ด่านค้าง** — `networkidle` ไม่มีวันมาถึงถ้าจงใจถ่วง request ⇒ เคสนั้นรอ `domcontentloaded`
   แทน (ด่านอื่นยังใช้เกณฑ์เข้ม) และเพิ่มเช็คว่า**พอคำตอบมาถึง จอต้องขึ้นจริง** — ไม่งั้นจอที่ว่างเปล่าตลอดกาล
   ก็ "ผ่าน" 3 ข้อแรกได้สบาย

## หนี้ที่คืน goo

เขา unit-test `computeTier` ครบ (`scripts/v2-tier.test.ts`) แต่ยังไม่มีใครกด `useV2Tier` บนเบราว์เซอร์จริง
ด่านนี้ mock `/api/user` ที่ระดับ network ⇒ **hook ตัวจริงวิ่งครบ 4 ทางออก**: paid · free · 500/ไม่มี `user_id` · ถ่วง 2.5s
⇒ ส่งผลกลับให้เขาแล้ว พร้อมเรื่อง SSR ข้างบน

## Pixel proof

- `PAINT` อ่าน computed จริง: sapphire `rgb(20,85,164)` · CTA ไลม์ `rgb(225,255,0)` · ช่องซ้าย `rgb(148,163,184)` · ช่องขวา `rgb(249,244,240)`
- `PAINT-ORDER` อ่านพิกเซลจริง — ไฟทับปุ่ม 748/923 จุด
- การ์ดหน้าเดือนที่เรนเดอร์: **361×143** · Figma: **345×142** (จอ screenshot ของ node มี bleed 16 รอบด้าน) ⇒ สูงตรง จำนวนบรรทัดตรง
- มาสคอตถูกตัดหัวบนขอบการ์ด = ตาม `overflow-clip` ของ Figma ไม่ใช่ของพัง

## ไม่แตะ seam ของ goo

`lib/v2/tier.ts` (กฎการจ่ายเงิน) · `useV2Tier` · `useV2Home` · `V2HomeScreen` — **ไม่แก้สักบรรทัด**
home ยังใช้ `profile.showUpgrade` ของเดิม ⇒ ไม่มี `UserGetById` ซ้ำ ตามที่ goo กำชับ

## 🚩 ตามจริง — ที่ยังไม่ทำในใบนี้ (เจตนา ไม่ใช่ลืม)

- **pill / CTA ยังกดไม่ได้** — payment v2 ยังไม่มี (ฟีม เคาะข้อ E) ⇒ เรนเดอร์เป็น `<span>` ไม่ใช่ปุ่มตาย · invariant `DEAD-CTA` ยึดไว้ · A2
- **pill ที่ `/v2/service` เป็นการอนุมาน** — Figma ไม่มี frame ฝั่ง paid ให้เทียบ · เขียนไว้ในโค้ดตรงๆ ว่าอนุมาน
- **ยังไม่ได้เรนเดอร์ที่ breakpoint ที่ 2** — เห็นแค่ @393 ⇒ A2
- **ปฏิทินยังกิน mock 100%** ⇒ % ในการ์ดเป็นเลข mock
- **บรรทัดหัก "ของคุณ / เอง"** ในการ์ดหน้าเดือนต่างจาก Figma ที่หักเป็น "วันเกิด / ของคุณเอง" — Chrome กับ Figma
  ตัดคำไทยคนละตัว · ผมไม่ปรับความกว้างให้ break ตรงเป๊ะ เพราะนั่นคือการเดาเลขให้ตรงภาพ (ความสูงการ์ด + จำนวนบรรทัดตรงกันแล้ว)
- **ทางแก้ที่ไม่ต้องรอเลย = อ่าน tier ใน `getServerSideProps`** — lane ของ goo ⇒ A2 + ส่งต่อแล้ว ไม่ลักไก่ใส่ใบ UI

## 🔴 rule compliance

worktree แยก · branch จาก `origin/main` · ไม่ push main · ไม่ self-merge · ไม่แตะ prod · ไม่มี secret ในโค้ด/ไฟล์นี้
`bug-ledger.json` แก้ผ่าน PR นี้ (ไม่ push ตรง)

## adversary sign-off

**ตู๋ (static)** — ขอให้ลองแหกด่านนี้ด้วยการอ่านโค้ด: จุดที่ผมคิดว่าเปราะที่สุดคือ (ก) `PAID_SECTIONS` ผูกกับ
`data-testid` 3 ตัว — ถ้ามี section paid ตัวที่ 4 โผล่มาในอนาคตโดยไม่มี testid ด่านนี้จะไม่รู้เรื่องเลย
(ข) `useClientTier` เพิ่ม render pass — ถ้ามีใครเอา `useV2Tier` ไปใช้ตรงๆ ในหน้า SSR ใหม่ บั๊กเดิมกลับมาทันที
และ `SSR-NEUTRAL` ยึดแค่ `/v2/calendar` หน้าเดียว

**goo (runtime)** — ขอให้ลองแหกด้วยการรัน: (ค) ถ้า `/api/user` ตอบ 200 แต่ body เป็น HTML หรือ `user_id` ว่าง
`computeTier` จะตอบ null ตามที่ตั้งใจจริงไหม (ง) StrictMode double-mount + เปลี่ยน userId กลางคัน
(จ) กด back/forward ระหว่าง tier ยังไม่ resolve

### 🔓 goo แหกด่านได้จริง 1 จุด — ขยายขอบเขตแล้ว (2026-08-04)

เขาชี้ว่า `ssrNeutral()` **curl แค่หน้าเดือน** ทั้งที่ของ paid ทั้งหมด (`ความเข้ากัน` · `คำทำนายรายด้าน` ·
`8 ประตู` · `8 เทพ`) อยู่ที่ **หน้ารายวัน** ซึ่ง**ไม่เคยถูกอ่านบนสายเลย**
วันนี้ปลอดภัยเพราะประตูตัดของ paid ออกจาก tree จริง — แต่ "ปลอดภัยเพราะกลไกอื่นบังเอิญกันไว้" ไม่ใช่ invariant
ถ้าวันหลัง SSR ของหน้านั้น regress **ของ paid จะทะลุให้ free โดยที่ไฟล์นี้ยังเขียว**

⇒ ขยาย `SSR-NEUTRAL` ให้ curl หน้ารายวันด้วย และยืนยันว่า `PAID_SECTIONS` ทั้ง 3 + upsell + pill **ไม่อยู่บนสาย**
⇒ เพิ่มฟัน `mut-ssr-paid-leak` พิสูจน์ว่ามันกัดจริง (54 → **60 checks**)
**รอยแตกแปลว่าขอบเขตของ invariant ผมแคบกว่า bug-class — ขยาย ไม่ใช่ทิ้ง**

คำตอบของเขาต่อข้อ (ค): รันจริงแล้ว `computeTier` ทน — body เป็น HTML / ไม่มี `user_id` → `errored` → `null` ·
string ที่ truthy ไม่ทำให้กลายเป็น paid · **หักไม่ได้**
(ง)(จ) เขาบอกตรงว่า **reason จากโค้ด ไม่ได้รันบนเบราว์เซอร์** ⇒ ยังเปิดอยู่ ไม่นับเป็นผ่าน

เรื่อง seam: เขาตัดสิน **ย้าย guard เข้า `useV2Tier`** (safe-by-default) แต่ **ไม่ churn ใบนี้** —
รับเป็น follow-up ของเขาเอง พร้อม re-home `mut-ssr-free` (พอ seam ปลอดภัยแล้วฟันซี่นั้นจะไม่กัดที่เดิม)
และรับ GSSP เป็น 2 ชั้น: **floor** = mount-gate ใน seam (กัน leak ทุกหน้า) · **ceiling** = resolve tier ใน GSSP (CLS = 0)

**สิ่งที่ผมพยายามหักล้างเองแล้วไม่สำเร็จ**: ฟัน 7 ซี่กัดครบ · negative control ของทั้ง CLS probe และ PAINT-ORDER
probe ผ่าน (probe ที่ยืนยันความผิดของตัวเองไม่ได้ = ตัวเลขไม่มีความหมาย) · เทียบภาพเรนเดอร์กับ Figma ทั้ง 2 ใบ
**สิ่งที่ผมยังไม่ได้ลอง**: breakpoint อื่น · Safari · ข้อมูลจริงจาก BE · long-text/ชื่อยาว
**สิ่งที่ยังไม่มีใครลอง** (goo บอกตรงว่าไม่ได้รัน): StrictMode double-mount + เปลี่ยน userId กลางคัน ·
back/forward ระหว่าง tier ยังไม่ resolve ⇒ **A2 ไม่ใช่ผ่าน**
