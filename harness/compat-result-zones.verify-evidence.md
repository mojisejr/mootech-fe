# EYE PROOF — ผลดวงสมพงศ์ Zone 1–4 refactor ให้ตรง Figma

**Anchor:** `harness/run-compat-zones.ts` (24/24, 4 teeth) + `scripts/compat-tone.test.ts` (13 เกรด, 7/7)
**PR:** feat/v2-compat-zones-1-4 · base = main (`d4c0f7c`)
**Ledger:** `harness/bug-ledger.json` → `compat-result-zones-1-4`
**Plan:** ❄️ FROZEN v2 — `lamun-oracle/ψ/plans/2026-08-03_FROZEN-compat-result-zones-1-4.md`

ANCHOR: harness/run-compat-zones.ts#mut-nested-card

| Zone | Figma node | คือ |
|---|---|---|
| 1 | `636:19319` | Pill Tabs |
| 2 | `636:19532` | ความเข้ากัน N ด้าน |
| 3 | `636:22150` | ธาตุ & เสา |
| 4 | `636:22328` | รายคน |

## มติ ฟีม (2026-08-03) ที่แผนนี้ทำตาม
1. Zone 1 จอแคบ → **เลื่อนแนวนอน + ซ่อน scrollbar** (ไม่บีบตัวอักษร)
2. เกรด **C เปล่า → ส้ม** `#F57C00` (รวมกับ C-)
3. **🐯 สิ่งชี้นำ คงที่เดิม** — ไม่ย้าย ไม่แตะ contract
4. หัวข้อ Zone 4 → **"รายคน"**

## Source of truth — sample สีจาก pixel ทุกค่า (ไม่มีค่าไหนกะเอา)
`get_metadata` (ตำแหน่ง/ขนาด) + `get_screenshot` + อ่านค่า hex จาก PNG ด้วย pngjs:
- ระบบ tint: **ตัวเรา `#ECF0FC`** · **เขา `#F9F4F0`** (ใช้ทั้ง Zone 1 container, Zone 3 panel, Zone 4 card)
- grade ramp: A `#2E7D32` · B `#66BB6A` · C+ `#CDDC39` (ตัวอักษรเข้ม `#374151`) · C- `#F57C00` · D- `#B71C1C`
- soft pair: `#E8F5E9` · `#F0F8F0` · `#F9FBE7` · `#FFF0E1` · `#FCE4EC`
- หัวใจ `#FF6800` บนพื้น `#EAF0FA` · 水 `#E2ECFB`/`#4C8CE6` · 土 `#F7EFE2`/`#CC9E4C`

## 📐 ตัวเลขที่ **วัดจริง** ก่อนตัดสินใจ (Zone 1)
ความกว้างข้อความ @16px bold IBM Plex Sans Thai: `ภาพรวม` 56.9 · `รายมิติ` 47.6 · **`ธาตุ & เสา` 71.0** · `รายคน` 47.6
→ @393 ได้ 86.3/tab (พอ) · @360 78.0 (ไม่พอ) · **@320 68.0 (ไม่พอ)** ⇒ จึงต้องมีทางออก ไม่ใช่ยัดให้บีบ

## Run command
```bash
set -a; . testenv/env/fe.env; set +a; BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app next dev -p 3100
CAPTURE_HOST=http://localhost:3100 npx tsx harness/run-compat-zones.ts   # 24/24
npx tsx scripts/compat-tone.test.ts                                      # 7/7 (13 เกรด)
```

