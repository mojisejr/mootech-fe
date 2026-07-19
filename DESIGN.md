# MuMate — DESIGN.md (v2 · V3 redesign)

> **Supersedes v1** — the previous teal-led brownfield contract is preserved verbatim at
> [`docs/archive/DESIGN-v1.md`](docs/archive/DESIGN-v1.md) (Rule 1 — nothing deleted).
>
> **Status:** 🟡 DRAFT — drafted by Lamun 2026-07-19 from the Figma V3 file + codebase audit.
> **Pending:** `o` sign-off (design direction) + ฟีม review. Do not treat as locked until approved.
>
> Source of truth: Figma **Mumate app - V3** (`hEOnE9S6wLkMhb0Iy2Fe6T`) · structure map: [`docs/figma-map.md`](docs/figma-map.md)
> Evidence labels: `✓` observed in Figma/code · `~` inferred · `?` not yet confirmed (needs re-fetch)

---

## 1. Atmosphere — what MuMate V3 should feel like

**Navy + electric-lime, flat, crisp, high-contrast, structured.** Thai-first, mobile-app (frame 375–393px).
Mystical แต่ **modern & confident** — ไม่ใช่ soft/glassy teal แบบ v1 อีกต่อไป. ความลึกมาจาก **contrast ของพื้น (ghost-white ↔ white card)** ไม่ใช่เงา. จังหวะเด่นคือ **ปุ่ม sapphire + ตัวอักษร lime** ที่ให้พลังงานสูง — ใช้จุดเดียว ที่เหลือสงบ.

**เปลี่ยนจาก v1:** teal glassy soft mystical → **navy + electric-lime flat crisp**. คงไว้: mobile-first, Thai legibility, รorganized rounded cards.

---

## 2. Color tokens `✓`

### Brand
| Token | Hex | ใช้ที่ |
|---|---|---|
| `sapphire` (primary) | `#1455A4` | ปุ่มหลัก, checkbox fill, accent heading, avatar badge |
| `sapphire-hover` | `#10427F` | hover/pressed ของ primary |
| `lime` (accent) | `#E1FF00` | **ตัวอักษรบนปุ่ม sapphire + focus ring เท่านั้น** — ⚠️ ห้ามใช้เป็น fill บนพื้นขาว (contrast ต่ำ) |
| `cyan` (secondary) | `#1B9AAF` | teal เดิม — demoted เป็น secondary/legacy tie-in |

### Surface & text
| Token | Hex | ใช้ที่ |
|---|---|---|
| `bg` ghost-white | `#ECF0FD` | พื้นหลัง page + tile-icon chip |
| `surface` white | `#FFFFFF` | card, input, sheet |
| `text-title` | `#0B305B` | หัวข้อจอ (Oxford Navy) |
| `text-body` | `#464646` | เนื้อความ / label |
| `text-muted` | `#71717A` | list-item รอง |
| `placeholder` | `#9CA3AF` | placeholder input |
| `text-filled` | `#212121` | ค่าที่กรอกแล้ว |

### Semantic & border
| Token | Hex |
|---|---|
| `error` | `#E73E3E` |
| `focus-border` | `#3475E2` |
| `border-input` | `#E5E7EB` |
| `border-card` | `#E9EAEB` |
| `disabled-bg` | `#DDDDDD` (Neutral 03) |

### Element colors (5 ธาตุ) `✓`
map จาก `lib/calculator/elements.ts` — `WOOD=ไม้ · FIRE=ไฟ · EARTH=ดิน · METAL=ทอง · WATER=น้ำ`.
ใช้กับ element chip / result breakdown / personalization tint. *(ค่า hex ต่อธาตุ: ดึงจาก elements.ts ตอน implement)*

---

## 3. Typography — **3 ฟอนต์มีบทบาท** `✓` (แก้จากที่เคยเข้าใจว่า single-font)

| Family | บทบาท |
|---|---|
| **IBM Plex Sans Thai** | primary UI — Thai body, label, ปุ่ม, input |
| **Poppins** | Latin/ตัวเลข + **label ปุ่ม disabled** (สลับเป็น Poppins white) |
| **Chonburi** | Thai display heading (accent, ใช้เฉพาะหัวข้อเด่น) |

