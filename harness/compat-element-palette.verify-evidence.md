# EYE PROOF — สีธาตุครบ 5 (ปิด A2 จาก #161)

**Anchor:** `harness/run-compat-zones.ts` (42/42, 5 teeth)
**PR:** feat/v2-compat-element-palette · base = main (`8d24b02`)
**Ledger:** `harness/bug-ledger.json` → `compat-element-palette` (+ ปรับ `compat-result-zones-1-4` ที่เคย log A2 ไว้)
**Plan:** ❄️ FROZEN — `lamun-oracle/ψ/plans/2026-08-03_FROZEN-element-chip-palette.md`

ANCHOR: harness/run-compat-zones.ts#mut-element-tint-drift

## ที่มา — ปิด A2 ที่ผม surface เองใน #161
ตอน #161 ผม log ไว้ว่า **ไม้/ไฟ/ทอง ยังไม่ได้เทียบ Figma** (node เรนเดอร์แค่ 水/土) และ **ไม่เคลมว่าตรง**. รอบนี้ปิดให้จบ.

## (ก) ตามหา node อื่นใน Figma — หาแล้ว **ไม่มีจริง** (บันทึกไว้ ไม่ให้ใครต้องหาซ้ำ)
| ค้นอะไร | ผล |
|---|---|
| `search_design_system` (element/ธาตุ/wuxing) | ว่างเปล่า — ไม่มี component ธาตุ |
| `get_variable_defs` บน node chip (`636:22207`) | **`{}`** — สี chip ไม่ผูก variable |
| โครง chip ใน metadata | **frame ธรรมดา ไม่ใช่ instance** ⇒ ไม่มี variant |
| หน้า "ธาตุของคุณ" `300-2356` (จาก `docs/figma-map.md`) | มีครบ 5 ธาตุ **แต่เป็นไอคอนเล็กคนละ treatment** ใช้แทน tile 56px ไม่ได้ |

## 🔑 กฎที่ค้นเจอ — พื้น tile ไม่ใช่ค่าอิสระ
วัดจาก 2 ตัวที่ Figma มีจริง:
> **พื้น tile = สีตัวอักษร ทับขาว ที่ opacity 16.2%**

| ธาตุ | glyph | tile ที่ sample | opacity ที่คำนวณได้ (ต่อ channel) |
|---|---|---|---|
| น้ำ | `#4C8CE6` | `#E2ECFB` | 0.162 · 0.165 · 0.160 |
| ดิน | `#CC9E4C` | `#F7EFE2` | 0.157 · 0.165 · 0.162 |

**ตรวจย้อน:** เอากฎไปสร้างใหม่ได้ `#E2ECFB` และ `#F7EFE2` **ตรงเป๊ะทั้งคู่** ⇒ กฎถูก ไม่ใช่บังเอิญ
⇒ โค้ดจึงเก็บแค่ **สี glyph** แล้ว `elementTint()` คำนวณพื้นให้ — เลือกพื้นเองไม่ได้อีกต่อไป (กันทั้ง class)

## 🎨 ค่าที่ใช้ + ที่มา (แยกให้ชัด ไม่ปนกัน)
| ธาตุ | glyph | tile (คำนวณ) | ที่มา |
|---|---|---|---|
| น้ำ 水 | `#4C8CE6` | `#E2ECFB` | **Figma-sampled** (636:22150) |
| ดิน 土 | `#CC9E4C` | `#F7EFE2` | **Figma-sampled** (636:22150) |
| ไม้ 木 | `#4CBD32` | `#E2F4DE` | **ฟีม-ruled** 2026-08-03 |
| ไฟ 火 | `#D94C4C` | `#F9E2E2` | **ฟีม-ruled** 2026-08-03 |
| ทอง 金 | `#D9B84C` | `#F9F3E2` | **ฟีม-ruled** 2026-08-03 |

3 ตัวหลังเลือกจาก **แผ่นเทียบที่เรนเดอร์จริง** (`compat-element-options.png`) — ฟีม เลือกชุดที่จูนให้เข้ากับ 2 ตัวจริง แล้วสั่ง **ไม้ เข้มลงหน่อย** → ผมเรนเดอร์ 5 ระดับความเข้ม (L57.5→L40) วางข้างของจริงแล้วเลือก **L47 `#4CBD32`** ที่น้ำหนักสายตาเท่ากับ น้ำ/ดิน (L57.5 สว่างเด่น · L40 หนักเกิน). **ตัดสินจากพิกเซล ไม่ใช่เดา hex**

