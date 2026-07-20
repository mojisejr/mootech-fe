# MuMate Figma Map — V3

> สารบัญโครงสร้างไฟล์ Figma ของ MuMate (app redesign V3) — ใช้เป็น "แผนที่" ให้ทีม + Lamun
> เข้าถึง page/section/screen/component ได้ตรง node โดยไม่ต้องส่ง link ทีละครั้ง.
>
> **นี่ไม่ใช่ design contract** — contract อยู่ที่ [`DESIGN.md`](../DESIGN.md). ไฟล์นี้คือ *แผนที่ของ source material*
> (เปลี่ยนตาม Figma). อัปเดตเมื่อโครงสร้าง Figma เปลี่ยน.

## Source

| | |
|---|---|
| File | **Mumate app - V3 (Copy)** — working copy ที่ duplicate มาไว้ใน team `HomemadFarm` (ฟีมเป็นเจ้าของ) |
| fileKey | `hEOnE9S6wLkMhb0Iy2Fe6T` |
| Link | `https://www.figma.com/design/hEOnE9S6wLkMhb0Iy2Fe6T/Mumate-app-V3--Copy-` |
| เข้าถึงผ่าน | Figma MCP (remote connector) — account ฟีม (`Nonthasak`), **Dev seat / Pro** บน `HomemadFarm` |
| ต้นฉบับ | ไฟล์เดิมของ o (`i4CykBp2JNHXg0lmDUYzrQ`) — final แล้ว o ไม่แก้ต่อ จึง dup มาทำงาน (node-id ตรงกันทุกตัว) |

**หมายเหตุการเข้าถึง:**
- Figma seat ผูกกับ **team** ไม่ใช่ account — ต้องให้ไฟล์อยู่ใน team ที่ฟีมมี Dev seat (`HomemadFarm`) ถึงจะได้ quota เต็ม. ต้นฉบับของ o อยู่ team ที่ฟีมมีแค่ View seat → rate-limit เร็ว จึง dup มา.
- remote MCP list page ทั้งไฟล์ได้ไม่ครบ (คืนมาแค่ `Cover`) — node-id ของแต่ละ page seed จากคนเปิด Figma (คลิก page → คลิกขวา → *Copy link to selection*) แล้วเก็บไว้ในไฟล์นี้.
- `get_metadata` ให้แค่ layer name + ขนาด — **label copy จริง** ต้อง `get_design_context`/`get_screenshot` (ดึงตอนลงมือทำจอนั้น).

---

## Pages / Sections (แท็บซ้ายมือใน Figma)

| Page / Section | node-id | scope | map แล้ว? |
|---|---|---|---|
| **Welcome** (onboarding + core journey) | `298-475` | ✅ core journey | ✅ |
| **Service** | `333-7244` | active | ✅ (โครง) |
| **Calendar** | `333-4409` | active | ✅ |
| **Payment** | `375-20340` | active | ✅ (โครง) |
| **Couple's Horoscope** | `480-4548` | ✅ **active (ตัวใหม่ — ฟีม 2026-07-20 ยืนยัน ไม่ใช่ legacy)** | ✅ |
| **my-destiny** (X Page 17) | `626-2004` | ✅ **active (redesign, superset ของ `300-2356`)** | ✅ |
| Design Backup (Big Page) | `9-3` | 🗄️ backup — ไม่เจาะลึก | note only |