## proof-of-teeth (run-compat-zones.ts → ✅ 24/24)
| invariant | result |
|---|---|
| **Z1** container tint `#ECF0FC` | ✓ |
| **Z1** active = sapphire bg + **LIME** text · inactive = โปร่ง + sapphire | ✓ |
| **Z1 @393** tab กว้างเท่ากัน (86.3 ×4) + **เต็มแถวพอดี ไม่ scroll** | ✓ `scroll 361 = client 361` |
| **Z1 @320** ตัวอักษร**ไม่ถูกบีบ** (ทุก tab ≥86px) · แถว**เลื่อนแทน** · **scrollbar ซ่อน** (track 0px) · page ไม่ล้น | ✓ `361 > 288`, bar `0px` |
| **Z2** 5 แถวอยู่ใน card เดียว (ไม่มีการ์ดซ้อนการ์ด) | ✓ ทุกแถว bg transparent |
| **Z2** สี pill = สี bar **เสมอ** ทุกเกรด | ✓ A/B/C+/C-/D- ok |
| **Z2** ทุกเกรดใช้สี ramp ที่ sample มา · **A ≠ B** (5 ระดับจริง) | ✓ |
| **Z2** กล่องเหตุผลใช้ soft tint ตามเกรด | ✓ ครบ 5 |
| **Z3** panel สี่เสา tint ถูกฝั่ง (self/other) · ช่องในขาว | ✓ |
| **Z3** D23 ยาม `—` เมื่อ `timeKnown=false` **ยังอยู่** | ✓ |
| **Z4** การ์ดคน tint ถูกฝั่ง · หัวข้อ = **"รายคน"** | ✓ |
| 🦷 `mut-tab-white-text` (active กลับเป็นขาว) | **CAUGHT** |
| 🦷 `mut-nested-card` (แถวมีพื้นการ์ดของตัวเอง) | **CAUGHT** |
| 🦷 `mut-tint-swap` (สลับ tint สองฝั่ง) | **CAUGHT** |
| 🦷 `mut-grade-colour-drift` (สี bar หลุดจาก pill) | **CAUGHT** |

`scripts/compat-tone.test.ts` 7/7 — ไล่ **13 เกรดจริงของเอนจิน** เทียบ ramp ใหม่ + invariant ใหม่ **A ≠ B**

## ไม่ regress (รันซ้ำ เขียวหมด)
`run-compat-3c` 17/17 · `run-compat-2e2` ✓ · `run-compat-sprites` 11/11 · `tsc` ✓ · `scripts/*.test.ts` ✓ · ledger ✓ · `npm run build` (CI placeholder env) ✓

## Pixel proof
- `harness/pixel-proof/compat-zones-393.png` — ทั้งหน้า @393 (4 zone ครบ)
- `harness/pixel-proof/compat-zones-320.png` — @320 (จุดที่เคยล้น)
- `harness/pixel-proof/compat-zones-tabs-320.png` — แถบ tab @320: ตัวอักษรเต็ม ไม่บีบ เลื่อนได้ ไม่มี scrollbar

## 🚩 A2 — surface ไว้ ไม่เคลมว่าครบ
- **สีธาตุ ไม้ / ไฟ / ทอง ยัง NOT Figma-sampled** — node นี้เรนเดอร์แค่ 水/土 → 2 ตัวนั้น sample จริง, อีก 3 ตัวคงค่าเดิม **ไม่ได้แกล้งบอกว่าตรง Figma**
- **🐯 สิ่งชี้นำ** ยังอยู่ใน DimensionCard ตามมติ ฟีม (Figma วางท้าย Zone 3) — เป็นมติ ไม่ใช่ตกหล่น

## 🔴 rule compliance
`git diff origin/main...HEAD` **ไม่แตะ** `pages/matching/**` และ `constants/api/api-user-matching-*`. ไม่ push main, ไม่ self-merge.

## adversary sign-off
Cross-oracle, RUN-PROVEN — ผมไม่เซ็นรับรองตัวเอง
- **ตู๋ — ⏳ PENDING.** จุดโจมตี: (1) Z1 @320 บีบตัวอักษรจริงไหม → วัดแล้วทุก tab ≥86px + scrollWidth>clientWidth + track 0px; (2) การ์ดซ้อนการ์ดหลุดไหม → ทุกแถว bg transparent + `mut-nested-card` กัด; (3) สี pill/bar หลุดกันได้ไหม → assert เท่ากันทุกแถว + `mut-grade-colour-drift` กัด; (4) เปลี่ยน `gradeTier` (4→5 tier) ทำให้ 13 เกรดพัง? → compat-tone 7/7 ไล่ครบ 13 + invariant A≠B; (5) tint สลับฝั่ง → `mut-tint-swap` กัด; (6) D23/กฎ 4 ยังอยู่ → assert + anchor เดิมเขียว; (7) forbidden paths → 0 ไฟล์
- **ฟีม** — เคาะครบ 4 ข้อ; สี ramp/tint เป็นค่าที่ sample จาก node จริง ขอให้ดูด้วยตาตอน merge
- **บอง** — `gradeTier` 4→5 tier แตะ mapping ที่เคย engine-check ไว้ (13 เกรด) — เทสเดิมยังคุมอยู่ + เพิ่ม A≠B; ฝากดูว่า C เปล่า = ส้ม ตรงเจตนาเอนจินไหม