### Ramp `✓`
| Style | Font / weight | Size / line-height | Case |
|---|---|---|---|
| H1 / heading | IBM Plex Sans Thai Bold 700 | 24 / 32 | — |
| Label | SemiBold 600 | 14 / 20 | — |
| Body Large (input value/placeholder) | Regular 400 | 16 / 24 | — |
| Body Regular | Regular 400 | 14 / 22 | — |
| Button Primary | Bold 700 | 16 / 24 | UPPERCASE |
| Button Small | SemiBold 600 | 14 / 20 | UPPERCASE |
| Helper | Regular 400 | 12 / 18 | — |

Letter-spacing: 0 ทั้งหมด.

---

## 4. Radius & elevation `✓`
| Token | ค่า |
|---|---|
| pill (button/input/dropdown) | `100px` |
| card | `16px` |
| icon chip | `6px` |
| checkbox box | `6–8px` |
| screen frame | `40px` |

**Flat — ไม่มี drop shadow.** ความลึกมาจาก bg contrast (ghost-white ↔ white). ข้อยกเว้นเดียว: **Tab ที่ selected** มีเงาบางๆ.

---

## 5. Spacing scale `✓`
`4 · 8 · 12 · 16 · 20 · 24 · 32`
- label ↔ field: **8** · field stack gap: **20** · birth-row cell gap: **4** · checkbox ↔ text: **8**
- section gap: **32** · footer gap: **24** · card inner: **16–24** · content: `px-24 py-32`

---

## 6. Primitives spec `✓` (จาก Figma component library)

### Button — pill, sapphire fill + lime text
radius `100px` · uppercase label · sizes: **Full-width** (pad V14) / **Small** (pad 24H/16V).
| State | Fill | Label |
|---|---|---|
| Default | `#1455A4` | `#E1FF00` (IBM Plex Bold 16/24) |
| Hover | `#10427F` | `#E1FF00` |
| Pressed | `#1455A4` | `#E1FF00` |
| Focus | `#1455A4` + **2px `#E1FF00` ring** บนพื้น `#222` | `#E1FF00` |
| Disabled | `#DDDDDD` | **white, Poppins SemiBold** |
| Loading | `#DDDDDD` | dots |

### Input / Field — pill
height `52` · radius `100px` · pad 20H/14V · bg white · label บน (14/20 SemiBold) · placeholder ใน (16/24) · trailing icon 20×20 · helper 12 ล่าง.
| State | Border | อื่นๆ |
|---|---|---|
| Default/Hover | `1px #E5E7EB` | placeholder `#9CA3AF` |
| Focus | **`2px #3475E2`** | — |
| Filled | `1px #E5E7EB` | value `#212121` |
| Error | **`2px #E73E3E`** | label+helper `#E73E3E` |

### Dropdown `~`
= Input container + chevron-down 20×20. States mirror Input. *(focus/error hex อนุมานเท่ากับ Input — `?` ยังไม่ re-fetch)*

### Checkbox `~`
box `24×24` radius 6–8 · gap 8 · label 16/24 `#444`. Unselected: white + gray border · **Selected: `#1455A4` fill + white check**. รองรับ label + description. *(`?` unselected-border hex + disabled/error ยังไม่ยืนยัน — design_context refused, อ่านจาก pixel)*

### Tab / Pill Tabs `?`
segmented pill · selected = white fill + เงาบาง + label เข้ม · unselected = โปร่ง + label เทา. *(hex/size ยังไม่ได้ — design_context refused node นี้ ต้อง re-fetch จาก desktop selection)*

### Card / Sheet / Nav (Menubar)
Card: white `radius 16` pad 16, flat. Nav: bottom Menubar variants `Status=default/focus/hover × Home/service/calendar/shop`. *(spec ละเอียดตอน implement)*

> ⚠️ **3 node (Dropdown/Checkbox/Tab) `get_design_context` refused** — ค่าบางส่วนอ่านจาก screenshot ต้อง re-fetch จาก Figma desktop (เลือก layer) ก่อน finalize primitive.

---