> **UPDATE 2026-07-20**: Couple's Horoscope + X Page 17 ไม่ใช่ deprecated แล้ว — ฟีม ยืนยันเป็นของใหม่ในสโคป. spec เต็มดึงแล้ว (Pro clone) → ดู [`DESIGN.md`](../DESIGN.md) §7/§10.
> **⚠️ my-destiny `626-2004` render ในโลก legacy** (teal-pink glass, Noto Sans Thai) ไม่ใช่ v3 — capture as-is, reskin หรือไม่ = build-time decision (DESIGN.md §12).
> Spec ทุก section ดึงครบด้วย Pro clone แล้ว (onboarding/Service/Calendar/Payment/Couple's/my-destiny + component ทั้งหมด) → token/component อยู่ใน DESIGN.md v3.

---

## Page: Welcome — `298-475`  ✅ core astrology journey

Canvas เดียวรวม onboarding flow ทั้งเส้น. เรียงตาม flow ผู้ใช้:

| ลำดับ | Screen | node-id | หมายเหตุ |
|---|---|---|---|
| 1 | **01-splash** | `298-476` | + variants `619-12978`, `588-10311`, `588-10335` (เปิดแอป) |
| 2 | **03-register** | `302-238` | สมัคร/สร้างบัญชี |
| 2b | **Welcome / Mumate account** | `300-2861` | หน้าจอต้อนรับ + logo |
| 3 | **04-profile-setup** | `302-275` | ฟอร์มวันเกิด (Field ชื่อ/วัน/เดือน/ปี/เวลา + avatar + PDPA checkbox) |
| 3b | **04-profile-setup-filled** | `311-62` | สถานะกรอกแล้ว (title "ตั้งค่าโปรไฟล์") |
| 4 | **02-intent-check** | `300-1548` | เลือกสิ่งที่อยากดู (การ์ด Property Type 3×2) |
| 5 | **04-pdpa** (privacy) | `300-1582`, `300-2137` | 2 จอเหมือนกัน (scroll state) — เข้ารหัส/ไม่แชร์/AI เพื่อสุขภาพ + สรุป PDPA |
| 6 | 🎯 **ธาตุของคุณ (destiny result)** | `300-2356` | ⚠️ frame ชื่อ `04-pdpa` แต่ content = **ผลธาตุ** — ชื่อ frame ไม่ตรง content |
| 7 | **Home** | `300-2858`, `333-6545` | หน้าหลัก (`333-6545` = Home เต็ม 393px กว้าง) |

**Destiny result breakdown** (`300-2356`): เพื่อน/พี่น้อง/หุ้นส่วน · เรียน/ทำงาน/ลงทุน · หน้าที่การงาน ·
โชคลาภ · คู่ครอง · ผู้สนับสนุน → map เข้าธาตุ (ไม้/ทอง/ไฟ/ดิน/น้ำ).
_typo copy: "ธาตดิน" (ควร ธาตุดิน), "ธาตน้ำ" (ควร ธาตุน้ำ) — เรื่อง copy ของ o._

**Components ที่ Welcome ใช้:** Primary/Tertiary Buttons · Field-* · Checkbox with text / Checkboxes with labels ·
Property Type (intent card) · Status Bar · Menu / Menubar · Mascot Mumate2 (`588-12966`) · icons (google/calendar)

**Copy verified (Pro clone 2026-07-20 — แก้จากที่เดาไว้):**
- splash ปุ่ม = **`ถัดไป`** (ไม่ใช่ "เริ่ม")
- register (`302-238`) = **`ยินดีต้อนรับสู่ มิวเมท`** / sub `มาร่วมสร้างบันทึกทางใจ และค้นพบความสงบไปกับพวกเรา` — ปุ่ม `ลงทะเบียนด้วย LINE` + `ลงทะเบียนด้วย Google` + `มีบัญชีอยู่แล้ว? เข้าสู่ระบบ`
- intent (`300-1548`) heading = **`วันนี้คุณอยากดูแลด้านไหน?`** · การ์ด: การเงิน/สุขภาพ/ครอบครัว/พัฒนาตนเอง/ความรัก/การงาน
- `300-2861` "Welcome/account" = จริงๆ คือจอ **LINE OAuth consent** (ของ LINE เอง) ไม่ใช่ Mumate welcome surface

---

## Section: Service — `333-7244`

listing บริการ (metadata ตื้น — โครงจาก frame name):

| Screen | node-id | ขนาด | หมายเหตุ |
|---|---|---|---|
| services (long) | `333-7519` | 393×3435 | หน้ารวมบริการ scroll ยาว |
| services (single view) | `626-2786` | 393×860 | เวอร์ชัน 1 viewport |
| iPhone 16 - 1 | `636-16699` | 393×872 | frame มาตรฐาน |
| (content block) | `626-2962` | 361×1992 | บล็อกเนื้อหา reusable |

> จอย่อย + copy ต้อง `get_design_context` เพิ่ม.

---

## Section: Calendar — `333-4409`  🎯 (rich — ยามมงคล + Google Calendar sync)

ปฏิทินโหราศาสตร์จีน/ไทย บอกฤกษ์ยามมงคลรายวัน + ทิศ/สีมงคล + sync Google Calendar:

| Screen | node-id | ขนาด | หมายเหตุ |
|---|---|---|---|
| calendar (main) | `368-9750`, `375-16710` | 393×1450 | จอปฏิทินหลัก |
| calendar detail | `375-11286`, `633-7806` | 393×1798 | รายละเอียด/scroll |
| calendar long | `375-16355`, `634-8194`, `634-8752` | 393×4384 | list ยาว |
| calendar mid | `375-13316`, `421-956` | 393×1285 | |
| **Notifications sheet** | `636-10221`, `421-901` | 393×852 | bottom-sheet แจ้งเตือนยามมงคล + Google Calendar |
| Pill Tabs (standalone) | `375-17085` | 266×45 | tabs: "ปฏิทินรายปี" / "ปฏิทินเฉพาะฉัน" |
| **Grade Card Previews** | `636-21251` | 361×1350 | component set 10 เกรด: A Excellent → D- Critical |

**Copy เด่น (Notifications sheet):** "การแจ้งเตือนทั้งหมด" · "⏰ ยามมงคลเริ่มแล้ว · 09:00-10:59" ·
"🔮 ยามมงคล — มีลาภผล ทรัพย์สิน เงินทอง" · "วัน 己丑 · ดิถีสะสม (กำลัง 57%) · ทิศโชคลาภ W · สีมงคล ขาว/ครีม เหลือง น้ำตาล" ·
"📅 Google ปฏิทิน · จาก Mumate"

**Components:** Status Bar · Pill Tabs · Grade Card set · close-icon · BG01 · sheet

---

## Section: Payment — `375-20340`

flow ชำระเงิน (metadata ตื้น):

| Screen | node-id | ขนาด | หมายเหตุ |
|---|---|---|---|
| 11-payment-processing | `375-20499`, `402-22087` | 393×852 | จอกำลังชำระเงิน |
| iPhone 16 - 1 (checkout?) | `402-21464` | 393×1196 | flow ชำระเงิน (ยาว) |
| Home | `636-12924` | 393×882 | หน้าหลัก (หลังชำระ?) |
| iPhone 16 - 1 | `636-11973` | 393×1007 | จอเกี่ยวกับ payment |

> จอย่อย + copy ต้อง `get_design_context` เพิ่ม.

---

## 🗑️ Deprecated (X-prefixed — ไม่ใช่ target, เก็บไว้อ้างอิง)

### X Couple's horoscope — `480-4548`
feature **ดูดวงคู่รัก/สมพงศ์** (love/friendship compatibility) — mini-flow: landing เลือก 2 โปรไฟล์ →
sheet กรอกวันเกิด → result ยาว + Grade Card รายด้าน + save-PDF/share. มี empty iPhone shells + duplicate frames
→ เป็น **exploration ที่ parked/legacy** ไม่ใช่ของ shipping.
Key screens: landing `636-17802` (ดูดวงคู่รัก) · birth-sheet `636-18533` · result (tall) `636-18819`/`636-19891` ·
per-aspect `636-21840`/`636-22276`. ปุ่ม "บันทึกเป็น PDF" `529-354`, "แชร์ผลดวงสมพงศ์" `529-359`.

### X Page 17 — `626-2004`  (my-destiny **เดิม**)
`Profile` `626-2005` (375×4429) + Chart instance `626-3060` ลอย. **ยืนยันว่าเป็น my-destiny/result หน้าเก่า** —
กว้าง **375px** (baseline iPhone เก่า vs 393px ทั้งไฟล์ใหม่) เป็นสัญญาณ legacy ชัด, สูง 4429px = single-scroll result เดิม.
โครงในแทบไม่เหลือ (superseded โดยจอ ธาตุ `300-2356` ใน Welcome).

---

## Code Mapping — Welcome/onboarding flow ↔ codebase

> เพิ่ม 2026-07-20 (Lamun) — audit 3 ตัวไล่ codebase จริง (Next.js 14 Pages Router, next-auth v4)
> เทียบ Figma Welcome canvas `298-475` กับ route ที่ render อยู่จริง. **นี่คือความจริงของ code ตอนนี้ ไม่ใช่ Figma.**

### ⚠️ ชื่อ route สลับกับ Figma — อ่านก่อนแก้จอไหน

ชื่อจอใน Figma **ไม่ตรง** กับชื่อ route ในโค้ด — จำสับได้ง่ายมาก:

| Figma เรียกว่า | แต่ code render ที่ | หมายเหตุ |
|---|---|---|
| **03-register** (ปุ่ม LINE+Google login) | **`/login`** (`pages/login/index.tsx`) | จอ "สมัคร" ของ Figma = จอ login ของ code |
| **04-profile-setup** (avatar + ฟอร์มวันเกิด) | **`/register`** (`pages/register/index.tsx`) | จอ profile ของ Figma = route `/register` |
| **01-splash** / **Home hub** | **`/`** = calculator (homepage swap) | `/` ไม่ใช่ splash และไม่ใช่ hub — เป็น public calculator |
| **Welcome/account** (logo) | `/welcome` = ฟอร์มวันเกิด (ไม่ใช่ logo) | branded shell จริงอยู่ที่ `pages/auth/error.tsx` |

### Screen map (สถานะจริง)

| Figma screen | node | Code today | สถานะ | wrap target (keep logic) |
|---|---|---|---|---|
| 01-splash | `298-476` | — (`/` = calculator) | 🔴 **ไม่มี route** | สร้างใหม่ หรือ restyle `DitiHero.tsx` |
| 03-register (login) | `302-238` | `pages/login/index.tsx` | 🟢 มี (teal legacy) | restyle JSX L142-302 · เก็บ `handleLogin`/webview/`ModalGoogleExternal` |
| Welcome/account | `300-2861` | `pages/welcome` (form) · shell = `auth/error.tsx` | 🟡 mismatch | restyle `auth/error.tsx` glass shell หรือ welcome finish card |
| LINE consent | — | external (LINE) + `modal-google-external.tsx` | ⚪ external | จอ LINE แต่งไม่ได้ · แต่งได้แค่ modal escort |
| 04-profile-setup | `302-275` | `pages/register/index.tsx` (+`profile/edit` = filled) | 🟢 มี partial (teal) | restyle in-place · เก็บ state/avatar/`BirthDayInput` |
| 02-intent-check | `300-1548` | — | 🔴 **ไม่มีเลย** (ไม่มี schema column ด้วย) | net-new build |
| 04-pdpa consent | `300-1582` | static `privacy/policy.tsx` เท่านั้น | 🔴 **ไม่มี consent gate** | net-new build |
| destiny result | `300-2356` | `pages/my-destiny/index.tsx` (~1350 บรรทัด) | 🟢 มี (teal legacy) | restyle hero+mascot+`box-chinese-table` · เก็บ data logic |
| Home hub | `333-6545` | — (`/` = calculator) | 🔴 **ไม่มี** | net-new build |
| Menubar / bottom-nav | `461:3097`, `469:3670` | — (มีแค่ slide-out `menu.tsx`) | 🔴 **ไม่มีเลย** | สร้างใน `components/ui/` |

### Auth truth (next-auth v4)
- providers ที่ config: **LINE · Google · Facebook · Twitter · Credentials("dev", dev-only)** (`pages/api/auth/[...nextauth].ts:15-55`) — UI แสดงแค่ **Google + LINE**.
- nextauth pages: `signIn:/login` · `error:/auth/error`.
- ลำดับหลัง login: `handleLogin(provider)` → cookie → `signIn(provider, callbackUrl:/auth/after/[provider])` → OAuth → `pages/auth/after/[provider].tsx` (ไม่ set `MEMBER_ID`) → `router.replace('/')` → `/` register round-trip เขียน `MEMBER_ID` → CTA gated by `lib/auth/cta-ready.ts`, routed by `lib/auth/welcome-target.ts` (anon→login · authed+code→my-destiny · else→register).
- **อย่าแตะ logic**: `[...nextauth].ts`, `auth/after/[provider].tsx`, `lib/auth/*`, `use-current-user.ts`, `handleLogin`/`signIn`/effects.
- **dead duplicate**: `pages/login-with/index.tsx` = จอ login ซ้ำ แต่ unreachable (`LOGIN_WITH`→`/login`) — อย่า restyle, ลบทิ้งได้.

### 🧩 Personalization resolver — ยังไม่ถูกใช้จริง (สำคัญ)
- `lib/personalization/` (resolver decision C ที่เราสร้าง PR#71) **ยังไม่มี production screen ไหนใช้** — มีแค่ `design-system.tsx` (showcase) + test.
- **my-destiny ไม่ได้ใช้ resolver** — ดึง mascot จาก backend ตรงๆ (`resultSummary.mascot.url/.name`) ผ่าน `ChineseHoroscopeGet` (authed) ไม่ใช่ `compute.ts`.
- resolver อ่านจาก `compute.ts`: `yearOfZodiac` (top-level, มีเสมอ) + `enrichment.dayMasterElement` (**nested, best-effort — timeout 5s → null** → ต้องมี static fallback).
- → คำถามค้าง: resolver ควรไปเสียบ **จอ public calculator (anon, ใช้ `compute.ts`)** ไม่ใช่ my-destiny (authed มี mascot จาก backend แล้ว). **ต้องเคาะกับ ฟีม.**

---

## Component Library

### Button — `284-851`
Component SET หลายแกน (`State` × `Size` × `Icon`), 4 กลุ่มย่อย:
| กลุ่มย่อย | node-id | variants |
|---|---|---|
| Primary Buttons | `284-877` | 13 (Default/Hover/Pressed/Focus/Loading/Disabled × FullWidth/Small, Icon=Off) |
| Secondary Buttons | `284-912` | 18 (มีแถว Icon=On) |
| Tertiary Buttons | `284-980` | 17 (Icon On+Off) |
| Links | `284-1037` | 8 (`Type`=Subtle/Legal Link × Small/Medium × Icon) |

States: Default/Hover/Pressed/Focus/Loading/Disabled · Sizes: Full **520×52** · Small **104×52** · Focus โต 528×60 (ring)

### Tiles — `284-1133`
| กลุ่มย่อย | node-id | รายละเอียด |
|---|---|---|
| Property Type / State set | `284-1261` | State=Default/Hover/Focus/Selected/Pressed · tile ~**166×108** |
| Sleep Areas (icon set) | `284-1283` | Single Bed/Crib/Living Room/Bunk Bed/Queen Bed (24×24) |
| Property Type (icon set) | `284-1342` | house/Apartment/Guesthouse/Hotel (32×32) |
| Sleep Card (instance) | `284-1255` | 207×143 |

### Dropdown — `300-587`
SET เดียว **12 variants** — `State`(Default/Hover/Focus/Loading) × `Label`(On/Off) × `Icon`(On/Off).
field **520×80** · Label On 520×98 · Loading ยุบ 520×51.

### Input — `300-697`
SET ใหญ่ ~**40 variants** — `State`(Default/Hover/Focus/Filled) × `Status`(Default/Error) × `Label` × `Helper Text` × `Icon`.
SET รอง **Input Field** (`308-88`) 8 variants แต่ละ **311×80**. ตัวอย่าง Field-ชื่อ (`300-1017`): label "ชื่อ" + placeholder "ใส่ชื่อของคุณ".
main **520×56** (base).

### Checkbox — `300-1923`
2 sets:
- **Checkboxes with labels** (`300-1944`) — 18 variants (State × Status × Size × SubText). labeled+subtext row ~356×74.
- **Checkboxes** (bare box) (`300-2012`) — 6 variants (state × status). box **24×24** (Focus 32×32).

### Tab — `375-10887`
**Pill Tabs** (`375-10888`) — State=Default/Hover/Focus, แต่ละ **310×45** (ไม่มีแกน selected ใน metadata).

---

## ยังไม่ครบ (เก็บไว้ทำตอนลงมือ)

- **label copy จริง** บนปุ่ม/tab/checkbox/tiles — metadata ไม่ให้ ต้อง `get_design_context`/`get_screenshot` ตอนทำจอนั้น
- **จอย่อยของ Service / Payment** — metadata ตื้น ต้องเจาะเพิ่ม
- **design tokens** (สีจริง hex, spacing scale, font/weight) — ดึงด้วย `get_design_context`/`get_variable_defs` ตอนเริ่ม delta report
- **Design Backup (Big Page) `9-3`** — backup เท่านั้น ไม่เจาะลึก
