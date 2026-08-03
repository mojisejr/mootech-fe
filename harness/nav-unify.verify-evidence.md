# EYE PROOF — PR2: รวมเมนูล่างเหลือ component เดียว + ไอคอนจริงจาก Figma

**Anchor:** `harness/run-nav-consistency.ts` (22/22 — ตัวเดิมจาก #163 ยังเขียวหลังรวม)
**PR:** feat/v2-nav-unify · base = main (`8320ed1`)
**Ledger:** `harness/bug-ledger.json` → `nav-consistency` (ต่อท้าย PR2)
**Plan:** ❄️ FROZEN v3 — `lamun-oracle/ψ/plans/2026-08-03_FROZEN-menu-consistency.md` (ทาง ก: PR1 แก้อาการ → PR2 ปิดราก)

ANCHOR: harness/run-nav-consistency.ts#mut-mate-on-form

## ที่มา — ปิดรากที่ #163 ยังไม่ได้ปิด
#163 แก้ **อาการ** (ติดขอบจอ · สี Mate AI · Mate AI ขาด 5 หน้า) แต่ **ยังเหลือ nav 2 ตัว** ตามที่ ฟีม เคาะทาง (ก)
ใบนี้ = **PR2** รวมเหลือตัวเดียว

| | ก่อน (หลัง #163) | หลังใบนี้ |
|---|---|---|
| จำนวน component | **2** (`v2-shell/Menubar` · `v2-home/CalendarMenu`) | **1** (`v2-shell/Menubar`) |
| ไอคอนบนแท็บ | Menubar มี (วาดเอง) · CalendarMenu **ไม่มี** | **ไอคอนจริงจาก Figma ทุกที่** |
| states | Menubar 1 · CalendarMenu 4 | **4 ครบในตัวเดียว** |
| home | ตัวอักษรล้วน | **ได้แถวไอคอน** ← การเปลี่ยนที่ตั้งใจของ PR นี้ |

## 🎨 ไอคอน — ของจริงจาก Figma ไม่ใช่วาดเดา
export SVG จาก instance `469:3671` ได้ 8 ไฟล์ (4 แท็บ × 2 สถานะ) → เรนเดอร์ดูเพื่อ**ระบุตัวจริง** ไม่เดาจากชื่อไฟล์:
`i2 = home-smile` (บ้านยิ้ม) · `i7 = discover` (บริการ) · `i5 = calendar` · `i8 = shop`
ใช้ **path จริง** + `fill="currentColor"` ⇒ active (ไลม์บน sapphire) / inactive (จาง) มาจาก class เดียว ไม่ต้องมีไอคอน 2 ชุด

## 🔌 ไม่แตะ seam ของ goo
`menu-state.ts` (contract 4 state ที่ goo เป็นเจ้าของ + verify กับ Figma แล้ว) · `CalendarShell` · `V2HomeScreen` · `menu-preview`
**ไม่ถูกแก้เลยแม้แต่บรรทัดเดียว** — `CalendarMenu` กลายเป็น **forwarder** ที่คง type + ชื่อ export เดิม
⇒ ปิดรากได้โดยไม่ต้องไปรื้อของคนอื่น (ถ้าเปลี่ยน import ทั้งหมดจะแตะ contract ของ goo โดยไม่จำเป็น)

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app next dev -p 3105
CAPTURE_HOST=http://localhost:3105 npx tsx harness/run-nav-consistency.ts   # 22/22
```

## proof-of-teeth (run-nav-consistency.ts → ✅ 22/22 หลังรวม)
| invariant | result |
|---|---|
| 4 state × 8 ความกว้าง (320–430) — ไม่ล้นจอ + ป้ายไม่ถูกตัด | ✓ |
| Mate AI: มีใน default/primary-cta/saved · **ไม่มีใน `form`** | ✓ |
| 5 route จริง — nav + Mate AI + 4 แท็บ | ✓ |
| หน้าผลสมพงศ์ — ไม่มีเมนู (มติ ฟีม + Figma) | ✓ |
| Mate AI: พื้นไลม์ · ขอบ `#EDCCD7` · ป้าย gradient จริง | ✓ |
| 🦷 `mut-nav-fixed-width` · `mut-page-missing-nav` · `mut-mate-on-form` | **CAUGHT ทั้ง 3** |

**สำคัญ:** anchor ตัวนี้เขียนตอน #163 (ตอนยังมี 2 component) — หลังรวมเป็นตัวเดียวมัน **ยังเขียว 22/22 และฟันยังกัดครบ** ⇒ ไม่ได้แก้เทสให้ผ่าน แต่ของใหม่ผ่านเทสเดิม

## Pixel proof
`harness/pixel-proof/nav-unified-3-surfaces.png` — เมนูจาก **3 surface** (menu-preview · service · calendar) เรียงกัน:
ทรงเดียวกัน ไอคอนเดียวกัน active pill เดียวกัน Mate AI เดียวกัน ⇒ **"ทำไมไม่เหมือนกันทุกหน้า" ปิดจบ**

## ไม่ regress
`tsc` ✓ · `scripts/*.test.ts` ✓ · ledger ✓ · **`npm run build` (CI placeholder env)** ✓

## 🚩 ตามจริง — สิ่งที่ยังพิสูจน์ไม่ได้ในเครื่อง
- **home (`/v2`) เรนเดอร์จบไม่ได้ในเครื่อง** — ค้างที่ "กำลังโหลด…" เพราะต้องมี BE จริง (ผมลอง 1.5/3/6 วิ แล้ว) ⇒ **ไม่ได้ยืนยันด้วยตาบน route จริง**. ที่ยืนยันได้: home เรียก `<CalendarMenu state="default" />` ซึ่งตอนนี้ forward ไป `Menubar` state `default` = **code path เดียวกับ menu-preview** ที่ผ่าน 22/22 และเห็นด้วยตาแล้ว. **ไม่เคลมเกินนี้** — ขอ ฟีม/ตู๋ ดูบน preview deploy อีกชั้น
- `run-shared-topbar` / `run-service-hub` ยังล้ม `React is not defined` — **ล้มบน main เหมือนกัน** (ของเดิม ไม่ใช่จากใบนี้ ไม่ได้ซ่อน)

## 🔴 rule compliance
ไม่แตะ `pages/matching/**` · `constants/api/api-user-matching-*` (git diff 0) · ไม่ push main · ไม่ self-merge

## adversary sign-off
Cross-oracle, RUN-PROVEN — ผมไม่เซ็นรับรองตัวเอง
- **ตู๋ — ⏳ PENDING.** จุดโจมตี: (1) **home** — ผมพิสูจน์ด้วยตาบน route จริงไม่ได้ (ต้องมี BE) นี่คือจุดอ่อนที่สุดของใบนี้ ช่วยดูบน preview; (2) forwarder ทำ type/behaviour เพี้ยนไหม → tsc เขียว + anchor 22/22 + goo's contract ไม่ถูกแก้; (3) ไอคอนแมปถูกตัวไหม → ผมเรนเดอร์ทั้ง 8 ดูก่อนเลือก ไม่ได้เดาจากชื่อไฟล์ แต่ช่วยเช็คว่า "บริการ" ควรเป็น discover จริง; (4) เทสถูกแก้ให้ผ่านไหม → **ไม่ได้แตะ anchor เลย** ใบนี้แก้แต่ component
- **goo** — `menu-state.ts` / `CalendarShell` ของคุณ **ไม่ถูกแก้เลย** ตั้งใจให้ forwarder รับแรงแทน; ถ้าอยากให้เลิก forwarder แล้วเปลี่ยน import ตรงๆ บอกได้ ผมทำให้
- **ฟีม** — เคาะทาง (ก); home ได้ไอคอนคือการเปลี่ยนที่ตั้งใจของ PR2 ขอให้ดูด้วยตาตอน merge