## 7. Personalization layer — element+zodiac (60 jiazi) `✓`

**หัวใจของ V3:** หน้าตาแอปเปลี่ยนตามดวงของ user. ปีเกิด → ธาตุ + นักษัตร → asset ที่ตรงตัว.

### Data path — reuse ของเดิม (ไม่เขียน bazi ใหม่)
- best: `POST /api/what-if/generate` → `destiny.{ element, animal }` จากวันเกิด (`lib/what-if/storage.ts`)
- alt: `/api/calculator/compute` → `yearOfZodiac` + `dayMasterElement`
- element Thai↔Eng มีแล้ว: `lib/calculator/elements.ts`, `lib/calculator/map-enrichment.ts`

### Asset resolver — ต้องสร้างใหม่ (gap)
1. **zodiac-order table**: Thai นักษัตร → `01–12` (`01 ชวด … 12 กุน`) + English `animal`→Thai (เช่น `PIG→กุน`) — *ยังไม่มีในโค้ด*
2. **filename builder**: `(order, thaiAnimal, thaiElement) → NN_<animal>-<element>.png` → `/images/v2/characters/` (no bg) หรือ `/cards/` (with bg, รอ rename)
3. resolver เดียว ใช้ทุกจอ (result/home/profile)

### 🔶 Product decisions ที่ต้องเคาะ (ก่อน lock resolver)
- ใช้ **นักษัตรปีเกิด** (`yearOfZodiac`/`destiny.animal`) หรือ day-master?
- ใช้ **ธาตุไหน** — day-master element (`dayMasterElement`, ที่ DitiHero เรียก "คุณคือคนธาตุ X") หรือ year element?
- characters filename = ปี-นักษัตร + element → ยืนยันว่า element ตัวไหน

### ⚠️ Asset ที่ต้องแก้ (ฝั่งฟีม)
- typo `803_ขาล-น้ำ.png` → ควร `03_ขาล-น้ำ.png` (จะ break lookup)
- `cards/` ยังเป็น `Card N` ไม่มี convention → rename ให้ match characters
- icon ธาตุ **ขาด ทอง + ไม้** (มีแค่ Fire/water/dirt)

---

## 8. Layout principles `✓`
- mobile-first frame **375–393px** · screen radius 40
- โครงจอ: **Status Bar** (44) → **Nav** (back + progress dots) → **Main Content** (`px-24 py-32`) → **Footer** (ปุ่ม + Home Indicator)
- bottom **Menubar** nav (Home / service / calendar / shop) มี state
- bg = static `BG01–04` เลือกตามจอ (ไม่ personalize)

---

## 9. Assets `✓`
- **characters/** (60) = 12 นักษัตร × 5 ธาตุ · convention `NN_นักษัตร-ธาตุ` (no bg) — resolver อ่านจากชื่อได้
- **cards/** (60) = artwork เดียวกัน + bg · `Card N` ไม่มี convention (รอ rename)
- **bg/** = `BG01–04` static · IMG_#### = raw คัดออก
- **main-mascot/** = hero mascot · **icons/** (14) domain + ธาตุ 3 (ขาด ทอง/ไม้)
- เลือก canonical จาก 2 tree ซ้ำ (`images/v2` vs `mumate-v2-assets`)

---

## 10. Delta from v1 (สรุป)
| มิติ | v1 | v2 |
|---|---|---|
| Primary | teal `#1B9AAF` | **Sapphire `#1455A4`** |
| Accent | — | **Lime `#E1FF00`** (text/ring only) |
| Font | 5-font loose stack | **3 ฟอนต์มีบทบาท** (IBM Plex Sans Thai + Poppins + Chonburi) |
| Radius | CTA 12–16 | **pill 100px** + card 16 |
| Elevation | glassy soft-shadow | **flat** (bg contrast) |
| Mood | teal soft mystical | **navy + electric-lime, flat, crisp** |
| Personalization | — | **element+zodiac resolver (ใหม่)** |

**คงจาก v1:** mobile-first, Thai-first legibility, rounded organized cards, ทิศทาง mystical.

---
🤖 drafted by Lamun Oracle · pending `o` sign-off + ฟีม review