## 🔍 bug-class ที่ anchor นี้เป็นเจ้าของ
**state-space ที่ตรวจไม่ได้ด้วย render เดียว** — จอเรนเดอร์ **ทีละ 2 ธาตุ** (คู่ที่กำลังเทียบ) ⇒ render เดียวเห็นได้มากสุด 2 จาก 5 เสมอ. spot-check จึง**ครอบคลุมไม่ได้เชิงโครงสร้าง** และผู้ใช้จริง **เกิน 60% ไม่ใช่คู่ น้ำ-ดิน** = เห็นสีที่ไม่เคยถูกเรนเดอร์ในเทสเลย
⇒ anchor **ไล่ทั้ง 5** โดยขับ 3 คู่ผ่าน route จริง + assert ว่า **เซ็ตที่เห็น = 5** (ถ้าใครลบคู่ออก จะแดง ไม่ใช่เงียบๆ แคบลง)

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app next dev -p 3101
CAPTURE_HOST=http://localhost:3101 npx tsx harness/run-compat-zones.ts   # 42/42
```

## proof-of-teeth (run-compat-zones.ts → ✅ 42/42)
| invariant | result |
|---|---|
| ธาตุทั้ง 5 · สี glyph ตรงค่าที่ ratify | ✓ ไม้/ไฟ/ทอง/น้ำ/ดิน |
| ธาตุทั้ง 5 · พื้น tile ตรงกฎ 16.2% | ✓ ทุกตัว |
| **ไล่ครบ 5 จริง** (ไม่ใช่ spot-check คู่เดียว) | ✓ `seen.size === 5` |
| Zone 1–4 invariants เดิม (tab/nested-card/ramp/side-tint/D23) | ✓ ทั้งหมด |
| 🦷 `mut-element-tint-drift` (พื้นหลุดจากกฎ) | **CAUGHT** |
| 🦷 tab-white-text · nested-card · tint-swap · grade-colour-drift | **CAUGHT ทั้ง 4** |

## ไม่ regress
`run-compat-3c` ✓ · `run-compat-2e2` ✓ · `run-compat-sprites` ✓ · `tsc` ✓ · `scripts/*.test.ts` ✓ (รวม compat-tone 7/7) · ledger ✓ · `npm run build` (CI placeholder env) ✓

## Pixel proof
- `harness/pixel-proof/compat-element-5-proof.png` — ธาตุครบ 5 บน **route จริง** (3 คู่ ต่อกัน)
- `harness/pixel-proof/compat-element-options.png` — แผ่นเทียบตอนเลือก (ของจริง 2 + ตัวเลือก A/B)

## 🔴 rule compliance
ไม่แตะ `pages/matching/**` · `constants/api/api-user-matching-*` (git diff 0) · ไม่ push main · ไม่ self-merge

## adversary sign-off
Cross-oracle, RUN-PROVEN — ผมไม่เซ็นรับรองตัวเอง
- **ตู๋ — ⏳ PENDING.** จุดโจมตี: (1) เคลมว่า "ครบ 5" จริงไหม หรือแอบ spot-check → assert `seen.size===5` + ขับ 3 คู่ผ่าน route จริง ลองลบคู่ดูว่ามันแดงไหม; (2) กฎ 16.2% มั่วไหม → สร้างย้อนได้ตรงเป๊ะทั้ง 2 ค่าที่ sample + tooth `mut-element-tint-drift` กัด; (3) ปนของ Figma กับของที่ ฟีม เคาะไหม → แยกไว้ชัดในตาราง + คอมเมนต์โค้ด; (4) `elementTint()` คำนวณเพี้ยนที่ค่าขอบ → assert ±2/255 ทุก channel ทุกธาตุ; (5) forbidden paths → 0 ไฟล์
- **ฟีม** — เลือกชุด + สั่ง ไม้ เข้มลง; ค่าสุดท้ายมาจากแผ่นเทียบที่เรนเดอร์จริง ขอให้ดูด้วยตาตอน merge
- **บอง** — งานนี้ไม่แตะ grade mapping (เรื่อง C ปิดแล้วจาก engine-check ของคุณ — ส้มถูก ไม่แก้)
